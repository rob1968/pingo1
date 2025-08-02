import Card from './card';
import { EventsConsts } from '../events/events-consts';
import ViewManipulator from '../utils/view-manipulator';
import Initializer from '../initializer/initializer'; // Import Initializer to access currentRoomId

class CardDrawer {
	constructor(element, socket) { // Accept socket instance
		this.element = element; // Store the container element
		this.socket = socket;   // Store socket instance
		this.cardInstances = []; // Initialize array to hold Card instances
		this.currentCardData = null; // Add property to store the raw card data
		// Removed START_GAME and END_GAME listeners
	}

	// Made draw non-static
	draw(objCards) {
		// console.log("CARD_DRAWER: Draw called with data:", objCards); // Log input data
		if (!objCards || typeof objCards !== 'object' || Object.keys(objCards).length === 0) {
			console.error("CARD_DRAWER: Invalid or empty card data received. Cannot draw cards.");
			this.currentCardData = null; // Ensure it's null if data is invalid
			return;
		}
		this.currentCardData = objCards; // Store the raw card data
		if (!this.element) {
			console.error("CARD_DRAWER: Container element is missing. Cannot draw cards.");
			return;
		}

		const countCards = Object.keys(objCards).length;
		this.cardInstances = []; // Clear previous instances
		const cardElements = []; // Temporary array for DOM elements
		// console.log(`CARD_DRAWER: Attempting to generate ${countCards} card instances.`);

		const currentRoomId = Initializer.currentRoomId; // Get current room ID
		if (!currentRoomId) {
		    console.error("CARD_DRAWER: Cannot draw cards, currentRoomId is not set in Initializer.");
		    // alert("Error: Cannot display cards, no active room context."); // Optional user feedback
		    return;
		}

		try {
			for (let i = 0; i < countCards; i++) {
				const cardKey = 'card' + (i + 1);
				if (!objCards[cardKey]) {
					console.warn(`CARD_DRAWER: Missing data for ${cardKey}`);
					continue;
				}
				// Pass socket instance, card key, AND roomId to Card constructor
				const cardInstance = this.generateCardTable(objCards[cardKey], this.socket, cardKey, currentRoomId);
				if (cardInstance && cardInstance.divCard) {
					this.cardInstances.push(cardInstance); // Store the Card instance
					cardElements.push(cardInstance.divCard); // Get the DOM element from the instance
				} else {
					console.error(`CARD_DRAWER: Failed to generate card instance or divCard for ${cardKey}`);
				}
			}
		} catch (error) {
			console.error("CARD_DRAWER: Error during card instance generation:", error);
			return; // Stop if instance generation fails
		}


		// Clean the cards container first
		// console.log("CARD_DRAWER: Clearing container element:", this.element);
		this.element.innerHTML = '';

		// Append new cards
		// console.log(`CARD_DRAWER: Appending ${cardElements.length} card elements.`);
		cardElements.forEach((el) => {
			if (el instanceof Node) { // Ensure it's a valid DOM node
				this.element.appendChild(el);
			} else {
				console.error("CARD_DRAWER: Attempted to append invalid element:", el);
			}
		});

		// console.log("CARD_DRAWER: Toggling container visibility to true.");
		ViewManipulator.toggleVisibility(this.element, true); // Show the container
	}

	// Made generateCardTable non-static, pass socket, cardKey, and roomId
	generateCardTable(objCard, socket, cardKey, roomId) {
		return new Card(objCard, socket, cardKey, roomId); // Pass socket, cardKey, and roomId to Card
	}

	// Getter for card instances
	getCardInstances() {
		return this.cardInstances;
	}

	// New method to retrieve the stored card data
	getCardData() {
		return this.currentCardData;
	}
}

export default CardDrawer;
