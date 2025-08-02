import ApiController from '../API/api-controller';
import { io } from "socket.io-client";
import ViewManipulator from '../utils/view-manipulator';
import CardGenerator from '../card/card-generator';
import CardDrawer from '../card/card-drawer';
import Card from '../card/card';
import MarketCards from '../market-place/market-cards';
import Blower from '../blower/blower';
import Dauber from '../dauber/dauber';
import {EventsConsts} from '../events/events-consts';
import WinningDialog from '../winning/winning-dialog';
import FlyingPrize from '../winning/flying-prize';
import OrientationManager from '../utils/orientation-manager';
import LocalStorageService from '../local-storage/local-storage-service';

class Initializer {
  static socket = null;
  static dauberInstance = null;
  static cardDrawerInstance = null;
  static blowerInstance = null;
  static config = null;
  static winningDialogInstance = null;
  static orientationManagerInstance = null;
  static winPatternAnimInstances = {};

  static chatWrapper = null;
  static chatMessagesContainer = null;
  static chatMessagesList = null;
  static chatMessageInput = null;
  static sendChatMessageBtn = null;

  static currentRoomId = null;
  static currentRoomDetails = null;
  static availableRoomsList = [];
  static localPlayerProfile = null;
  static lastGameStateByRoom = new Map();
  static connectionAttemptTimeout = null;

  static initializeGameComponents() {
    if (!Initializer.config) {
      console.error("INITIALIZER: Config not loaded before initializing components.");
      return;
    }
    const conf = Initializer.config;
    Initializer.setTitle(conf.gameConf.appTitle);
    Initializer.winningDialogInstance = Initializer.addWinningDialog(conf.gameConf.winningDialog);
    new FlyingPrize();
    Initializer.setCardPrices(conf.gameConf.cardPrice);
    Initializer.addWinPatternAnimModule(conf.gameConf.winPatternsAnimModule);
    Initializer.attachEnoughBalanceListener(Initializer.addMarketPlace(conf.gameConf.marketCards), conf, document);
    Initializer.addStartButton(conf, Initializer.addMarketPlace(conf.gameConf.marketCards));
    Initializer.dauberInstance = Initializer.addDauber(conf);
    Initializer.orientationManagerInstance = new OrientationManager();
    Initializer.addLoginAndRegisterListeners();
    Initializer.addPiLoginButtonListener();
    Initializer.addRoomEventListeners();
    Initializer.addBingoListener();
    // Initialize Chat UI Elements first
    Initializer.chatWrapper = document.getElementById('chatWrapper');
    Initializer.chatMessagesContainer = document.getElementById('chatMessagesContainer');
    Initializer.chatMessagesList = document.getElementById('chatMessagesList');
    Initializer.chatMessageInput = document.getElementById('chatMessageInput');
    Initializer.sendChatMessageBtn = document.getElementById('sendChatMessageBtn');
    // Then add event listeners
    Initializer.addChatEventListeners();
   }

  static handlePostLogin() {
    console.log("INITIALIZER: handlePostLogin called.");
    Initializer.localPlayerProfile = LocalStorageService.currentUser();
    if (!Initializer.localPlayerProfile) {
        console.error("INITIALIZER: Post-login - User profile not found. Cannot proceed.");
        alert("Login error. Please try logging in again.");
        return;
    }
    console.log(`INITIALIZER: User profile loaded: ${JSON.stringify(Initializer.localPlayerProfile)}`);
    const userNameDisplay = document.getElementById('userNameDisplay');
    const userBalanceDisplay = document.getElementById('userBalanceDisplay');
    if (userNameDisplay) userNameDisplay.innerText = Initializer.localPlayerProfile.name;
    if (userBalanceDisplay) userBalanceDisplay.innerText = Initializer.localPlayerProfile.balance;

    // Dropdown menu logic
    const dropdownToggle = document.getElementById('userNameDisplay');
    const userProfileSection = document.getElementById('userProfile');
    if (dropdownToggle && userProfileSection) {
        const dropdownMenu = userProfileSection.querySelector('.dropdown-menu');
        if (dropdownMenu) {
            dropdownToggle.addEventListener('click', (event) => {
                event.stopPropagation(); // Prevent click from immediately closing due to document listener
                dropdownMenu.style.display = dropdownMenu.style.display === 'block' ? 'none' : 'block';
            });

            // Close dropdown if clicked outside
            document.addEventListener('click', (event) => {
                if (!dropdownToggle.contains(event.target) && !dropdownMenu.contains(event.target)) {
                    dropdownMenu.style.display = 'none';
                }
            });
        }
    }

    const connStatusMsg = document.getElementById('connectionStatusMsg');
    if (connStatusMsg) {
        connStatusMsg.innerText = 'INITIALIZER: Preparing to connect...';
        connStatusMsg.style.display = 'block';
    }

    if (!Initializer.socket || !Initializer.socket.connected) {
        if (connStatusMsg) connStatusMsg.innerText = 'INITIALIZER: Calling connectWebSocket()...';
        Initializer.connectWebSocket();
    } else {
        if (connStatusMsg) connStatusMsg.innerText = 'INITIALIZER: Already connected. Fetching room list...';
        Initializer.socket.emit('listRooms');
    }
  }

   static addLoginAndRegisterListeners() {
    const loginForm = document.querySelector('#loginForm');
    const registerForm = document.querySelector('#registerForm');
    const signInLink = document.querySelector('.sign-in-link a');
    const alertMsg = document.querySelector('#alertMsg');

    if (loginForm) {
      loginForm.addEventListener('submit', (event) => {
        event.preventDefault();
        ApiController.login();
      });
    } else {
      console.warn("INITIALIZER: Login form (#loginForm) not found.");
    }

    if (registerForm) {
      registerForm.addEventListener('submit', (event) => {
        event.preventDefault();
        ApiController.register();
      });
    } else {
      console.warn("INITIALIZER: Register form (#registerForm) not found.");
    }

    if (signInLink && loginForm && registerForm) {
      signInLink.addEventListener('click', (event) => {
        event.preventDefault();
        const isLoginFormVisible = loginForm.style.display !== 'none';
        if (isLoginFormVisible) {
          loginForm.style.display = 'none';
          registerForm.style.display = 'block';
          signInLink.innerHTML = '<span class="icon0-question-sign icon0-white"></span> Already have an account? Login here!';
        } else {
          loginForm.style.display = 'block';
          registerForm.style.display = 'none';
          signInLink.innerHTML = '<span class="icon0-question-sign icon0-white"></span> Don\'t have an account? Register here!';
        }
        if (alertMsg) {
          alertMsg.style.display = 'none';
        }
      });
    } else {
      console.warn("INITIALIZER: Sign-in link or forms not found for toggling.");
    }
   }

   static addPiLoginButtonListener() {
    const piLoginBtn = document.querySelector('#piLoginBtn');
    if (piLoginBtn) {
     if (typeof Pi !== 'undefined' && Pi.authenticate) {
      piLoginBtn.style.display = 'block';
      piLoginBtn.addEventListener('click', (event) => {
       event.preventDefault();
       ApiController.loginWithPi();
      });
     } else {
        console.warn("INITIALIZER: Pi SDK not detected, Pi Login button will remain hidden.");
     }
    } else {
      console.warn("INITIALIZER: Pi Login button (#piLoginBtn) not found.");
    }
   }

   static applyConfigurations(conf) {
    Initializer.config = conf;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', Initializer.initializeGameComponents);
    } else {
      Initializer.initializeGameComponents();
    }
  }

  static setTitle(appTitle) {
    document.querySelector('title').innerText = appTitle;
  }

  static addWinningDialog(isConfigured) {
    return isConfigured ? new WinningDialog('#winningDialogContainer') : undefined;
  }

  static setCardPrices(price) {
    return MarketCards.setCardPrices(price, document.querySelectorAll('.cards'));
  }

  static addWinPatternAnimModule(isConfigured) {
  	Initializer.winPatternAnimInstances = {};
  	let containerElement = null;
  	if (isConfigured) {
  		containerElement = document.querySelector('#winPatternsAnimModule');
  		if (containerElement) {
  				ViewManipulator.toggleVisibility(containerElement, false);
  		} else {
  			console.warn("INITIALIZER: Could not find container element #winPatternsAnimModule");
  		}
  	}
  	return containerElement;
  }

  static addStartButton(conf, elMarketPlace) {
    let readyUpBtn = document.querySelector('#readyUpBtn');
    if (conf.gameConf.mainGame && readyUpBtn) {
        readyUpBtn.disabled = true;
        readyUpBtn.innerText = 'SELECT CARDS & READY UP';
    }
    return readyUpBtn;
  }

  static attachEnoughBalanceListener(elMarketPlace, conf, document) {
    document.addEventListener(EventsConsts.ENOUGH_BALANCE, () => {});
  }

  static addMarketPlace(isConfigured) {
    const elMarketPlace = document.querySelector('#marketPlace');
    if (!isConfigured) {
      ViewManipulator.toggleVisibility(elMarketPlace, false);
    }
    return elMarketPlace
  }

  static buyCards(conf, container) {
    if (conf.gameConf.playingCards) {
      const cardGen = new CardGenerator(conf);
      const marketCards = new MarketCards(container);
      MarketCards.buyCards(Initializer.renderPurchasedCards(marketCards, cardGen), conf.gameConf.cardPrice);
    }
  }

  static renderPurchasedCards(marketCards, cardGen) {
    const purchasedCardsCount = MarketCards.getPurchasedCardsCount(marketCards.getRadioButtonsArray());
    const cardsData = cardGen.generateCards(purchasedCardsCount);
    if (Initializer.cardDrawerInstance) Initializer.cardDrawerInstance.draw(cardsData);
    if (Initializer.orientationManagerInstance) {
      Initializer.orientationManagerInstance.updateCardCount(purchasedCardsCount);
    }
    return purchasedCardsCount;
  }

  static addDauber(conf) {
    let dauber = null;
    if (conf) {
      dauber = new Dauber(conf, document.querySelector('#tube'));
      Initializer.blowerInstance = new Blower(document.querySelector('#blower-balloon'));
    }
    return dauber;
  }

  static showUserInfo() {
    if (ApiController.isLogged()) {
      ViewManipulator.showUserInfo();
    }
  }

  static addRoomEventListeners() {
    const createRoomForm = document.getElementById('createRoomForm');
    const createRoomBtn = document.getElementById('createRoomBtn');
    const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
    const leaveRoomBtn = document.getElementById('leaveRoomBtn');

    console.log("INITIALIZER: addRoomEventListeners called. Setting initial button states.");
    if (createRoomBtn) {
        console.log("INITIALIZER: Disabling Create Room button.");
        createRoomBtn.disabled = true;
    }
    if (refreshRoomsBtn) {
        console.log("INITIALIZER: Disabling Refresh Rooms button.");
        refreshRoomsBtn.disabled = true;
    }

    if (createRoomForm) {
      createRoomForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!Initializer.socket || !Initializer.socket.connected) {
          alert("Not connected to server. Please wait for connection to establish.");
          return;
        }
        if (!Initializer.localPlayerProfile) {
            alert("User profile not loaded. Cannot create room.");
            return;
        }
        const roomName = document.getElementById('roomNameInput').value;
        const maxPlayers = document.getElementById('maxPlayersInput').value;
        const prizeAmount = document.getElementById('prizeAmountInput').value;
        Initializer.socket.emit('createRoom', { roomName, maxPlayers, prizeAmount, username: Initializer.localPlayerProfile.name, piUid: Initializer.localPlayerProfile.piUid });
      });
    }

    if (refreshRoomsBtn) {
      refreshRoomsBtn.addEventListener('click', () => {
        if (Initializer.socket && Initializer.socket.connected) {
          const connStatusMsg = document.getElementById('connectionStatusMsg');
          if (connStatusMsg) {
              connStatusMsg.innerText = 'Refreshing room list...';
              connStatusMsg.style.display = 'block';
          }
          Initializer.socket.emit('listRooms');
        } else {
          alert("Not connected to server.");
        }
      });
    }

    if (leaveRoomBtn) {
        leaveRoomBtn.addEventListener('click', () => {
            if (Initializer.currentRoomId && Initializer.socket && Initializer.socket.connected) {
                Initializer.socket.emit('leaveRoom', { roomId: Initializer.currentRoomId });
                Initializer.resetToRoomSelection();
            } else {
                alert("Error leaving room. You might not be in a room or are disconnected.");
                Initializer.resetToRoomSelection();
            }
        });
    }
  }

  static resetToRoomSelection() {
    Initializer.currentRoomId = null;
    Initializer.currentRoomDetails = null;
    document.getElementById('roomSelectionWrapper').style.display = 'block';
    document.getElementById('gameWrapper').style.display = 'none';
    document.getElementById('marketPlace').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'none';
    document.getElementById('footer').style.display = 'none';
    const currentRoomInfo = document.getElementById('currentRoomInfo');
    if (currentRoomInfo) currentRoomInfo.innerText = '';
    const cardsContainer = document.querySelector('#leftGameScreen');
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (Initializer.cardDrawerInstance) Initializer.cardDrawerInstance.currentCardData = null;
    if (Initializer.dauberInstance) Initializer.dauberInstance.reset();
    if (Initializer.blowerInstance) Initializer.blowerInstance.stopAnimation();
    if (Initializer.socket && Initializer.socket.connected) {
        Initializer.socket.emit('listRooms');
    }
    if (Initializer.chatWrapper) Initializer.chatWrapper.style.display = 'none';
    if (Initializer.chatMessagesList) Initializer.chatMessagesList.innerHTML = '';
    if (Initializer.chatMessageInput) Initializer.chatMessageInput.value = '';

    console.log("INITIALIZER: Client UI reset to room selection.");
  }

  static renderRoomsList(rooms) {
    Initializer.availableRoomsList = rooms;
    const roomsListElement = document.getElementById('roomsList');
    if (!roomsListElement) return;
    roomsListElement.innerHTML = '';
    if (!rooms || rooms.length === 0) {
      roomsListElement.innerHTML = '<li class="list-group-item">No rooms available. Why not create one?</li>';
      return;
    }
    rooms.forEach(room => {
      const listItem = document.createElement('li');
      listItem.className = 'list-group-item d-flex justify-content-between align-items-center';
      listItem.innerHTML = `<div><strong>${room.name}</strong> (Prize: ${room.prizeAmount} Pi)<br><small>Players: ${room.currentPlayerCount}/${room.maxPlayers}</small></div>`;
      const joinButton = document.createElement('button');
      joinButton.className = 'btn btn-primary btn-sm';
      joinButton.innerText = 'Join';
      joinButton.disabled = room.currentPlayerCount >= room.maxPlayers || room.isGameRunning;
      if (joinButton.disabled) {
        joinButton.innerText = room.isGameRunning ? 'In Game' : 'Full';
      }
      joinButton.addEventListener('click', () => {
        if (!Initializer.socket || !Initializer.socket.connected) {
          alert("Not connected to server.");
          return;
        }
         if (!Initializer.localPlayerProfile) {
            alert("User profile not loaded. Cannot join room.");
            return;
        }
        Initializer.socket.emit('joinRoom', { roomId: room.id, username: Initializer.localPlayerProfile.name, piUid: Initializer.localPlayerProfile.piUid });
      });
      listItem.appendChild(joinButton);
      roomsListElement.appendChild(listItem);
    });
  }

  static switchToGameView(roomDetails) {
    Initializer.currentRoomId = roomDetails.id;
    Initializer.currentRoomDetails = roomDetails;
    document.getElementById('roomSelectionWrapper').style.display = 'none';
    document.getElementById('gameWrapper').style.display = 'block';
    document.getElementById('marketPlace').style.display = 'block';
    document.getElementById('footer').style.display = 'block';
    document.getElementById('gameContainer').style.display = 'none';
    const currentRoomInfo = document.getElementById('currentRoomInfo');
    if (currentRoomInfo) currentRoomInfo.innerText = `Room: ${roomDetails.name}`;
    const readyUpBtn = document.getElementById('readyUpBtn');
    if(readyUpBtn) {
        readyUpBtn.disabled = false;
        readyUpBtn.innerText = 'SELECT CARDS & READY UP';
    }
    const cardsContainer = document.querySelector('#leftGameScreen');
    if (cardsContainer) cardsContainer.innerHTML = '';
    if (Initializer.cardDrawerInstance) Initializer.cardDrawerInstance.currentCardData = null;
    if (Initializer.dauberInstance) Initializer.dauberInstance.reset();
    const timerContainer = document.querySelector('#timerContainer');
    if (timerContainer) {
        timerContainer.innerHTML = `<p>Waiting for players... ${roomDetails.players?.size || 0} / ${roomDetails.minPlayersToStart || 1} ready</p>`;
        ViewManipulator.toggleVisibility(timerContainer, true);
    }

    // Show and prepare chat
    if (Initializer.chatWrapper) Initializer.chatWrapper.style.display = 'block';
    if (Initializer.chatMessagesList) Initializer.chatMessagesList.innerHTML = ''; // Clear previous messages
    if (Initializer.chatMessageInput) {
        Initializer.chatMessageInput.value = '';
        Initializer.chatMessageInput.disabled = false;
    }
    if(Initializer.sendChatMessageBtn) Initializer.sendChatMessageBtn.disabled = false;

    console.log(`INITIALIZER: Switched to game view for room: ${roomDetails.id} (${roomDetails.name})`);
  }

  static connectWebSocket() {
    const socketServerUrl = window.location.origin; // Use the origin the client is on (Nginx)
    console.log(`INITIALIZER: Attempting to connect WebSocket to ${socketServerUrl} with path /socket.io/`);
    
    localStorage.debug = '*'; // Enable Socket.IO client debug messages

    if (Initializer.socket && Initializer.socket.connected) {
        console.log("INITIALIZER: Socket already connected. Emitting listRooms.");
        Initializer.socket.emit('listRooms');
        const connStatusMsg = document.getElementById('connectionStatusMsg');
        if (connStatusMsg) connStatusMsg.innerText = 'Already connected. Fetching room list...';
        return;
    }

    if (Initializer.connectionAttemptTimeout) {
        clearTimeout(Initializer.connectionAttemptTimeout);
        Initializer.connectionAttemptTimeout = null;
    }
    
    const connStatusMsg = document.getElementById('connectionStatusMsg');
    if (connStatusMsg) {
        connStatusMsg.innerText = 'Connecting to server...';
        connStatusMsg.style.display = 'block';
    }

    Initializer.socket = io(socketServerUrl, { // Connect to Nginx URL (e.g., http://localhost or https://your.domain)
        path: "/socket.io/", // Crucial for Nginx location block
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        reconnectionDelay: 2500, 
        timeout: 5000,
    });

    if (!Initializer.socket) {
        console.error("INITIALIZER: CRITICAL - Failed to create socket instance from io() call!");
        if (connStatusMsg) {
            connStatusMsg.innerText = 'Fatal Error: Could not initialize connection client.';
            connStatusMsg.style.display = 'block';
        }
        const createRoomBtn = document.getElementById('createRoomBtn');
        const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
        if (createRoomBtn) createRoomBtn.disabled = true;
        if (refreshRoomsBtn) refreshRoomsBtn.disabled = true;
        alert("A critical error occurred trying to set up the connection. Please refresh the page.");
        return;
    }

    console.log("INITIALIZER: Socket object created. Attaching event listeners...");

    const connectionTimeoutDuration = 10000;
    Initializer.connectionAttemptTimeout = setTimeout(() => {
        if (Initializer.socket && !Initializer.socket.connected) {
            console.warn(`INITIALIZER: Connection attempt appears to have timed out after ${connectionTimeoutDuration / 1000}s (manual check).`);
            if (connStatusMsg && connStatusMsg.innerText.toLowerCase().includes('connecting')) {
                connStatusMsg.innerText = 'Failed to connect to server. Server might be offline or unreachable. Please refresh.';
                connStatusMsg.style.display = 'block';
            }
            const createRoomBtn = document.getElementById('createRoomBtn');
            const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
            if (createRoomBtn) createRoomBtn.disabled = true;
            if (refreshRoomsBtn) refreshRoomsBtn.disabled = true;
        }
    }, connectionTimeoutDuration);

    console.log("INITIALIZER: Attaching 'connect' event listener...");
    Initializer.socket.on("connect", () => {
      if(Initializer.connectionAttemptTimeout) clearTimeout(Initializer.connectionAttemptTimeout);
      Initializer.connectionAttemptTimeout = null;
      console.log(`INITIALIZER: Successfully connected to WebSocket server: ${Initializer.socket.id}. Transport: ${Initializer.socket.io.engine.transport.name}`);

      if (connStatusMsg) {
          connStatusMsg.innerText = 'Connected. Fetching room list...';
      }

      const createRoomBtnOnConnect = document.getElementById('createRoomBtn');
      const refreshRoomsBtnOnConnect = document.getElementById('refreshRoomsBtn');
      if (createRoomBtnOnConnect) createRoomBtnOnConnect.disabled = false;
      if (refreshRoomsBtnOnConnect) refreshRoomsBtnOnConnect.disabled = false;

      if (!Initializer.cardDrawerInstance) {
        Initializer.cardDrawerInstance = new CardDrawer(document.querySelector('#leftGameScreen'), Initializer.socket);
      }

      const readyUpBtn = document.querySelector('#readyUpBtn');
      if (readyUpBtn) {
          readyUpBtn.disabled = false;
          if (!readyUpBtn.dataset.listenerAttached) {
            readyUpBtn.addEventListener('click', async () => {
              if (!Initializer.currentRoomId) {
                  alert("You are not in a room. Please join or create a room first.");
                  return;
              }
              if (!Initializer.localPlayerProfile) {
                  alert("User profile not loaded. Cannot ready up.");
                  return;
              }
              const conf = Initializer.config;
              const elMarketPlace = document.querySelector('#marketPlace');
              const marketCardsInstance = new MarketCards(elMarketPlace);
              const purchasedCardsCount = MarketCards.getPurchasedCardsCount(marketCardsInstance.getRadioButtonsArray());
              const cardPrice = conf.gameConf.cardPrice;
              const totalCost = purchasedCardsCount * cardPrice;
              try {
                const currentBalance = Initializer.localPlayerProfile.balance;
                if (Number(currentBalance) < totalCost) {
                  alert(`Insufficient balance. You need ${totalCost}, but you only have ${currentBalance}.`);
                  return;
                }
                let cardsDataForServer = null;
                if (purchasedCardsCount > 0) {
                  const cardGen = new CardGenerator(conf);
                  cardsDataForServer = cardGen.generateCards(purchasedCardsCount);
                  if (Initializer.cardDrawerInstance) {
                    Initializer.cardDrawerInstance.draw(cardsDataForServer);
                  }
                  if (Initializer.orientationManagerInstance) {
                    Initializer.orientationManagerInstance.updateCardCount(purchasedCardsCount);
                  }
                }
                if (purchasedCardsCount > 0 && (!cardsDataForServer || Object.keys(cardsDataForServer).length === 0)) {
                    console.error("INITIALIZER: Could not generate card data even though cards were selected.");
                    alert("Error preparing cards. Please try again.");
                    return;
                }
                const timerContainer = document.querySelector('#timerContainer');
                if (timerContainer && Initializer.currentRoomDetails) {
                    const currentPlayersReady = Initializer.currentRoomDetails.readyPlayerCount || 0;
                    const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                    timerContainer.innerHTML = `<p>Waiting for players... ${currentPlayersReady + 1} / ${minPlayers} ready</p>`;
                    ViewManipulator.toggleVisibility(timerContainer, true);
                }
                readyUpBtn.disabled = true;
                readyUpBtn.innerText = 'Waiting for Game...';
                Initializer.socket.emit('playerIsReadyToPlay', {
                  roomId: Initializer.currentRoomId,
                  username: Initializer.localPlayerProfile.name,
                  piUid: Initializer.localPlayerProfile.piUid,
                  cards: cardsDataForServer,
                  totalCost: totalCost
                });
              } catch (error) {
                  alert("An error occurred while trying to ready up. Please try again.");
                  console.error(`INITIALIZER: Error during ready up: ${error.message}`, error);
                  if(readyUpBtn) {
                      readyUpBtn.disabled = false;
                      readyUpBtn.innerText = 'SELECT CARDS & READY UP';
                  }
              }
            });
            readyUpBtn.dataset.listenerAttached = 'true';
          }
      }
      Initializer.socket.emit('listRooms');
      if (Initializer.localPlayerProfile && Initializer.localPlayerProfile.name) {
          Initializer.socket.emit('requestPlayerData', { username: Initializer.localPlayerProfile.name });
      }
    });

    console.log("INITIALIZER: Attaching 'disconnect' event listener...");
    Initializer.socket.on("disconnect", (reason) => {
      if(Initializer.connectionAttemptTimeout) clearTimeout(Initializer.connectionAttemptTimeout);
      console.warn(`INITIALIZER: Disconnected from WebSocket server. Reason: ${reason}`);
      if (connStatusMsg) {
          connStatusMsg.innerText = 'Disconnected from server.';
          if (reason === "io server disconnect") {
             connStatusMsg.innerText = 'Server connection closed. Please refresh or try again later.';
          } else if (reason === "transport error" || reason === "ping timeout") {
            connStatusMsg.innerText += ' Network issue. Attempting to reconnect...';
          } else if (reason !== 'io client disconnect') {
            connStatusMsg.innerText += ' Attempting to reconnect...';
          }
          connStatusMsg.style.display = 'block';
      }
      const createRoomBtn = document.getElementById('createRoomBtn');
      const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
      const readyUpBtn = document.querySelector('#readyUpBtn');
      if (createRoomBtn) createRoomBtn.disabled = true;
      if (refreshRoomsBtn) refreshRoomsBtn.disabled = true;
      if (readyUpBtn) {
          readyUpBtn.disabled = true;
          readyUpBtn.innerText = 'Disconnected';
      }
    });

    console.log("INITIALIZER: Attaching 'connect_error' event listener...");
    Initializer.socket.on("connect_error", (err) => {
        if(Initializer.connectionAttemptTimeout) clearTimeout(Initializer.connectionAttemptTimeout);
        console.error(`INITIALIZER: Socket connection error. Type: ${err.type}, Message: ${err.message}. Data:`, err.data, err);
        let userMessage = `Connection Error: ${err.message}.`;
        if (err.message.toLowerCase().includes('xhr poll error') || err.message.toLowerCase().includes('websocket error') || err.type === 'TransportError') {
            userMessage += "\n\nThis often means the server is not reachable or there's a network issue. Please ensure the Bingo server is running and accessible.";
        }
        userMessage += "\n\nPlease refresh the page to try again.";
        alert(userMessage);
        if (connStatusMsg) {
            connStatusMsg.innerText = `Connection Error: ${err.message}. Please refresh.`;
            connStatusMsg.style.display = 'block';
        }
        const createRoomBtn = document.getElementById('createRoomBtn');
        const refreshRoomsBtn = document.getElementById('refreshRoomsBtn');
        if (createRoomBtn) createRoomBtn.disabled = true;
        if (refreshRoomsBtn) refreshRoomsBtn.disabled = true;
    });

    console.log("INITIALIZER: Attaching 'reconnect_attempt' event listener...");
    Initializer.socket.on('reconnect_attempt', (attemptNumber) => {
        console.log(`INITIALIZER: Reconnect attempt #${attemptNumber}`);
        if (connStatusMsg) {
            connStatusMsg.innerText = `Connection lost. Reconnecting (attempt ${attemptNumber})...`;
            connStatusMsg.style.display = 'block';
        }
    });

    console.log("INITIALIZER: Attaching 'reconnect_failed' event listener...");
    Initializer.socket.on('reconnect_failed', () => {
        if(Initializer.connectionAttemptTimeout) clearTimeout(Initializer.connectionAttemptTimeout);
        console.error('INITIALIZER: All reconnection attempts failed.');
        if (connStatusMsg) {
            connStatusMsg.innerText = 'Failed to reconnect to the server. Please check your connection and refresh.';
            connStatusMsg.style.display = 'block';
        }
        alert("Failed to reconnect to the server. Please check your internet connection and refresh the page.");
    });

    // --- Room Management Event Handlers ---
    Initializer.socket.on('roomsList', (rooms) => {
        if(Initializer.connectionAttemptTimeout) clearTimeout(Initializer.connectionAttemptTimeout);
        Initializer.renderRoomsList(rooms);
        if (connStatusMsg) {
            connStatusMsg.style.display = 'none';
        }
    });

    Initializer.socket.on('newRoomAvailable', (room) => {
        const existingRoomIndex = Initializer.availableRoomsList.findIndex(r => r.id === room.id);
        if (existingRoomIndex === -1) {
            Initializer.availableRoomsList.push(room);
        } else {
            Initializer.availableRoomsList[existingRoomIndex] = room;
        }
        Initializer.renderRoomsList(Initializer.availableRoomsList);
    });

    Initializer.socket.on('roomUpdated', (updatedRoom) => {
        const index = Initializer.availableRoomsList.findIndex(r => r.id === updatedRoom.id);
        if (index !== -1) {
            Initializer.availableRoomsList[index] = updatedRoom;
        } else {
            Initializer.availableRoomsList.push(updatedRoom);
        }
        Initializer.renderRoomsList(Initializer.availableRoomsList);
        if (Initializer.currentRoomId === updatedRoom.id) {
            Initializer.currentRoomDetails = { ...Initializer.currentRoomDetails, ...updatedRoom };
            const timerContainer = document.querySelector('#timerContainer');
            if (timerContainer && Initializer.currentRoomDetails && !Initializer.currentRoomDetails.isGameRunning) {
                const readyCount = Initializer.currentRoomDetails.readyPlayerCount || 0;
                const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                timerContainer.innerHTML = `<p>Waiting for players... ${readyCount} / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
            }
        }
    });

    Initializer.socket.on('roomClosed', (data) => {
        Initializer.availableRoomsList = Initializer.availableRoomsList.filter(r => r.id !== data.roomId);
        Initializer.renderRoomsList(Initializer.availableRoomsList);
        if (Initializer.currentRoomId === data.roomId) {
            alert("The current room has been closed.");
            Initializer.resetToRoomSelection();
        }
    });

    Initializer.socket.on('roomCreated', (data) => {
        // data now contains { roomId, message, roomDetails (basic) }
        alert(data.message || `Room "${data.roomDetails?.name || data.roomId}" created successfully. Join it from the list.`);
        // Do NOT automatically switch to game view.
        // Instead, refresh the room list to show the newly created room.
        if (Initializer.socket && Initializer.socket.connected) {
            console.log("INITIALIZER: Room created, emitting listRooms to refresh the list.");
            Initializer.socket.emit('listRooms');
        }
        // Clear the form
        const createRoomForm = document.getElementById('createRoomForm');
        if (createRoomForm) createRoomForm.reset();
    });

    Initializer.socket.on('roomCreationFailed', (data) => {
        alert(`Room creation failed: ${data.reason}`);
        const createRoomBtn = document.getElementById('createRoomBtn');
        if(createRoomBtn && Initializer.socket && Initializer.socket.connected) createRoomBtn.disabled = false;
    });

    Initializer.socket.on('joinedRoom', (data) => {
        Initializer.switchToGameView(data.roomDetails);
    });

    Initializer.socket.on('joinRoomFailed', (data) => {
        alert(`Could not join room: ${data.reason}`);
    });

    Initializer.socket.on('playerJoinedRoom', (data) => {
        if (Initializer.currentRoomId && Initializer.currentRoomDetails) {
            Initializer.currentRoomDetails.playerCount = data.playerCount;
            const timerContainer = document.querySelector('#timerContainer');
            if (timerContainer && !Initializer.currentRoomDetails.isGameRunning) {
                 const readyCount = Initializer.currentRoomDetails.readyPlayerCount || 0;
                 const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                 timerContainer.innerHTML = `<p>Waiting for players... ${readyCount} / ${minPlayers} ready (${data.playerCount} in room)</p>`;
            }
        }
    });

    Initializer.socket.on('playerLeftRoom', (data) => {
         if (Initializer.currentRoomId && Initializer.currentRoomDetails) {
            Initializer.currentRoomDetails.playerCount = data.playerCount;
            const timerContainer = document.querySelector('#timerContainer');
            if (timerContainer && !Initializer.currentRoomDetails.isGameRunning) {
                 const readyCount = Initializer.currentRoomDetails.readyPlayerCount || 0;
                 const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                 timerContainer.innerHTML = `<p>Waiting for players... ${readyCount} / ${minPlayers} ready (${data.playerCount} in room)</p>`;
            }
        }
    });

    Initializer.socket.on('newHost', (data) => {
        if (Initializer.currentRoomId === data.roomId) {
            alert(`The host has changed. New host: ${data.newHostUsername}`);
            if (Initializer.currentRoomDetails) {
                Initializer.currentRoomDetails.hostSocketId = data.newHostSocketId;
            }
        }
    });

    Initializer.socket.on("gameState", (data) => {
        if (!data.roomId || data.roomId !== Initializer.currentRoomId) {
            return;
        }
        Initializer.lastGameStateByRoom.set(data.roomId, data);
        Initializer.currentRoomDetails = data;
        const timerContainer = document.querySelector('#timerContainer');
        const readyUpBtn = document.querySelector('#readyUpBtn');
        const elMarketPlace = document.querySelector('#marketPlace');
        const elFooter = document.querySelector('#footer');
        const gameContainer = document.querySelector('#gameContainer');
        const blowerParentElement = document.querySelector('#blower');
        if (data.isRunning) {
            if (timerContainer) ViewManipulator.toggleVisibility(timerContainer, false);
            if (elMarketPlace) ViewManipulator.toggleVisibility(elMarketPlace, false);
            if (elFooter) ViewManipulator.toggleVisibility(elFooter, false);
            if (readyUpBtn) {
                readyUpBtn.disabled = true;
                readyUpBtn.innerText = 'Game Running';
            }
            if (gameContainer) ViewManipulator.toggleVisibility(gameContainer, true);
            if (blowerParentElement) ViewManipulator.toggleVisibility(blowerParentElement, true);
            if (Initializer.dauberInstance) Initializer.dauberInstance.reset();
            if (data.drawnNumbers && data.drawnNumbers.length > 0) {
                data.drawnNumbers.forEach(number => {
                    if (Initializer.dauberInstance) Initializer.dauberInstance.displayNewBall(number);
                });
            }
            if (Initializer.blowerInstance) Initializer.blowerInstance.startAnimation();
        } else {
            if (elMarketPlace) ViewManipulator.toggleVisibility(elMarketPlace, true);
            if (elFooter) ViewManipulator.toggleVisibility(elFooter, true);
            if (readyUpBtn) {
                readyUpBtn.disabled = false;
                readyUpBtn.innerText = 'SELECT CARDS & READY UP';
            }
            if (gameContainer) ViewManipulator.toggleVisibility(gameContainer, false);
            if (blowerParentElement) ViewManipulator.toggleVisibility(blowerParentElement, false);
            const cardsContainer = document.querySelector('#leftGameScreen');
            if (cardsContainer) cardsContainer.innerHTML = '';
            if (Initializer.cardDrawerInstance) Initializer.cardDrawerInstance.currentCardData = null;
            if (timerContainer) {
              const readyCount = data.readyPlayerCount || 0;
              const minPlayers = data.minPlayersToStart || Initializer.config?.gameConf?.minPlayersToStart || 1;
              const playerCountInRoom = data.playerCount || data.players?.size || 0;
              timerContainer.innerHTML = `<p>Waiting for players... ${readyCount} / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
              ViewManipulator.toggleVisibility(timerContainer, true);
            }
            if (Initializer.blowerInstance) Initializer.blowerInstance.stopAnimation();
        }
    });

    Initializer.socket.on("playerReadyInRoom", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        const timerContainer = document.querySelector('#timerContainer');
        if (Initializer.currentRoomDetails) {
            Initializer.currentRoomDetails.readyPlayerCount = data.readyCount;
            if (timerContainer && !Initializer.currentRoomDetails.isGameRunning) {
                const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                timerContainer.innerHTML = `<p>Waiting for players... ${data.readyCount} / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
            }
        }
    });

    Initializer.socket.on("gameStarted", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        const timerContainer = document.querySelector('#timerContainer');
        if (timerContainer) ViewManipulator.toggleVisibility(timerContainer, false);
        document.getElementById('marketPlace').style.display = 'none';
        document.getElementById('footer').style.display = 'none';
        document.getElementById('gameContainer').style.display = 'block';
        document.getElementById('blower').style.display = 'block';
        if (Initializer.blowerInstance) Initializer.blowerInstance.startAnimation();
        if (Initializer.dauberInstance) Initializer.dauberInstance.reset();
        const readyUpBtn = document.querySelector('#readyUpBtn');
        if (readyUpBtn) {
            readyUpBtn.disabled = true;
            readyUpBtn.innerText = 'Game Running';
        }
        if(Initializer.currentRoomDetails) Initializer.currentRoomDetails.isGameRunning = true;
    });

    Initializer.socket.on("newNumber", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        if (Initializer.dauberInstance) {
            Initializer.dauberInstance.displayNewBall(data.number);
        }
    });

    Initializer.socket.on("restorePlayerData", (data) => {
        if ((!data.roomId || data.roomId === Initializer.currentRoomId) && data.cards && Initializer.cardDrawerInstance) {
            Initializer.cardDrawerInstance.draw(data.cards);
            if (data.markedCells && Object.keys(data.markedCells).length > 0) {
                for (const uniqueCellId in data.markedCells) {
                    if (data.markedCells.hasOwnProperty(uniqueCellId)) {
                        const cellToMark = document.getElementById(uniqueCellId);
                        if (cellToMark) Card.markDrawnNumber(cellToMark);
                    }
                }
            }
            const roomState = Initializer.lastGameStateByRoom.get(Initializer.currentRoomId);
            if (roomState && roomState.drawnNumbers && roomState.drawnNumbers.length > 0) {
                 roomState.drawnNumbers.forEach(number => {
                     Initializer.cardDrawerInstance.getCardInstances().forEach(card => {
                         card.checkAndMarkNumber(number);
                     });
                 });
            }
        }
    });

    Initializer.socket.on("gameEnded", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        if (Initializer.blowerInstance) Initializer.blowerInstance.stopAnimation();
        alert(`Game in room "${Initializer.currentRoomDetails?.name || data.roomId}" has ended. Reason: ${data.reason}`);
        document.getElementById('marketPlace').style.display = 'block';
        document.getElementById('footer').style.display = 'block';
        document.getElementById('gameContainer').style.display = 'none';
        const readyUpBtn = document.querySelector('#readyUpBtn');
        if (readyUpBtn) {
            readyUpBtn.disabled = false;
            readyUpBtn.innerText = 'SELECT CARDS & READY UP';
        }
        const timerContainer = document.querySelector('#timerContainer');
        if (Initializer.currentRoomDetails) {
            Initializer.currentRoomDetails.isGameRunning = false;
            Initializer.currentRoomDetails.readyPlayerCount = 0;
            if (timerContainer) {
                const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                timerContainer.innerHTML = `<p>Waiting for players... 0 / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
                ViewManipulator.toggleVisibility(timerContainer, true);
            }
        }
    });

    Initializer.socket.on("gameWon", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        if (Initializer.blowerInstance) Initializer.blowerInstance.stopAnimation();
        const serverWinnerName = data?.winnerName || "A Lucky Player";
        const prizeAmount = data?.prizeAmount || Initializer.currentRoomDetails?.prizeAmount || 0;
        const isWinnerForThisClient = !!(Initializer.localPlayerProfile && serverWinnerName === Initializer.localPlayerProfile.name);
        if (data.winningCells && Array.isArray(data.winningCells)) {
            data.winningCells.forEach(cellId => {
                const cellElement = document.getElementById(cellId);
                if (cellElement) cellElement.classList.add('winning-cell');
            });
        }
        const showAndHandleDialog = () => {
            if (Initializer.winningDialogInstance) {
                Initializer.winningDialogInstance.show({
                    winnerName: serverWinnerName,
                    prizeAmount: prizeAmount,
                    isWinnerForThisClient: isWinnerForThisClient
                });
                setTimeout(() => {
                    Initializer.winningDialogInstance.close();
                    document.getElementById('marketPlace').style.display = 'block';
                    document.getElementById('footer').style.display = 'block';
                    document.getElementById('gameContainer').style.display = 'none';
                    const readyUpBtn = document.querySelector('#readyUpBtn');
                    if (readyUpBtn) {
                        readyUpBtn.disabled = false;
                        readyUpBtn.innerText = 'SELECT CARDS & READY UP';
                    }
                     const timerContainer = document.querySelector('#timerContainer');
                    if (Initializer.currentRoomDetails) {
                        Initializer.currentRoomDetails.isGameRunning = false;
                        Initializer.currentRoomDetails.readyPlayerCount = 0;
                        if (timerContainer) {
                            const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                            const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                            timerContainer.innerHTML = `<p>Waiting for players... 0 / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
                            ViewManipulator.toggleVisibility(timerContainer, true);
                        }
                    }
                }, 10000);
            }
        };
        if (isWinnerForThisClient) {
            FlyingPrize.animatePrizeFlying(prizeAmount);
            document.addEventListener(EventsConsts.FLYING_PRIZE_ANIMATION_ENDS, function handler() {
                document.removeEventListener(EventsConsts.FLYING_PRIZE_ANIMATION_ENDS, handler);
                showAndHandleDialog();
            }, { once: true });
        } else {
            showAndHandleDialog();
        }
         if (Initializer.currentRoomDetails) Initializer.currentRoomDetails.isGameRunning = false;
    });

    Initializer.socket.on("gameReset", (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        document.getElementById('marketPlace').style.display = 'block';
        document.getElementById('footer').style.display = 'block';
        document.getElementById('gameContainer').style.display = 'none';
        const cardsContainer = document.querySelector('#leftGameScreen');
        if (cardsContainer) cardsContainer.innerHTML = '';
        if (Initializer.cardDrawerInstance) Initializer.cardDrawerInstance.currentCardData = null;
        if (Initializer.dauberInstance) Initializer.dauberInstance.reset();
        const readyUpBtn = document.querySelector('#readyUpBtn');
        if (readyUpBtn) {
            readyUpBtn.disabled = false;
            readyUpBtn.innerText = 'SELECT CARDS & READY UP';
        }
        const timerContainer = document.querySelector('#timerContainer');
        if (Initializer.currentRoomDetails) {
             Initializer.currentRoomDetails.isGameRunning = false;
             Initializer.currentRoomDetails.readyPlayerCount = 0;
             if (timerContainer) {
                 const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                 const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                 timerContainer.innerHTML = `<p>Waiting for players... 0 / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
                 ViewManipulator.toggleVisibility(timerContainer, true);
             }
        }
    });

    Initializer.socket.on('balanceUpdated', (data) => {
        if (Initializer.localPlayerProfile) {
            Initializer.localPlayerProfile.balance = data.newBalance;
        }
        const balanceDisplayGlobal = document.querySelector('#userBalanceDisplay');
        if (balanceDisplayGlobal) balanceDisplayGlobal.innerText = data.newBalance;
        LocalStorageService.saveBalance(data.newBalance);
        const userProfile = LocalStorageService.currentUser();
        if(userProfile) {
            userProfile.balance = data.newBalance;
            localStorage.setItem('bingo-user-profile', JSON.stringify(userProfile));
        } else {
            const tempProfile = { balance: data.newBalance }; 
            localStorage.setItem('bingo-user-profile', JSON.stringify(tempProfile));
        }
    });

    Initializer.socket.on('startGameFailed', (data) => {
        if (data.roomId && data.roomId !== Initializer.currentRoomId) return;
        alert(`Could not start/join game: ${data.reason}`);
        const readyUpBtn = document.querySelector('#readyUpBtn');
        if (readyUpBtn) {
            readyUpBtn.disabled = false;
            readyUpBtn.innerText = 'SELECT CARDS & READY UP';
        }
        const timerContainer = document.querySelector('#timerContainer');
        if (Initializer.currentRoomDetails && !Initializer.currentRoomDetails.isGameRunning) {
            if (timerContainer) {
                const readyCount = Initializer.currentRoomDetails.readyPlayerCount || 0;
                const minPlayers = Initializer.currentRoomDetails.minPlayersToStart || 1;
                const playerCountInRoom = Initializer.currentRoomDetails.playerCount || Initializer.currentRoomDetails.players?.size || 0;
                timerContainer.innerHTML = `<p>Waiting for players... ${readyCount} / ${minPlayers} ready (${playerCountInRoom} in room)</p>`;
            }
        }
    });

    Initializer.socket.on('markNumberApproved', (data) => {
        if (data.roomId !== Initializer.currentRoomId) return;
        const cellToMark = document.getElementById(data.cellId);
        if (cellToMark && !cellToMark.classList.contains('marked')) {
            // Card.markDrawnNumber(cellToMark); // Logic is within Card instance
        }
    });

    Initializer.socket.on('newRoomMessage', (data) => {
      if (data.roomId !== Initializer.currentRoomId) {
        return; // Message not for the current room
      }
      if (Initializer.chatMessagesList && Initializer.chatMessagesContainer) {
        const messageElement = document.createElement('li');
        const timestamp = new Date(data.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Sanitize username and message content before inserting as HTML
        // Although server sanitizes, client-side can be an extra layer or for display formatting
        const safeUsername = data.username.replace(/</g, "<").replace(/>/g, ">");
        const safeMessage = data.message.replace(/</g, "<").replace(/>/g, ">");

        messageElement.innerHTML = `<strong>${safeUsername}</strong> <small>(${timestamp})</small>: ${safeMessage}`;
        
        // Highlight own messages (optional)
        if (Initializer.socket && data.socketId === Initializer.socket.id) {
          messageElement.style.fontWeight = 'bold';
          messageElement.style.color = 'darkblue'; // Or some other distinguishing style
        } else {
          messageElement.style.color = '#333';
        }
        messageElement.style.marginBottom = '5px';
        messageElement.style.wordBreak = 'break-word';

        Initializer.chatMessagesList.appendChild(messageElement);
        // Scroll to the bottom of the chat messages container
        Initializer.chatMessagesContainer.scrollTop = Initializer.chatMessagesContainer.scrollHeight;
      }
    });
  } // End of connectWebSocket

  static addBingoListener() {
    document.addEventListener(EventsConsts.BINGO, (e) => {
      if (Initializer.socket && Initializer.currentRoomId) {
        Initializer.socket.emit('declareBingo', { roomId: Initializer.currentRoomId, time: e.detail.time });
      } else {
        console.warn("INITIALIZER: Cannot declare bingo: Not in a room or not connected.");
      }
    });
  }

  static addChatEventListeners() {
    if (Initializer.sendChatMessageBtn) {
      Initializer.sendChatMessageBtn.addEventListener('click', Initializer.sendChatMessage);
    }
    if (Initializer.chatMessageInput) {
      Initializer.chatMessageInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault(); // Prevent form submission if it's part of a form
          Initializer.sendChatMessage();
        }
      });
    }
  }

  static sendChatMessage() {
    if (!Initializer.socket || !Initializer.socket.connected) {
      alert("Not connected to the server. Cannot send message.");
      return;
    }
    if (!Initializer.currentRoomId) {
      alert("You are not in a room. Cannot send message.");
      return;
    }
    const message = Initializer.chatMessageInput ? Initializer.chatMessageInput.value.trim() : '';
    if (message === '') {
      return; // Don't send empty messages
    }

    Initializer.socket.emit('sendRoomMessage', {
      roomId: Initializer.currentRoomId,
      message: message
    });

    if (Initializer.chatMessageInput) {
      Initializer.chatMessageInput.value = ''; // Clear the input field
    }
  }
}

window.Initializer = Initializer;

export default Initializer;
