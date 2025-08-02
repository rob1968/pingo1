const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const path = require('path');
const http = require('http'); // Add http module
const { Server } = require("socket.io"); // Add socket.io
const mongoose = require('mongoose'); // Add mongoose import
const fetch = require('node-fetch'); // Add node-fetch for server-side fetch
const { v4: uuidv4 } = require('uuid'); // Import UUID

require('dotenv').config();
const db = require('./bingo-api/models/db'); // Import db to access gracefulShutdown
const { WinningPatterns } = require('./bingo-api/utils/winning-patterns'); // Import server-side patterns
require('./bingo-api/config/passport');
require('./bingo-api/models/players'); // Ensure Player model schema is registered
const Player = mongoose.model('Players'); // Require the Player model

const routesApi = require('./bingo-api/routes/index');

const app = express();

const allowCrossDomain = function (req, res, next) {
	// Allow your domain (HTTPS recommended) and localhost for development
	const allowedOrigins = ['https://bingo.pihappy.me', 'http://bingo.pihappy.me', 'http://localhost:8000'];
	const origin = req.headers.origin;
	if (allowedOrigins.includes(origin)) {
		res.setHeader('Access-Control-Allow-Origin', origin);
	}
	// res.header('Access-Control-Allow-Origin', 'http://localhost:8000'); // Keep existing CORS for HTTP routes if needed
	res.header('Access-Control-Allow-Methods', 'GET, PUT, POST, DELETE, OPTIONS');
	res.header('Access-Control-Allow-Headers', 'Content-Type, authorization');
	next();
};

app.use(allowCrossDomain);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));


app.use(passport.initialize());
app.use('/bingo-api', routesApi);

// New endpoint for Pi login verification
app.post('/api/pi-login', async (req, res) => {
  const authData = req.body; // authData is the entire body now
  if (!authData || !authData.user || !authData.accessToken) { // Check for user and accessToken within authData
    return res.status(400).json({ message: 'Missing required authentication data (user or accessToken).' });
  }

  try {
    // Verify the Pi Network authentication data
    const piResponse = await fetch('https://api.minepi.com/v2/me', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authData.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!piResponse.ok) {
      const errorText = await piResponse.text();
      console.error("Pi API verification failed:", piResponse.status, errorText);
      return res.status(piResponse.status).json({ message: 'Pi authentication failed', details: errorText });
    }

    const piUser = await piResponse.json();
    console.log("Pi User verified:", piUser);

    // Check if user exists in your DB, create if not, then log them in
    let user = await Player.findOne({ piUid: piUser.uid });

    if (!user) {
      // Create new user
      user = new Player({
        name: piUser.username, // Use Pi username as game name
        email: `${piUser.uid}@pi.com`, // Placeholder email
        piUid: piUser.uid,
        piUsername: piUser.username, // Add piUsername
        balance: 50, // Initial balance
        wins: 0,
      });
      await user.save();
      // Re-fetch the user to ensure the in-memory object reflects the default balance
      user = await Player.findOne({ piUid: piUser.uid });
      console.log(`New user created: ${user.name}`);
    } else {
      console.log(`Existing user logged in: ${user.name}`);
      // Ensure existing users have a balance of at least 50
      // Only set to 50 if balance is undefined or null (i.e., missing or corrupted)
      // Do not reset if it's a valid number below 50.
      if (user.balance === undefined || user.balance === null) {
        console.log(`Existing user ${user.name} has undefined/null balance. Setting to 50.`);
        user.setBalance(50);
        await user.save(); // Save the updated balance
      }
    }

    // Generate your application's JWT token
    const token = user.generateJwt();
    console.log("User object before sending response:", user); // Debug log for balance
    res.status(200).json({ token: token, user: { name: user.name, piUid: user.piUid, balance: user.balance, wins: user.wins } });

  } catch (error) {
    console.error("Server-side Pi login error:", error);
    res.status(500).json({ message: 'Internal server error during Pi login', error: error.message });
  }
});

// Serve static assets from the 'build' directory
app.use('/build', express.static(path.join(__dirname, 'build')));

// Serve config.json from the root
app.get('/config.json', function(req, res) {
  res.sendFile(path.join(__dirname, 'config.json'));
});

// Pi Payment Endpoints for Donations
app.post('/api/pi-approve-donation', async (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) {
    return res.status(400).json({ message: 'Missing paymentId' });
  }
  if (!process.env.PI_API_KEY) {
    console.error('PI_API_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error for Pi Payments.' });
  }

  try {
    console.log(`Approving Pi donation paymentId: ${paymentId}`);
    const piServerResponse = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!piServerResponse.ok) {
      const errorData = await piServerResponse.json();
      console.error('Pi Server approve donation failed:', piServerResponse.status, errorData);
      return res.status(piServerResponse.status).json({ message: 'Pi server failed to approve donation.', details: errorData });
    }
    // Approval successful, Pi SDK on client will call onReadyForServerCompletion
    console.log(`Pi donation paymentId: ${paymentId} approved by app server.`);
    res.status(200).json({ message: 'Donation approved, awaiting completion.' });
  } catch (error) {
    console.error('Error approving Pi donation:', error);
    res.status(500).json({ message: 'Internal server error during donation approval.', error: error.message });
  }
});

app.post('/api/pi-complete-donation', async (req, res) => {
  const { paymentId, txid } = req.body;
  if (!paymentId || !txid) {
    return res.status(400).json({ message: 'Missing paymentId or txid' });
  }
  if (!process.env.PI_API_KEY) {
    console.error('PI_API_KEY is not set in environment variables.');
    return res.status(500).json({ message: 'Server configuration error for Pi Payments.' });
  }

  try {
    console.log(`Completing Pi donation paymentId: ${paymentId} with txid: ${txid}`);
    const piServerResponse = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${process.env.PI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ txid }),
    });

    if (!piServerResponse.ok) {
      const errorData = await piServerResponse.json();
      console.error('Pi Server complete donation failed:', piServerResponse.status, errorData);
      return res.status(piServerResponse.status).json({ message: 'Pi server failed to complete donation.', details: errorData });
    }
    // Completion successful
    console.log(`Pi donation paymentId: ${paymentId} completed with txid: ${txid}.`);
    // Here you might want to record the donation in your database if needed.
    // For now, just confirming completion.
    res.status(200).json({ message: 'Donation successfully completed!' });
  } catch (error) {
    console.error('Error completing Pi donation:', error);
    res.status(500).json({ message: 'Internal server error during donation completion.', error: error.message });
  }
});


// Error handler for UnauthorizedError
app.use(function (err, req, res, next) {
  if (err.name === 'UnauthorizedError') {
    res.status(401);
    res.json({"message" : err.name + ": " + err.message});
  } else {
    next(err);
  }
});

// Serve index.html for all other GET requests (after API and static routes)
app.get('*', function(req, res) {
  const indexPath = path.join(__dirname, 'index.html');
  res.sendFile(indexPath, function(err) {
    if (err) {
      res.status(404).send('index.html not found');
    }
  });
});

// --- Game State & Logic (Multi-Room) ---
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1); // Numbers 1-75
const DRAW_INTERVAL_MS = 4000; // Draw every 4 seconds (was 7)
const MAX_NUMBERS_TO_DRAW = 50; // Max numbers to draw before game ends automatically
const POST_WIN_DELAY_MS = 10000; // Delay after win/end before reset

const gameRooms = new Map(); // Stores all active game rooms { roomId: roomObject }

// Function to create a new room object
function createNewRoom(roomId, roomName, maxPlayers, prizeAmount, hostSocketId, minPlayersToStart = 2) { // Default minPlayersToStart to 2
  const parsedMaxPlayers = parseInt(maxPlayers, 10) || 10;
  // Ensure minPlayersToStart is at least 2, and not greater than maxPlayers
  const validatedMinPlayers = Math.max(2, parseInt(minPlayersToStart, 10) || 2);
  
  return {
    id: roomId,
    name: roomName,
    hostSocketId: hostSocketId,
    maxPlayers: parsedMaxPlayers,
    prizeAmount: parseFloat(prizeAmount) || 10, // Default to 10 if not specified
    minPlayersToStart: Math.min(validatedMinPlayers, parsedMaxPlayers), // Cannot be more than maxPlayers
    players: new Map(), // { socketId: { username, cards, markedCells, markedThisTurn, piUid } }
    drawnNumbers: [],
    isGameRunning: false,
    gameInterval: null,
    readyPlayerCount: 0, // Count of players who have paid and are ready for this specific game instance
    // winningPatterns: new WinningPatterns() // Each room could have its own instance if patterns vary
  };
}


// TODO: Refactor drawUniqueNumber, resetGame to be room-specific
function drawUniqueNumber(room) {
  if (!room || room.drawnNumbers.length >= MAX_NUMBERS_TO_DRAW) {
    return null; // No more numbers to draw or invalid room
  }
  let num;
  do {
    const randomIndex = Math.floor(Math.random() * BINGO_NUMBERS.length);
    num = BINGO_NUMBERS[randomIndex];
  } while (room.drawnNumbers.includes(num));
  room.drawnNumbers.push(num);
  return num;
}

async function resetRoomGame(roomId) {
    const room = gameRooms.get(roomId);
    if (!room) {
        console.log(`SERVER: Cannot reset game for non-existent room ${roomId}`);
        return;
    }
    console.log(`SERVER: Resetting game state for room ${roomId}...`);
    if (room.gameInterval) {
        clearInterval(room.gameInterval);
        room.gameInterval = null;
    }
    room.isGameRunning = false;
    room.drawnNumbers = [];
    room.readyPlayerCount = 0; // Reset count of players ready for this game instance

    // Clear marked cells for all players in this room
    for (const [socketId, playerData] of room.players.entries()) {
        playerData.markedCells = {};
        playerData.markedThisTurn = false;
        // Optionally, clear from DB if you store marked cells per game session linked to a room
        // For now, assuming markedCells in DB are more persistent or handled differently
    }

    // Notify clients in this room that the game is reset
    io.to(roomId).emit('gameState', {
        roomId: roomId,
        isRunning: room.isGameRunning,
        drawnNumbers: room.drawnNumbers,
        playerCount: room.players.size, // Current players in room
        readyCount: room.readyPlayerCount // Players ready for next game
    });
    io.to(roomId).emit('gameReset', { roomId: roomId });
    console.log(`SERVER: Room ${roomId} reset. Current players: ${room.players.size}`);
}


// --- End Game State & Logic ---


// --- Socket.IO Setup ---
const server = http.createServer(app); // Create HTTP server from Express app
console.log("SERVER: HTTP server created. About to create Socket.IO Server instance.");
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for WebSocket connections (for debugging)
    methods: ["GET", "POST"],
    credentials: true // Allow credentials if needed for authentication (though often not needed with origin: "*")
  }
});
console.log("SERVER: Socket.IO Server instance CREATED successfully.");


// let readyPlayers = new Map(); // OLD: Stores { username: '...', cards: {...} } keyed by socket.id (used BEFORE game starts)
// let activeGamePlayers = new Map(); // OLD: Stores { socketId: '...', cards: {...}, markedCells: {}, markedThisTurn: false } keyed by username
let socketUserMap = new Map(); // Maps socket.id -> { username, piUid, roomId } for quick lookup

// Server-side connection logging
// This log is now redundant due to the one after instance creation.
// console.log("SERVER: Socket.IO server initialized and awaiting connections...");

console.log("SERVER: Attaching Socket.IO engine connection_error listener.");
io.engine.on("connection_error", (err) => {
  console.error("SERVER: Socket.IO Engine Connection Error!");
  console.error(`SERVER: Error Code: ${err.code}`); // e.g., 1
  console.error(`SERVER: Error Message: ${err.message}`); // e.g., "Session ID unknown"
  console.error(`SERVER: Error Context: ${JSON.stringify(err.context)}`); // e.g., { code: 1, message: "Session ID unknown" }
});

console.log("SERVER: Attaching Socket.IO 'connection' listener.");
io.on('connection', (socket) => {
  socketUserMap.set(socket.id, { username: null, piUid: null, roomId: null }); // Track socket, initially unknown user/room
  console.log(`SERVER: User connected: ${socket.id}. Transport: ${socket.conn.transport.name}`);
  console.log(`SERVER: Connection headers: ${JSON.stringify(socket.handshake.headers, null, 2)}`);


  // Client should request room list or attempt to join/create a room.
  // No initial global game state to send anymore.

  socket.on('createRoom', (data) => {
    const { roomName, maxPlayers, prizeAmount, username, piUid } = data;
    if (!username || !piUid) {
        socket.emit('roomCreationFailed', { reason: 'User not authenticated for room creation.' });
        console.log(`SERVER: Room creation failed for socket ${socket.id} - missing username or piUid.`);
        return;
    }
    if (!roomName || !maxPlayers || !prizeAmount) {
        socket.emit('roomCreationFailed', { reason: 'Missing room parameters (name, maxPlayers, prizeAmount).' });
        console.log(`SERVER: Room creation failed for ${username} - missing parameters.`);
        return;
    }

    const roomId = uuidv4();
    const newRoom = createNewRoom(roomId, roomName, maxPlayers, prizeAmount, socket.id); // hostSocketId is still the creator
    gameRooms.set(roomId, newRoom);

    // The creator does NOT automatically join the room's socket.io room or player list.
    // They will see it in the list and can join like any other player.

    console.log(`SERVER: User ${username} (${socket.id}) created room ${roomId} (${roomName}). Max Players: ${newRoom.maxPlayers}, Prize: ${newRoom.prizeAmount}`);
    
    // Confirm to the creator that the room was made
    socket.emit('roomCreated', {
        roomId: roomId,
        message: `Room "${roomName}" created successfully. You can now join it from the list.`,
        roomDetails: { // Send some details back for immediate info if needed by client UI
            id: newRoom.id,
            name: newRoom.name,
            currentPlayerCount: 0, // Starts empty
            maxPlayers: newRoom.maxPlayers,
            prizeAmount: newRoom.prizeAmount
        }
    });

    // Notify all clients (or lobby), including the creator, about the new room being available
    io.emit('newRoomAvailable', {
        id: newRoom.id,
        name: newRoom.name,
        currentPlayerCount: newRoom.players.size,
        maxPlayers: newRoom.maxPlayers,
        prizeAmount: newRoom.prizeAmount
    });
  });

  socket.on('listRooms', () => {
    const availableRooms = [];
    for (const [roomId, room] of gameRooms.entries()) {
      if (!room.isGameRunning && room.players.size < room.maxPlayers) { // Only list rooms not full and not in progress
        availableRooms.push({
          id: room.id,
          name: room.name,
          currentPlayerCount: room.players.size,
          maxPlayers: room.maxPlayers,
          prizeAmount: room.prizeAmount
        });
      }
    }
    socket.emit('roomsList', availableRooms);
    console.log(`SERVER: Sent rooms list to ${socket.id}: ${availableRooms.length} rooms.`);
  });

  socket.on('joinRoom', (data) => {
    const { roomId, username, piUid } = data;
    if (!username || !piUid) {
        socket.emit('joinRoomFailed', { roomId: roomId, reason: 'User not authenticated for joining room.' });
        console.log(`SERVER: Join room ${roomId} failed for socket ${socket.id} - missing username or piUid.`);
        return;
    }

    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('joinRoomFailed', { roomId: roomId, reason: 'Room not found.' });
      console.log(`SERVER: User ${username} (${socket.id}) failed to join room ${roomId} - not found.`);
      return;
    }
    if (room.players.size >= room.maxPlayers) {
      socket.emit('joinRoomFailed', { roomId: roomId, reason: 'Room is full.' });
      console.log(`SERVER: User ${username} (${socket.id}) failed to join room ${roomId} - full.`);
      return;
    }
    // if (room.isGameRunning) { // Optional: Prevent joining games already in progress
    //   socket.emit('joinRoomFailed', { roomId: roomId, reason: 'Game already in progress.' });
    //   return;
    // }

    socket.join(roomId);
    const currentUserMapData = socketUserMap.get(socket.id) || {};
    currentUserMapData.roomId = roomId;
    currentUserMapData.username = username;
    currentUserMapData.piUid = piUid;
    socketUserMap.set(socket.id, currentUserMapData);


    room.players.set(socket.id, {
        username: username,
        piUid: piUid,
        cards: {},
        markedCells: {},
        markedThisTurn: false
    });

    console.log(`SERVER: User ${username} (${socket.id}) joined room ${roomId}. Players: ${room.players.size}/${room.maxPlayers}`);
    socket.emit('joinedRoom', { roomId: roomId, roomDetails: room });

    // Notify other players in the room
    socket.to(roomId).emit('playerJoinedRoom', {
        socketId: socket.id,
        username: username,
        playerCount: room.players.size
    });
    // Update room list for everyone (player count changed)
    io.emit('roomUpdated', {
        id: room.id,
        name: room.name,
        currentPlayerCount: room.players.size,
        maxPlayers: room.maxPlayers,
        prizeAmount: room.prizeAmount
    });
  });


  // Listen for a client indicating they are ready to play (MODIFIED FOR ROOMS)
  socket.on('playerIsReadyToPlay', async (data) => {
    const { roomId, username, cards, totalCost } = data; // username might be redundant if already in socketUserMap
    const userMapData = socketUserMap.get(socket.id);

    if (!userMapData || userMapData.roomId !== roomId) {
        console.error(`SERVER: playerIsReadyToPlay from ${socket.id} for room ${roomId}, but socket not in this room or userMapData missing.`);
        socket.emit('startGameFailed', { roomId, reason: 'internal_error_room_mismatch' });
        return;
    }
    const actualUsername = userMapData.username; // Use username from socketUserMap for security

    const room = gameRooms.get(roomId);
    if (!room) {
        console.error(`SERVER: playerIsReadyToPlay for non-existent room ${roomId} by ${actualUsername}.`);
        socket.emit('startGameFailed', { roomId, reason: 'room_not_found' });
        return;
    }

    if (room.isGameRunning) {
      console.log(`SERVER: Player ${actualUsername} (${socket.id}) tried to ready up for room ${roomId} while game is running. Ignoring.`);
      socket.emit('startGameFailed', { roomId, reason: 'game_already_running' });
      return;
    }

    if (!actualUsername) { // Should be caught by userMapData check, but as a fallback
      console.error(`SERVER: playerIsReadyToPlay event received without username from socket ${socket.id} for room ${roomId}. Ignoring.`);
      socket.emit('startGameFailed', { roomId, reason: 'internal_error_no_username' });
      return;
    }
    if (typeof totalCost === 'undefined' || totalCost < 0) {
      console.error(`SERVER: playerIsReadyToPlay event received for ${actualUsername} in room ${roomId} with invalid totalCost: ${totalCost}. Ignoring.`);
      socket.emit('startGameFailed', { roomId, reason: 'internal_error_invalid_cost' });
      return;
    }
    if (totalCost > 0 && (!cards || Object.keys(cards).length === 0)) {
        console.error(`SERVER: Player ${actualUsername} (${socket.id}) in room ${roomId} reported totalCost > 0 but sent no card data. Ignoring.`);
        socket.emit('startGameFailed', { roomId, reason: 'no_card_data_with_cost' });
        return;
    }

    const playerInRoom = room.players.get(socket.id);
    if (!playerInRoom) {
        console.error(`SERVER: Player ${actualUsername} (${socket.id}) not found in room ${roomId} player list. Cannot ready up.`);
        socket.emit('startGameFailed', { roomId, reason: 'player_not_in_room_list' });
        return;
    }

    // --- Charge player ---
    try {
        const dbPlayer = await Player.findOne({ name: actualUsername }); // Or find by piUid if more reliable
        if (!dbPlayer) {
            console.error(`SERVER: Player ${actualUsername} not found in DB for room ${roomId}. Cannot charge.`);
            socket.emit('startGameFailed', { roomId, reason: 'player_not_found_db' });
            return;
        }

        if (dbPlayer.balance < totalCost) {
            console.log(`SERVER: Insufficient funds for player ${actualUsername} in room ${roomId}. Balance: ${dbPlayer.balance}, Cost: ${totalCost}`);
            socket.emit('startGameFailed', { roomId, reason: 'insufficient_funds_server_check' });
            return;
        }

        dbPlayer.balance -= totalCost;
        await dbPlayer.save();
        console.log(`SERVER: Successfully deducted ${totalCost} from ${actualUsername} for room ${roomId}. New balance: ${dbPlayer.balance}`);
        socket.emit('balanceUpdated', { newBalance: dbPlayer.balance }); // Notify player of their new balance

        // Player is successfully charged, update their state in the room
        playerInRoom.cards = cards; // Store selected cards
        playerInRoom.hasPaid = true; // Mark as paid for this game instance
        room.readyPlayerCount = (room.readyPlayerCount || 0) + 1;

        console.log(`SERVER: Player ${actualUsername} (${socket.id}) is ready in room ${roomId}. Cost: ${totalCost}. Ready players in room: ${room.readyPlayerCount}/${room.minPlayersToStart}`);
        io.to(roomId).emit('playerReadyInRoom', { roomId, username: actualUsername, readyCount: room.readyPlayerCount, playerCount: room.players.size });


        // --- Attempt to start game if enough players are ready in this room ---
        if (!room.isGameRunning && room.readyPlayerCount >= room.minPlayersToStart) {
            console.log(`SERVER: Attempting to start game in room ${roomId}. Ready players: ${room.readyPlayerCount}`);
            room.isGameRunning = true;
            room.drawnNumbers = []; // Reset drawn numbers for the new game

            // Reset markedThisTurn for all players in the room
            room.players.forEach(p => {
                p.markedThisTurn = false;
                p.markedCells = {}; // Also reset marked cells for the new game
                // Optionally save cards to DB if they are per-game and not persistent on player profile
                 if (p.cards && Object.keys(p.cards).length > 0) {
                    Player.findOneAndUpdate(
                        { name: p.username }, // or piUid
                        { $set: { cards: p.cards, markedCells: {} } },
                        { upsert: false }
                    ).catch(err => console.error(`SERVER: Error saving cards for ${p.username} to DB for room ${roomId}:`, err));
                }
            });

            io.to(roomId).emit('gameStarted', { roomId });
            console.log(`SERVER: Game started in room ${roomId} with ${room.readyPlayerCount} players.`);

            room.gameInterval = setInterval(() => {
                if (!room.isGameRunning) { // Safety check
                    clearInterval(room.gameInterval);
                    return;
                }
                room.players.forEach(p => { p.markedThisTurn = false; });

                const newNumber = drawUniqueNumber(room); // Pass the room object
                if (newNumber !== null) {
                    console.log(`SERVER (Room ${roomId}): Drawing number:`, newNumber);
                    io.to(roomId).emit('newNumber', { roomId, number: newNumber });
                } else {
                    console.log(`SERVER (Room ${roomId}): Game ended - all numbers drawn or max reached.`);
                    clearInterval(room.gameInterval);
                    room.gameInterval = null;
                    io.to(roomId).emit('gameEnded', { roomId, reason: 'All numbers drawn' });
                    console.log(`SERVER (Room ${roomId}): Waiting ${POST_WIN_DELAY_MS}ms before reset...`);
                    setTimeout(() => resetRoomGame(roomId), POST_WIN_DELAY_MS);
                }
            }, DRAW_INTERVAL_MS);
        } else if (room.isGameRunning) {
            // Game already started, new player just readied up mid-game (if allowed)
            // Or, this is a player who readied up after game started (should be handled by 'game_already_running' check earlier)
            console.log(`SERVER: Player ${actualUsername} readied up in room ${roomId}, but game already running. They will join next round if applicable.`);
        } else {
             console.log(`SERVER (Room ${roomId}): Waiting for more players. ${room.readyPlayerCount}/${room.minPlayersToStart} ready.`);
        }

    } catch (err) {
        console.error(`SERVER: Error processing player ${actualUsername} for game start in room ${roomId}:`, err);
        socket.emit('startGameFailed', { roomId, reason: 'charge_processing_error' });
        // Do not increment readyPlayerCount if charge failed
    }
  });

  socket.on('declareBingo', async (data) => { // MODIFIED FOR ROOMS
    const { roomId } = data; // Client must send roomId
    const userMapData = socketUserMap.get(socket.id);

    if (!userMapData || userMapData.roomId !== roomId) {
        console.error(`SERVER: declareBingo from ${socket.id} for room ${roomId}, but socket not in this room or userMapData missing.`);
        return;
    }
    const username = userMapData.username;
    const room = gameRooms.get(roomId);

    if (room && room.isGameRunning) {
      const winnerInfo = room.players.get(socket.id);
      const winnerName = winnerInfo ? winnerInfo.username : `Player_${socket.id.substring(0, 4)}`;
      console.log(`Bingo declared in room ${roomId} by ${winnerName} (${socket.id})!`, data);
      
      let newBalanceForWinner = null;
      if (username) {
        try {
          const dbPlayer = await Player.findOne({ name: username }); // or piUid
          if (dbPlayer) {
            dbPlayer.balance += room.prizeAmount; // Use room's prize amount
            dbPlayer.wins += 1;
            await dbPlayer.save();
            newBalanceForWinner = dbPlayer.balance;
            console.log(`SERVER (Room ${roomId}): Awarded ${room.prizeAmount} to ${username}. New balance: ${newBalanceForWinner}, Wins: ${dbPlayer.wins}`);
            socket.emit('balanceUpdated', { newBalance: newBalanceForWinner });
          } else {
            console.error(`SERVER (Room ${roomId}): Could not find player ${username} in DB to award prize.`);
          }
        } catch (err) {
          console.error(`SERVER (Room ${roomId}): Error updating balance for bingo winner ${username}:`, err);
        }
      }

      if(room.gameInterval) clearInterval(room.gameInterval);
      room.gameInterval = null;
      room.isGameRunning = false;
      io.to(roomId).emit('gameWon', {
          roomId,
          winnerId: socket.id,
          winnerName: winnerName,
          newBalance: newBalanceForWinner,
          prizeAmount: room.prizeAmount
      });
      console.log(`SERVER (Room ${roomId}): Waiting ${POST_WIN_DELAY_MS}ms before reset...`);
      setTimeout(() => resetRoomGame(roomId), POST_WIN_DELAY_MS);
    } else {
        console.log(`SERVER: Bingo declared for room ${roomId} by ${username}, but game not running or room not found.`);
    }
  });

   socket.on('requestPlayerData', async (data) => { // MODIFIED FOR ROOMS
       const { username, roomId } = data; // Client should send roomId if trying to restore for a specific room
       const userMapData = socketUserMap.get(socket.id);
       const actualUsername = userMapData?.username || username; // Prefer username from map if available

       console.log(`SERVER: Received requestPlayerData for username: '${actualUsername}' from socket: ${socket.id}, for room: ${roomId}`);

       if (!actualUsername) {
           console.log(`SERVER: Cannot restore data for socket ${socket.id}, no username provided or found.`);
           return;
       }

       const targetRoomId = userMapData?.roomId || roomId;
       const room = targetRoomId ? gameRooms.get(targetRoomId) : null;

       if (room) {
           const playerDataInRoom = room.players.get(socket.id); // Check if this socket is already in the room's player list
           if (playerDataInRoom && playerDataInRoom.username.toLowerCase() === actualUsername.toLowerCase()) {
               console.log(`SERVER: Found active player data for '${actualUsername}' in room ${targetRoomId}. Sending restorePlayerData.`);
               socket.emit('restorePlayerData', {
                   roomId: targetRoomId,
                   cards: playerDataInRoom.cards,
                   markedCells: playerDataInRoom.markedCells
               });
               return;
           }
       }
        
        // If not found in an active room session for this socket, try DB (more general restoration)
        // This part might need refinement: should restoring from DB automatically put them in a room?
        // For now, it just sends card/marked cell data. Joining a room is a separate step.
        try {
            const playerFromDb = await Player.findOne({ name: { $regex: new RegExp(`^${actualUsername}$`, 'i') } });
            if (playerFromDb && playerFromDb.cards && Object.keys(playerFromDb.cards).length > 0) {
                console.log(`SERVER: Found player data for '${actualUsername}' in DB. Restoring cards and marked cells (not room specific).`);
                // If restoring, ensure socketUserMap is updated
                if (userMapData) {
                    userMapData.username = playerFromDb.name; // Ensure consistency
                    userMapData.piUid = playerFromDb.piUid;
                    socketUserMap.set(socket.id, userMapData);
                } else {
                    socketUserMap.set(socket.id, { username: playerFromDb.name, piUid: playerFromDb.piUid, roomId: null });
                }

                socket.emit('restorePlayerData', {
                    // No roomId here, as this is a general restore, not specific to an active game session in a room
                    cards: playerFromDb.cards,
                    markedCells: playerFromDb.markedCells || {}
                });
            } else {
                console.log(`SERVER: Username '${actualUsername}' not found in active room session for this socket or DB with cards.`);
            }
        } catch (err) {
            console.error(`SERVER: Error retrieving player data from DB for ${actualUsername}:`, err);
        }
   });

   socket.on('checkAndMarkNumberRequest', async (data) => { // MODIFIED FOR ROOMS
        const { number: requestedNumber, cellId, roomId } = data;
        const userMapData = socketUserMap.get(socket.id);

        if (!userMapData || userMapData.roomId !== roomId) {
            console.log(`SERVER: Mark request from ${socket.id} for room ${roomId}, but socket not in this room or userMapData missing.`);
            return;
        }
        const username = userMapData.username;
        const room = gameRooms.get(roomId);

        if (!room || !room.isGameRunning || !username || !room.players.has(socket.id)) {
            console.log(`SERVER: Ignoring mark request for room ${roomId} - GameRunning: ${room?.isGameRunning}, User: ${username}, PlayerInRoom: ${room?.players.has(socket.id)}`);
            return;
        }

        const playerData = room.players.get(socket.id);
        if (playerData.markedThisTurn) {
            console.log(`SERVER (Room ${roomId}): Player ${username} already marked this turn. Ignoring request for ${requestedNumber}.`);
            return;
        }

        if (!room.drawnNumbers.includes(requestedNumber)) {
            console.log(`SERVER (Room ${roomId}): Player ${username} tried to mark ${requestedNumber}, but it hasn't been drawn. Drawn: [${room.drawnNumbers.join(', ')}]`);
            return;
        }

        if (!cellId || typeof cellId !== 'string' || !cellId.includes('-')) {
             console.log(`SERVER (Room ${roomId}): Player ${username} sent invalid cellId format: ${cellId}. Ignoring mark request for ${requestedNumber}.`);
             return;
        }

        if (playerData.markedCells[cellId]) {
             console.log(`SERVER (Room ${roomId}): Player ${username} tried to mark cell ${cellId} (${requestedNumber}), but it's already marked.`);
             return;
        }

        const [cardKeyPrefix, simpleCellId] = cellId.split('-');
        const cardNum = cardKeyPrefix.replace('card','');
        const cardToCheck = playerData.cards?.[`card${cardNum}`];
        const col = simpleCellId?.[0];
        const row = parseInt(simpleCellId?.[1]) - 1;

        if (!cardToCheck || !col || isNaN(row) || cardToCheck[`col${col}`]?.[row] !== requestedNumber) {
             console.log(`SERVER (Room ${roomId}): Player ${username} mark request mismatch. Cell ${cellId} does not contain ${requestedNumber} according to server data.`);
             // console.log("Card data on server:", cardToCheck); // For debugging
             return;
        }

        console.log(`SERVER (Room ${roomId}): Approving mark for player ${username}, number ${requestedNumber}, cell ${cellId}`);
        playerData.markedCells[cellId] = true;
        playerData.markedThisTurn = true;
        // No need to activeGamePlayers.set, as playerData is a reference to the object in room.players

        // Persist marked cell to DB (optional, depends on desired persistence)
        try {
            await Player.findOneAndUpdate(
                { name: username }, // or piUid
                { $set: { [`markedCells.${cellId}`]: true } }, // This might need to be room-specific if markedCells are not global
                { new: true }
            );
            // console.log(`SERVER (Room ${roomId}): Saved marked cell ${cellId} for ${username} to DB.`);
        } catch (err) {
            console.error(`SERVER (Room ${roomId}): Error saving marked cell for ${username} to DB:`, err);
        }

        socket.emit('markNumberApproved', { roomId, number: requestedNumber, cellId: cellId });

        const markedUniqueIds = Object.keys(playerData.markedCells);
        const strippedWinningNumbers = markedUniqueIds.map(id => id.substring(id.indexOf('-') + 1));
      
        let bingoResult = { isBingo: false };
        // Assuming WinningPatterns is a class with static methods or an instance available
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkHorizontalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkVerticalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkDiagonalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkCornersPattern(strippedWinningNumbers);
      
        if (bingoResult.isBingo) {
        	console.log(`SERVER (Room ${roomId}): Bingo detected for player ${username}! Pattern: ${bingoResult.patternType}`);
        	
        	let newBalanceForWinner = null;
        	 try {
        	   const dbPlayer = await Player.findOne({ name: username }); // or piUid
        	   if (dbPlayer) {
        	     dbPlayer.balance += room.prizeAmount; // Use room's prize amount
        	     dbPlayer.wins += 1;
        	     await dbPlayer.save();
        	     newBalanceForWinner = dbPlayer.balance;
        	     console.log(`SERVER (Room ${roomId}): Awarded ${room.prizeAmount} to ${username}. New balance: ${newBalanceForWinner}, Wins: ${dbPlayer.wins}`);
        	     socket.emit('balanceUpdated', { newBalance: newBalanceForWinner });
        	   } else {
        	     console.error(`SERVER (Room ${roomId}): Could not find player ${username} in DB to award prize for detected bingo.`);
        	   }
        	 } catch (err) {
        	   console.error(`SERVER (Room ${roomId}): Error updating balance for detected bingo winner ${username}:`, err);
        	 }

        	if(room.gameInterval) clearInterval(room.gameInterval);
        	room.gameInterval = null;
        	room.isGameRunning = false;
      
        	const cardKeyForWinningCells = cellId.substring(0, cellId.indexOf('-') + 1);
        	const winningCellsWithPrefix = bingoResult.winningCells.map(cell => cardKeyForWinningCells + cell);
      
        	io.to(roomId).emit('gameWon', {
        		roomId,
        		winnerId: socket.id,
        		winnerName: username,
        		winningPattern: bingoResult.patternType,
        		winningCells: winningCellsWithPrefix,
        	    newBalance: newBalanceForWinner,
                prizeAmount: room.prizeAmount
        	});
        	setTimeout(() => resetRoomGame(roomId), POST_WIN_DELAY_MS);
        }
   });
 
   socket.on('sendRoomMessage', (data) => {
     const { roomId, message } = data;
     const userMapData = socketUserMap.get(socket.id);
     const username = userMapData?.username || 'Anonymous'; // Fallback username
 
     if (!roomId || !message) {
       console.log(`SERVER: Invalid message data from ${username} (${socket.id}). RoomId: ${roomId}, Msg: ${message}`);
       return;
     }
 
     const room = gameRooms.get(roomId);
     if (!room || !room.players.has(socket.id)) {
       console.log(`SERVER: User ${username} (${socket.id}) tried to send message to room ${roomId} but is not in it.`);
       // Optionally emit an error back to the sender
       // socket.emit('messageSendError', { roomId, reason: 'Not a member of this room.' });
       return;
     }
 
     // Basic sanitization: escape HTML to prevent XSS
     // A more robust library like 'xss-filters' or 'dompurify' (if rendering HTML on client) would be better for production.
     const sanitizedMessage = message.replace(/</g, "<").replace(/>/g, ">");
 
     const messageData = {
       username: username,
       message: sanitizedMessage,
       timestamp: new Date().toISOString(),
       socketId: socket.id // Optionally send socketId if client needs to identify own messages
     };
 
     console.log(`SERVER: Broadcasting message in room ${roomId} from ${username}: ${sanitizedMessage}`);
     io.to(roomId).emit('newRoomMessage', { roomId, ...messageData });
   });
 
 
   socket.on('disconnect', () => {
     const userMapData = socketUserMap.get(socket.id);
     const username = userMapData?.username;
    const roomId = userMapData?.roomId;
    console.log(`SERVER: User ${username || 'Unknown'} (${socket.id}) disconnected from room ${roomId || 'N/A'}.`);

    if (roomId && gameRooms.has(roomId)) {
        const room = gameRooms.get(roomId);
        const playerWasInRoom = room.players.delete(socket.id);

        if (playerWasInRoom) {
            console.log(`SERVER: Player ${username} removed from room ${roomId}. Players left: ${room.players.size}`);
            io.to(roomId).emit('playerLeftRoom', { socketId: socket.id, username: username, playerCount: room.players.size });

            // Update room list for everyone (player count changed)
            io.emit('roomUpdated', {
                id: room.id,
                name: room.name,
                currentPlayerCount: room.players.size,
                maxPlayers: room.maxPlayers,
                prizeAmount: room.prizeAmount
            });

            if (room.players.size === 0 && room.id !== 'default_lobby') { // Don't delete a potential default lobby
                console.log(`SERVER: Room ${roomId} is empty. Removing room.`);
                gameRooms.delete(roomId);
                io.emit('roomClosed', { roomId }); // Notify clients room is gone
            } else if (room.isGameRunning && room.players.size < room.minPlayersToStart) {
                // Optional: Stop game if player count drops below minimum during a game
                console.log(`SERVER: Player count in room ${roomId} dropped below minimum. Stopping game.`);
                if(room.gameInterval) clearInterval(room.gameInterval);
                room.gameInterval = null;
                room.isGameRunning = false;
                io.to(roomId).emit('gameEnded', { roomId, reason: 'Not enough players' });
                setTimeout(() => resetRoomGame(roomId), POST_WIN_DELAY_MS / 2); // Quicker reset
            } else if (socket.id === room.hostSocketId && room.players.size > 0) {
                // Host left, assign a new host (e.g., the longest connected player)
                const newHostEntry = room.players.entries().next().value;
                if (newHostEntry) {
                    const [newHostSocketId, newHostPlayerData] = newHostEntry;
                    room.hostSocketId = newHostSocketId;
                    console.log(`SERVER: Host ${username} left room ${roomId}. New host: ${newHostPlayerData.username} (${newHostSocketId})`);
                    io.to(roomId).emit('newHost', { roomId, newHostSocketId, newHostUsername: newHostPlayerData.username });
                }
            }
        }
    }
    socketUserMap.delete(socket.id);

    // Global server empty check (less relevant with rooms, but can be kept for full server shutdown logic if needed)
    if (io.engine.clientsCount === 0 && gameRooms.size === 0) { // Only reset if all rooms are also gone
        console.log('SERVER: Server completely empty, all rooms closed. Full reset (if any global state existed).');
        // Any global cleanup if necessary
    }
  });
});

server.listen(8000, () => {
  console.log(`Server listening on port 8000`);

  process.once('SIGUSR2', async function () {
    await db.gracefulShutdown('nodemon restart');
    process.kill(process.pid, 'SIGUSR2');
  });

  process.on('SIGINT', async function () {
    await db.gracefulShutdown('app termination');
    process.exit(0);
  });
});
