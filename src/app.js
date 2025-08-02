
console.log("src/app.js: Script execution started - TOP OF FILE"); // ABSOLUTE TOP DEBUG
import ApiConsts from './API/api-consts';
import Initializer from './initializer/initializer';

class App {
	static async start() {
	  console.log('App.start(): Execution begins.'); // VERY EARLY DEBUG
	  // Clear local storage token on startup to prevent decoding errors with old/invalid tokens
	  localStorage.removeItem('mean-token');

	  fetch(ApiConsts.CONF).then((response) => {
	    if (response.status >= 400) {
	      throw new Error("Bad response from server");
	    }
	    return response.json();
	  }).then((config) => {
	    Initializer.applyConfigurations(config);
	  }).catch(error => {
	 // ViewManipulator.appendLog(`Error fetching config: ${error.message}`); // REMOVED
	 console.error(`Error fetching config: ${error.message}`); // Keep console error for critical issues
	  });

	  // Initialize Pi SDK
	  window.Pi.init({
	    version: "2.0",
	    sandbox: false // Set to false for production
	  });
	  console.log('App.start(): Pi SDK initialized. About to set up piLoginBtn listener.'); // DEBUG BEFORE LISTENER

	  const piLoginButton = document.getElementById('piLoginBtn');
	  if (piLoginButton) {
	    piLoginButton.addEventListener('click', async () => {
	      console.log('Pi Login button clicked.'); // DEBUG: Confirm click event fires
	      try {
	        const authData = await Pi.authenticate(["username", "payments"], {
	          onIncompletePaymentFound: (payment) => {
	            console.log(`Incomplete payment found: ${JSON.stringify(payment)}`);
	          }
	        });
	        console.log('Pi Authentication successful, authData:', authData); // DEBUG

	        const response = await fetch('/api/pi-login', {
	          method: 'POST',
	          headers: {
	            'Content-Type': 'application/json',
	          },
	          body: JSON.stringify(authData),
	        });
	        console.log('Response from /api/pi-login:', response.status); // DEBUG

	        const result = await response.json();
	        console.log('Result from /api/pi-login:', result); // DEBUG

	        if (response.ok) {
	          localStorage.setItem('mean-token', result.token);
	          // Store user details, including piUid, for later use by the Initializer
	          localStorage.setItem('bingo-user-profile', JSON.stringify(result.user)); // Save full user object

	          document.getElementById('registerPage').style.display = 'none';
	          document.getElementById('roomSelectionWrapper').style.display = 'block'; // Show room selection
	          document.getElementById('gameWrapper').style.display = 'none'; // Keep game wrapper hidden initially

	          // Update user display if elements are globally accessible or part of a persistent header
	          // These might be better updated when gameWrapper becomes visible if they are inside it.
	          // For now, assuming they might be in a shared header visible with roomSelectionWrapper.
	          const userNameDisplay = document.getElementById('userNameDisplay');
	          const userBalanceDisplay = document.getElementById('userBalanceDisplay');
	          if (userNameDisplay) userNameDisplay.innerText = result.user.name;
	          if (userBalanceDisplay) userBalanceDisplay.innerText = result.user.balance;
	          
	          // Initializer will handle connecting to socket and listing rooms
	          if (window.Initializer) {
	            window.Initializer.handlePostLogin();
	          }

	        } else {
	          document.getElementById('alertMsg').style.display = 'block';
	          document.getElementById('messageText').innerText = result.message || 'Authentication failed.';
	          console.error(`Authentication failed: ${result.message || 'Unknown error'}`);
	        }
	      } catch (error) {
	        console.error(`Pi Login button click error: ${error.message}`, error); // DEBUG: Catch errors within the click handler
	        document.getElementById('alertMsg').style.display = 'block';
	        document.getElementById('messageText').innerText = error.message || 'Pi authentication failed.';
	      }
	    });
	    console.log('Pi Login button event listener attached.'); // DEBUG: Confirm listener setup
	  } else {
	    console.error('Pi Login button (#piLoginBtn) not found in DOM.'); // DEBUG
	  }

	  document.getElementById('logoutBtn').addEventListener('click', () => {
	    localStorage.removeItem('mean-token'); // Clear the stored token
	    localStorage.removeItem('bingo-user-profile'); // Clear stored user profile
	    document.getElementById('gameWrapper').style.display = 'none'; // Hide game interface
	    document.getElementById('roomSelectionWrapper').style.display = 'none'; // Hide room selection
	    document.getElementById('registerPage').style.display = 'block'; // Show login/register page
	    
	    if (window.Initializer && window.Initializer.socket && window.Initializer.socket.connected) {
	        window.Initializer.socket.disconnect();
	    }
	    // Clear any room-specific UI if necessary
	    const currentRoomInfo = document.getElementById('currentRoomInfo');
	    if (currentRoomInfo) currentRoomInfo.innerText = '';
	    const roomsList = document.getElementById('roomsList');
	    if (roomsList) roomsList.innerHTML = '<li class="list-group-item">No rooms available yet.</li>';

	  });

	   // Pi Donation Button Logic
	   const donateButton = document.getElementById('donatePiBtn');
	   if (donateButton) {
	     donateButton.addEventListener('click', async () => {
	       console.log('Donate Pi button clicked');
	       try {
	         const paymentData = {
	           amount: 1.000, // Fixed donation amount of 1 Pi
	           memo: "Donation to Pi Bingo", // A memo for the user
	           metadata: { type: "donation", forApp: "PiBingo" }, // Your app-specific metadata
	         };

	         Pi.createPayment(paymentData, {
	           onReadyForServerApproval: async function(paymentId) {
	             console.log("onReadyForServerApproval", paymentId);
	             try {
	               const response = await fetch('/api/pi-approve-donation', {
	                 method: 'POST',
	                 headers: { 'Content-Type': 'application/json' },
	                 body: JSON.stringify({ paymentId }),
	               });
	               if (!response.ok) {
	                 const errText = await response.text();
	                 console.error('Server approval failed:', response.status, errText);
	                 alert(`Donation approval failed: ${errText || response.statusText}`);
	                 // Optionally, you might want to inform Pi.cancelPayment(paymentId) or let it timeout
	                 return;
	               }
	               console.log('Server approved donation.');
	               // Pi SDK will automatically proceed to onReadyForServerCompletion if server approves
	             } catch (err) {
	               console.error('Error during server approval:', err);
	               alert(`Error during donation approval: ${err.message}`);
	             }
	           },
	           onReadyForServerCompletion: async function(paymentId, txid) {
	             console.log("onReadyForServerCompletion", paymentId, txid);
	             try {
	               const response = await fetch('/api/pi-complete-donation', {
	                 method: 'POST',
	                 headers: { 'Content-Type': 'application/json' },
	                 body: JSON.stringify({ paymentId, txid }),
	               });
	               if (!response.ok) {
	                 const errText = await response.text();
	                 console.error('Server completion failed:', response.status, errText);
	                 alert(`Donation completion failed: ${errText || response.statusText}`);
	                 return;
	               }
	               const result = await response.json();
	               console.log('Server completed donation:', result);
	               alert('Thank you for your donation!');
	             } catch (err) {
	               console.error('Error during server completion:', err);
	               alert(`Error during donation completion: ${err.message}`);
	             }
	           },
	           onCancel: function(paymentId) {
	             console.log("onCancel", paymentId);
	             alert('Donation cancelled.');
	           },
	           onError: function(error, payment) {
	             console.error("onError", error, payment);
	             alert(`Donation error: ${error.message || 'Unknown error'}`);
	           }
	         });
	       } catch (err) {
	         console.error('Error creating Pi payment:', err);
	         alert(`Could not initiate donation: ${err.message}`);
	       }
	     });
	   } else {
	     console.warn('Donate Pi button (#donatePiBtn) not found.');
	   }
	}

	 static async openExternalUrl(url) {
    try {
      await Pi.openUrlInSystemBrowser(url);
      console.log(`Successfully opened URL in system browser: ${url}`);
    } catch (error) {
      let errorMessage = "An unexpected error occurred while trying to open the URL.";
      if (error.message === "Failed to open URL") {
        errorMessage = `Failed to open URL: ${url}. Likely due to an incorrect URL.`;
      } else if (error.message === "No minimal requirements") {
        errorMessage = `Cannot open URL: ${url}. Pi Browser version is too old. Please encourage users to update.`;
      } else if (error.message === "Unexpected error") {
        errorMessage = `An unexpected error occurred while trying to open URL: ${url}.`;
      }
      console.error(`Error opening URL in system browser: ${errorMessage}`, error);
    }
  }
}

export default App;

// Immediately Invoked Async Function Expression (IIAFE)
(async (appInstance) => {
  try {
    // Await the asynchronous start operation
    await appInstance.start();
    // Log success upon completion
    console.log('Game Started!');
    // Consider using a more sophisticated logger in larger applications
  } catch (error) {
    // Catch and log any errors during startup
    console.error('Error starting the game:', error);
    // Implement more robust error handling/reporting as needed
    // For example, display a message to the user or send logs to a server
  }
})(App); // Pass the App object into the function
