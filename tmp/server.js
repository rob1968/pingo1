const express = require('express');
const bodyParser = require('body-parser');
const passport = require('passport');
const path = require('path');
const http = require('http'); // Add http module
const { Server } = require("socket.io"); // Add socket.io

require('dotenv').config();
const db = require('./bingo-api/models/db'); // Import db to access gracefulShutdown
const { WinningPatterns } = require('./bingo-api/utils/winning-patterns'); // Import server-side patterns
require('./bingo-api/config/passport');

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

// Serve static assets from the 'build' directory
app.use('/build', express.static(path.join(__dirname, 'build')));

// Serve config.json from the root
app.get('/config.json', function(req, res) {
	res.sendFile(path.join(__dirname, 'config.json'));
});

app.use(function(req, res) {
	res.sendFile(path.join(__dirname, '/', 'pi_welcome.html'));
});

app.use(function (err, req, res) {
	if (err.name === 'UnauthorizedError') {
		res.status(401);
		res.json({"message" : err.name + ": " + err.message});
	}
});

// --- Game State & Logic ---
const BINGO_NUMBERS = Array.from({ length: 75 }, (_, i) => i + 1); // Numbers 1-75
let drawnNumbers = [];
let isGameRunning = false;
let gameInterval = null;
const DRAW_INTERVAL_MS = 4000; // Draw every 7 seconds
const MIN_PLAYERS_TO_START = 1; // Minimum players needed
const MAX_NUMBERS = 10; // Or configure based on game rules
const POST_WIN_DELAY_MS = 5000; // Delay after win/end before reset

function drawUniqueNumber() {
  if (drawnNumbers.length >= MAX_NUMBERS) {
    return null; // No more numbers to draw
  }
  let num;
  do {
    const randomIndex = Math.floor(Math.random() * BINGO_NUMBERS.length);
    num = BINGO_NUMBERS[randomIndex];
  } while (drawnNumbers.includes(num));
  drawnNumbers.push(num);
  return num;
}

function resetGame() {
    console.log("Resetting game state...");
    clearInterval(gameInterval); // Clear interval just in case
    gameInterval = null;
    isGameRunning = false;
    drawnNumbers = [];
    readyPlayers.clear();
    // Notify clients that the game is reset and ready for players
    io.emit('gameState', { isRunning: isGameRunning, drawn: drawnNumbers, readyCount: readyPlayers.size });
    io.emit('gameReset'); // Specific event for reset UI changes
}

// --- End Game State & Logic ---


// --- Socket.IO Setup ---
const server = http.createServer(app); // Create HTTP server from Express app
const io = new Server(server, {
  cors: {
    origin: ["https://bingo.pihappy.me", "http://bingo.pihappy.me", "http://localhost:8000"], // Allow connections from the frontend origin
    methods: ["GET", "POST"]
  }
});

let readyPlayers = new Map(); // Stores { username: '...', cards: {...} } keyed by socket.id (used BEFORE game starts)
let activeGamePlayers = new Map(); // Stores { socketId: '...', cards: {...}, markedCells: {}, markedThisTurn: false } keyed by username
let socketUserMap = new Map(); // Maps socket.id -> username for quick lookup

io.on('connection', (socket) => {
	socketUserMap.set(socket.id, null); // Track socket, initially unknown user
  console.log('SERVER: User connected:', socket.id);

  // Prepare initial game state data (basic info only)
  let initialGameState = {
      isRunning: isGameRunning,
      drawnNumbers: drawnNumbers,
      // Send active player count if running, otherwise ready count
      playerCount: isGameRunning ? activeGamePlayers.size : readyPlayers.size
  };
   // Send basic game state immediately - client will request player-specific data if needed
  socket.emit('gameState', initialGameState);
  console.log("SERVER: Emitted initial gameState:", initialGameState);


  // Listen for a client wanting to start the game
  socket.on('startGame', (data) => {
    const username = data?.username || `Player_${socket.id.substring(0, 4)}`; // Get username or generate one
    const playerCards = data?.cards; // Get card data

    if (!playerCards) {
        console.error(`Player ${username} (${socket.id}) tried to start game without sending card data. Ignoring.`);
        // Optionally send an error back to the client
        // socket.emit('startGameError', { message: 'Card data missing.' });
        return;
    }

    if (!isGameRunning && !readyPlayers.has(socket.id)) {
      console.log(`Player ${username} (${socket.id}) is ready with cards.`);
      readyPlayers.set(socket.id, { username: username, cards: playerCards }); // Store username AND cards
      io.emit('playerReady', { count: readyPlayers.size }); // Notify clients of ready count

      // Check if enough players are ready
      if (readyPlayers.size >= MIN_PLAYERS_TO_START) {
        console.log(`SERVER: Starting game with ${readyPlayers.size} players...`);
        isGameRunning = true;
        drawnNumbers = []; // Reset drawn numbers
        activeGamePlayers.clear(); // Clear previous active players

        // Transfer ready players to active game players, keyed by username
        readyPlayers.forEach((playerData, socketId) => {
            const username = playerData.username;
            if (username && playerData.cards) {
                 console.log(`SERVER: Moving player ${username} (${socketId}) to active game.`);
                 activeGamePlayers.set(username, {
                     socketId: socketId,
                     cards: playerData.cards,
                     markedCells: {}, // Initialize empty marked cells
                     markedThisTurn: false // Initialize flag
                 });
                 // Update socketUserMap now that we know the username for this socket
                 socketUserMap.set(socketId, username);
            } else {
                 console.warn(`SERVER: Invalid data for player ${socketId} in readyPlayers, cannot move to active game.`);
            }
        });
        readyPlayers.clear(); // Clear ready list now game has started

        io.emit('gameStarted'); // Notify all clients game has begun

        // Start drawing numbers
        gameInterval = setInterval(() => {
          // Reset flags before drawing
          activeGamePlayers.forEach(playerData => {
              playerData.markedThisTurn = false;
          });

          const newNumber = drawUniqueNumber();
          if (newNumber !== null) {
            console.log('Drawing number:', newNumber);
            io.emit('newNumber', newNumber); // Broadcast new number
          } else {
            // Game ends - all numbers drawn
            console.log('Game ended - all numbers drawn.');
            clearInterval(gameInterval); // Stop drawing
            gameInterval = null;
            io.emit('gameEnded', { reason: 'All numbers drawn' });
            console.log(`Waiting ${POST_WIN_DELAY_MS}ms before reset...`);
            setTimeout(resetGame, POST_WIN_DELAY_MS); // Reset state after delay
          }
        }, DRAW_INTERVAL_MS);
      } else {
        console.log(`Waiting for more players. ${readyPlayers.size}/${MIN_PLAYERS_TO_START} ready.`);
      }
    }
  });

  // Listen for a client declaring Bingo
  socket.on('declareBingo', (data) => {
    // Basic implementation: First bingo wins
    // TODO: Add verification logic here (check card against drawnNumbers)
    if (isGameRunning) {
      const winnerInfo = readyPlayers.get(socket.id);
      const winnerName = winnerInfo ? winnerInfo.username : `Player_${socket.id.substring(0, 4)}`;
      console.log(`Bingo declared by ${winnerName} (${socket.id})!`, data);
      clearInterval(gameInterval); // Stop drawing numbers
      gameInterval = null;
      // isGameRunning = false; // REMOVED: Don't set to false until resetGame is called
      io.emit('gameWon', { winnerId: socket.id, winnerName: winnerName }); // Broadcast winner name
      console.log(`Waiting ${POST_WIN_DELAY_MS}ms before reset...`);
      // Corrected: Call resetGame inside the setTimeout callback
      setTimeout(() => {
          resetGame();
      }, POST_WIN_DELAY_MS);
    }
  });

   // Listen for client identifying itself to potentially restore data
   socket.on('requestPlayerData', (data) => {
       const requestedUsername = data?.username;
       console.log(`SERVER: Received requestPlayerData for username: '${requestedUsername}' from socket: ${socket.id}`);

       if (isGameRunning && requestedUsername) {
           let foundPlayerData = null;
           let foundUsernameKey = null;

           // Case-insensitive lookup
           const requestedUsernameLower = requestedUsername.toLowerCase();
           for (const [keyUsername, playerData] of activeGamePlayers.entries()) {
               if (keyUsername.toLowerCase() === requestedUsernameLower) {
                   foundPlayerData = playerData;
                   foundUsernameKey = keyUsername; // Store the original key
                   break;
               }
           }

           if (foundPlayerData) {
               // Update socket ID in case it changed on reconnect
               foundPlayerData.socketId = socket.id;
               activeGamePlayers.set(foundUsernameKey, foundPlayerData); // Update map with new socket ID using original key

               console.log(`SERVER: Found active player data for '${foundUsernameKey}' (case-insensitive match for '${requestedUsername}'). Sending restorePlayerData.`);
               socket.emit('restorePlayerData', { cards: foundPlayerData.cards });
           } else {
                console.log(`SERVER: Game is running, but username '${requestedUsername}' not found in activeGamePlayers map (case-insensitive). Keys: [${Array.from(activeGamePlayers.keys()).join(', ')}]`);
           }
       } else {
           console.log(`SERVER: Cannot restore data. Game running: ${isGameRunning}, Username provided: ${!!requestedUsername}`);
       }
   });

   // Listen for client trying to mark a number
   socket.on('checkAndMarkNumberRequest', (data) => {
        const requestedNumber = data?.number;
        const cellId = data?.cellId; // Optional: use if needed for validation/response
        const username = socketUserMap.get(socket.id); // Get username from map

        console.log(`SERVER: Received checkAndMarkNumberRequest from user ${username} (${socket.id}) for number ${requestedNumber}`);

        if (!isGameRunning || !username || !activeGamePlayers.has(username)) {
            console.log(`SERVER: Ignoring mark request - GameRunning: ${isGameRunning}, User: ${username}, Active: ${activeGamePlayers.has(username)}`);
            return;
        }

        const playerData = activeGamePlayers.get(username);
        if (playerData.markedThisTurn) {
            console.log(`SERVER: Player ${username} already marked this turn. Ignoring request for ${requestedNumber}.`);
            return; // Already marked for this drawn number
        }

        if (!drawnNumbers.includes(requestedNumber)) {
            console.log(`SERVER: Player ${username} tried to mark ${requestedNumber}, but it hasn't been drawn. Drawn: [${drawnNumbers.join(', ')}]`);
            return; // Number hasn't been drawn
        }

        // Client now sends unique cellId like "card1-35"
        const uniqueCellId = data?.cellId;

        // Basic validation of the received ID format
        if (!uniqueCellId || typeof uniqueCellId !== 'string' || !uniqueCellId.includes('-')) {
             console.log(`SERVER: Player ${username} sent invalid cellId format: ${uniqueCellId}. Ignoring mark request for ${requestedNumber}.`);
             return; // Invalid ID format
        }

        // Check if this specific unique cell ID is already marked
        if (playerData.markedCells[uniqueCellId]) {
             console.log(`SERVER: Player ${username} tried to mark cell ${uniqueCellId} (${requestedNumber}), but it's already marked.`);
             return; // Cell already marked
        }

        // Optional: Double-check if the number actually exists at that cell ID on the server's card data
        const [cardKeyPrefix, simpleCellId] = uniqueCellId.split('-');
        const cardNum = cardKeyPrefix.replace('card','');
        const cardToCheck = playerData.cards?.[`card${cardNum}`];
        const col = simpleCellId?.[0];
        const row = parseInt(simpleCellId?.[1]) - 1;
        if (!cardToCheck || !col || isNaN(row) || cardToCheck[`col${col}`]?.[row] !== requestedNumber) {
             console.log(`SERVER: Player ${username} mark request mismatch. Cell ${uniqueCellId} does not contain ${requestedNumber} according to server data.`);
             // Decide whether to reject or trust the client click entirely. For now, reject.
             return;
        }


        // --- Mark is valid ---
        console.log(`SERVER: Approving mark for player ${username}, number ${requestedNumber}, cell ${uniqueCellId}`);
        playerData.markedCells[uniqueCellId] = true; // Mark unique cell ID in server state
        playerData.markedThisTurn = true; // Set flag for this turn
        activeGamePlayers.set(username, playerData); // Update map

        // Notify client, sending back the unique ID
        socket.emit('markNumberApproved', { number: requestedNumber, cellId: uniqueCellId });

        // --- Check for Bingo (Server-side) ---
        // Get all marked unique IDs for this player
        const markedUniqueIds = Object.keys(playerData.markedCells);
        // Strip the cardKey prefix for the pattern checker (e.g., "card1-11" -> "11")
        const strippedWinningNumbers = markedUniqueIds.map(id => id.substring(id.indexOf('-') + 1));
      
        let bingoResult = { isBingo: false }; // Default result
      
        // Check patterns sequentially, stop when one is found
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkHorizontalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkVerticalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkDiagonalPattern(strippedWinningNumbers);
        if (!bingoResult.isBingo) bingoResult = WinningPatterns.checkCornersPattern(strippedWinningNumbers);
        // Add other patterns checks here if needed
      
        if (bingoResult.isBingo) {
        	console.log(`SERVER: Bingo detected for player ${username}! Pattern: ${bingoResult.patternType}`);
        	clearInterval(gameInterval);
        	gameInterval = null;
        	isGameRunning = false; // Game stops on win
      
        	// Add cardKey prefix back to winningCells for client-side identification
        	const cardKeyPrefix = uniqueCellId.substring(0, uniqueCellId.indexOf('-') + 1); // e.g., "card1-"
        	const winningCellsWithPrefix = bingoResult.winningCells.map(cell => cardKeyPrefix + cell);
      
        	// Emit gameWon event with winner info AND pattern details
        	io.emit('gameWon', {
        		winnerId: socket.id,
        		winnerName: username,
        		winningPattern: bingoResult.patternType, // e.g., 'horizontal', 'corners'
        		winningCells: winningCellsWithPrefix   // e.g., ['card1-11', 'card1-12', ...]
        	});
        	setTimeout(resetGame, POST_WIN_DELAY_MS);
        }
   });


  socket.on('disconnect', () => {
 socketUserMap.delete(socket.id); // Remove user from lookup map
    console.log('SERVER: User disconnected:', socket.id);

    // Find username associated with this socket ID in active players
    let disconnectedUsername = null;
    activeGamePlayers.forEach((playerData, username) => {
        if (playerData.socketId === socket.id) {
            disconnectedUsername = username;
        }
    });

    // If the disconnected user was an active player, remove them
    if (disconnectedUsername) {
        console.log(`SERVER: Active player ${disconnectedUsername} disconnected.`);
        activeGamePlayers.delete(disconnectedUsername);
        // Notify remaining players about the count change? Optional.
        // io.emit('playerLeft', { username: disconnectedUsername, count: activeGamePlayers.size });
    }

    // Remove from ready list if they were waiting
    const wasReady = readyPlayers.delete(socket.id);
    if (wasReady) {
        io.emit('playerReady', { count: readyPlayers.size }); // Update ready count
    }

    // Log state before checking reset conditions
    console.log(`SERVER: State before reset check - isGameRunning: ${isGameRunning}, activeGamePlayers.size: ${activeGamePlayers.size}, readyPlayers.size: ${readyPlayers.size}, io.engine.clientsCount: ${io.engine.clientsCount}`);

    // Stop/Reset game ONLY if server becomes empty
    // Game continues even if active players drop below MIN_PLAYERS_TO_START
    if (io.engine.clientsCount === 0) {
        console.log('SERVER: Server empty, resetting state.');
        if (isGameRunning && gameInterval) {
             console.log('SERVER: Stopping game interval due to empty server.');
             clearInterval(gameInterval);
             gameInterval = null;
        }
        // Also clear active players if resetting due to empty server
        activeGamePlayers.clear();
        resetGame(); // resetGame already clears readyPlayers
    }
  });
});
// --- End Socket.IO Setup ---

server.listen(8888, () => {
  console.log(`Server listening on port 8888`);

  // Attach signal handlers *after* server starts listening
  // SIGUSR2 signal for nodemon restart
  process.once('SIGUSR2', async function () {
    await db.gracefulShutdown('nodemon restart');
    process.kill(process.pid, 'SIGUSR2'); // Trigger nodemon restart
  });

  // SIGINT signal for app termination (Ctrl+C)
  process.on('SIGINT', async function () {
    await db.gracefulShutdown('app termination');
    process.exit(0); // Exit process
  });
});
