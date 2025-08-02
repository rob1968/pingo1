import ApiController from '../API/api-controller';
import VanillaModal from 'vanilla-modal';
import { EventsConsts } from '../events/events-consts';
import FlyingPrize from './flying-prize';

class WinningDialog {
	constructor(elementID) {
		this.elementID = elementID;
		// prizeAmount will be set when show() is called by Animator
		this.prizeAmount = 0;
		this.isWinnerForThisClient = false; // Initialize flag
		this.modalInstance = null; // To store the VanillaModal instance
		WinningDialog.attachListeners(this.elementID, this); // Pass instance for onCloseWinningModal
	}

	// Removed bingos tracking from static listeners
	static attachListeners(elementID, instance) { // Accept instance
		// Keep BINGO listener? Maybe not needed if server is authoritative source of win
		// document.addEventListener(EventsConsts.BINGO, () => {
		// 	// bingos++; // Local count might be inaccurate
		// });
		// Store the instance on the class for static access in onCloseWinningModal
	       // This is a bit of a workaround for static event handlers needing instance data.
	       // A better approach might be to make onCloseWinningModal an instance method
	       // and pass it directly to VanillaModal if the library supports it.
	       WinningDialog.currentInstance = instance;

		// Keep START_GAME listener to reset local state if needed?
		// document.addEventListener(EventsConsts.START_GAME, () => {
		// 	// bingos = 0;
		// });

		// REMOVED END_GAME listener - Dialog triggered by gameWon event now
		// document.addEventListener(EventsConsts.END_GAME, () => { ... });

		document.addEventListener(EventsConsts.NOT_ENOUGH_BALANCE, () => {
			const objWinning = {
				elementID: elementID,
				text: 'Not enough money. Please deposit.'
			};
			WinningDialog.createMsgDialog(objWinning);
		});
	}

	static getHeaderImgClass(bingos) {
		// Define which header image to show
		// Simplified for now as we don't track local bingos accurately
		if (bingos === 0) { // This case might still be relevant for 'no win' scenario
			return 'no-bingo';
		}
		if (bingos === 0 && ApiController.getPlayerBalanceFromStorage() === 0) {
			return 'no-bingo-no-money';
		}
		// Default to a winning image if bingos > 0 (or if called from showWinnerDialog)
		return 'winner-one-bingo'; // Defaulting to one bingo image
	}

	static createMsgDialog(objWinning) {
		const elDialog = document.querySelector(objWinning.elementID);
		if (!elDialog) return; // Guard clause
		const elHeader = elDialog.querySelector('header'); // Find header within dialog
		const elDialogContent = elDialog.querySelector('#content');
		if (elHeader) {
			elHeader.className = ''; // Clear existing classes
			elHeader.classList.add('no-bingo-no-money');
		}
		if (elDialogContent) elDialogContent.innerHTML = objWinning.text;
		WinningDialog.openDialog(objWinning.elementID);
	}

	// Original method - might be deprecated or refactored later
	static createDialog(objWinning) {
		const elDialog = document.querySelector(objWinning.elementID);
		if (!elDialog) return;
		const elDialogContent = elDialog.querySelector('#content');
		const elHeader = elDialog.querySelector('header'); // Find header within dialog

		// Clear header classes
		if (elHeader) elHeader.className = '';

		// Simplified content - just show prize for now
		const prizeSum = objWinning.bingos * 50; // Assuming prize calculation is still needed?
		if (elDialogContent) {
			elDialogContent.innerHTML = `<div id="prize" class="col-sm-12 col-xs-12">Prize: ${prizeSum}</div>`;
		}

		if (elHeader) elHeader.classList.add(WinningDialog.getHeaderImgClass(objWinning.bingos));

		// Removed bingo image display logic

		// const flyingPrize = new FlyingPrize(prizeSum); // Keep flying prize?

		WinningDialog.openDialog(objWinning.elementID);
	}

	// This method is now called by Animator.showWinningDialog
	// It receives data like { winnerName: 'Player1', prizeAmount: 100 }
	show(data) {
		console.log(`WINNING_DIALOG: show called with data:`, data);
		this.prizeAmount = data.prizeAmount || 0; // Store prize amount
		this.isWinnerForThisClient = data.isWinnerForThisClient || false; // Store the flag

		const elDialog = document.querySelector(this.elementID);
		if (!elDialog) {
			console.error(`WINNING_DIALOG: Element ${this.elementID} not found.`);
			return;
		}
		const elDialogContent = elDialog.querySelector('#content');
		const elHeader = elDialog.querySelector('header');

		if (elHeader) {
			elHeader.className = ''; // Clear existing classes
			// Use a generic winning image, or one based on prizeAmount if desired
			elHeader.classList.add(WinningDialog.getHeaderImgClass(1));
			console.log("WINNING_DIALOG: Set header class.");
		} else {
			console.warn("WINNING_DIALOG: Header element not found in dialog.");
		}

		if (elDialogContent) {
			// Display winner name and prize amount
			elDialogContent.innerHTML = `
				<div class="winner-message">${data.winnerName || 'A Lucky Player'} wins!</div>
				<div id="prize" class="col-sm-12 col-xs-12">Prize: ${this.prizeAmount}</div>
			`;
			console.log("WINNING_DIALOG: Set content.");
		} else {
			console.warn("WINNING_DIALOG: Content element not found in dialog.");
		}

		WinningDialog.openDialog(this.elementID);
	}


	static openDialog(elementId) {
		console.log(`WINNING_DIALOG: Opening dialog ${elementId}`);
		try {
			// Ensure we have the current instance to store the modal on
			const instance = WinningDialog.currentInstance;
			if (!instance) {
					console.error("WINNING_DIALOG: Cannot open dialog, WinningDialog.currentInstance is not set.");
					return;
			}
			// Close previous modal if it exists for this instance to prevent duplicates
			instance.close();

			// Create and store the new modal instance
			instance.modalInstance = new VanillaModal({ onClose: WinningDialog.onCloseWinningModal });
			instance.modalInstance.open(elementId);
			console.log(`WINNING_DIALOG: Modal instance created and opened for ${elementId}`);
		} catch (error) {
			console.error("WINNING_DIALOG: Error opening modal:", error);
		}
	}

	close() {
		// Method to programmatically close the dialog
		if (this.modalInstance) {
				try {
						// VanillaModal uses the static close method with the ID
						VanillaModal.close(this.elementID);
						console.log(`WINNING_DIALOG: Programmatically closed dialog ${this.elementID}.`);
						// Note: This should trigger the onClose callback automatically
				} catch (error) {
						console.error(`WINNING_DIALOG: Error closing modal programmatically ${this.elementID}:`, error);
				}
				// Don't nullify here, onCloseWinningModal handles cleanup
		}
	}

	static onCloseWinningModal() {
		const instance = WinningDialog.currentInstance; // Get instance at the start
		if (!instance) {
			console.log("WINNING_DIALOG: onCloseWinningModal called but no currentInstance found.");
			return; // Exit if no instance
		}

		console.log("WINNING_DIALOG: Dialog closed callback triggered.");
		// Dispatch new event when the dialog is closed
		// This might need adjustment depending on the desired flow after closing
		// Dispatch new event when the dialog is closed
		// This might need adjustment depending on the desired flow after closing
		// Only dispatch PRIZE_WON if this client is the actual winner
		if (WinningDialog.currentInstance && WinningDialog.currentInstance.isWinnerForThisClient) {
			console.log("WINNING_DIALOG: This client is the winner. Dispatching PRIZE_WON event.");
			const event = new CustomEvent(EventsConsts.PRIZE_WON, {
					detail: {
						time: new Date(),
						prizeAmount: WinningDialog.currentInstance.prizeAmount
					}, bubbles: true, cancelable: true
				}
			);
			document.dispatchEvent(event);
		} else {
			console.log("WINNING_DIALOG: This client is NOT the winner. PRIZE_WON event NOT dispatched.");
		}
		// Clean up references
		instance.modalInstance = null; // Clear modal instance reference
		WinningDialog.currentInstance = null; // Clean up static reference
	}
}

export default WinningDialog;
