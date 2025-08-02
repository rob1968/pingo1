import { EventsConsts } from '../events/events-consts';
import { WinningPatterns } from '../utils/winning-patterns';

class Card {
	constructor(objCard, socket, cardKey, roomId) { // Accept socket instance, cardKey, and roomId
		this.socket = socket; // Store socket instance
		this.cardKey = cardKey; // Store card key (e.g., "card1")
		this.roomId = roomId; // Store current room ID
		this.arrDrawnNumbers = []; // Keep for local win check? Or move fully to server? Keep for now.
		this.divCard = document.createElement('div');
		this.divCard.setAttribute('id', 'card');
		// Use more flexible Bootstrap grid classes for better responsiveness
		// col-xs-12: Full width on extra small (portrait phone)
		// col-sm-6: Half width on small (landscape phone / portrait tablet)
		// col-md-4: Third width on medium (landscape tablet)
		// col-lg-3: Quarter width on large (desktop)
		this.divCard.setAttribute('class', 'col-xs-12 col-sm-6 col-md-4 col-lg-3');
		this.divCard.innerHTML = '<table>' +
			'<tr>' +
			'<th class="firstCol">B</th>' +
			'<th class="secondCol">I</th>' +
			'<th class="thirdCol">N</th>' +
			'<th class="fourthCol">G</th>' +
			'<th class="fifthCol">O</th>' +
			'</tr>' +
			// Generate unique IDs using cardKey
			'<tr>' +
			`<td id="${this.cardKey}-11">` + objCard.col1[0] + '</td>' +
			`<td id="${this.cardKey}-21">` + objCard.col2[0] + '</td>' +
			`<td id="${this.cardKey}-31">` + objCard.col3[0] + '</td>' +
			`<td id="${this.cardKey}-41">` + objCard.col4[0] + '</td>' +
			`<td id="${this.cardKey}-51">` + objCard.col5[0] + '</td>' +
			'</tr>' +
			'<tr>' +
			`<td id="${this.cardKey}-12">` + objCard.col1[1] + '</td>' +
			`<td id="${this.cardKey}-22">` + objCard.col2[1] + '</td>' +
			`<td id="${this.cardKey}-32">` + objCard.col3[1] + '</td>' +
			`<td id="${this.cardKey}-42">` + objCard.col4[1] + '</td>' +
			`<td id="${this.cardKey}-52">` + objCard.col5[1] + '</td>' +
			'</tr>' +
			'<tr>' +
			`<td id="${this.cardKey}-13">` + objCard.col1[2] + '</td>' +
			`<td id="${this.cardKey}-23">` + objCard.col2[2] + '</td>' +
			`<td id="${this.cardKey}-33">` + objCard.col3[2] + '</td>' + // Free space ID
			`<td id="${this.cardKey}-43">` + objCard.col4[2] + '</td>' +
			`<td id="${this.cardKey}-53">` + objCard.col5[2] + '</td>' +
			'</tr>' +
			'<tr>' +
			`<td id="${this.cardKey}-14">` + objCard.col1[3] + '</td>' +
			`<td id="${this.cardKey}-24">` + objCard.col2[3] + '</td>' +
			`<td id="${this.cardKey}-34">` + objCard.col3[3] + '</td>' +
			`<td id="${this.cardKey}-44">` + objCard.col4[3] + '</td>' +
			`<td id="${this.cardKey}-54">` + objCard.col5[3] + '</td>' +
			'</tr>' +
			'<tr>' +
			`<td id="${this.cardKey}-15">` + objCard.col1[4] + '</td>' +
			`<td id="${this.cardKey}-25">` + objCard.col2[4] + '</td>' +
			`<td id="${this.cardKey}-35">` + objCard.col3[4] + '</td>' +
			`<td id="${this.cardKey}-45">` + objCard.col4[4] + '</td>' +
			`<td id="${this.cardKey}-55">` + objCard.col5[4] + '</td>' +
			'</tr>' +
			'</table>';

		// Shared handler for both click and touch end events
		const handleTapOrClick = (e) => {
			// Prevent default actions (like link navigation if target was a link)
			// and potentially stop the browser from firing a simulated click after touchend.
			e.preventDefault();
			// Optional: Stop the event from bubbling up further if needed.
			// e.stopPropagation();

			// Determine the actual target element. For touchend, use elementFromPoint
			// based on where the touch ended, falling back to e.target if needed.
			let targetElement = e.target;
			if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length > 0) {
				targetElement = document.elementFromPoint(e.changedTouches[0].clientX, e.changedTouches[0].clientY) || e.target;
			}

			console.log(`CARD_LISTENER: ${e.type} detected on card div. Target:`, targetElement);
			this.clickCell(targetElement);
		};

		// Add listeners for both click (desktop/fallback) and touchend (mobile)
		this.divCard.addEventListener('click', handleTapOrClick);
		this.divCard.addEventListener('touchend', handleTapOrClick);


		document.addEventListener(EventsConsts.NEW_BALL_DRAWN, (e) => {
			// Removed listener for local NEW_BALL_DRAWN event. Will rely on checkAndMarkNumber.
		});

		this.arrWinningNumbers = [];

		// Listen for server approval to mark a specific cell
		if (this.socket) {
			this.socket.on('markNumberApproved', (data) => {
				// Data should contain { roomId, number, cellId }
				if (data.roomId !== this.roomId) {
					// console.log(`CARD (${this.cardKey}): Ignored markNumberApproved for different room ${data.roomId}. Current room: ${this.roomId}`);
					return;
				}
				// console.log(`CARD (${this.cardKey}): Received markNumberApproved for cell: ${data.cellId}, number: ${data.number} in room ${data.roomId}`);

				const uniqueCellId = data.cellId;
				const cellToMark = this.divCard.querySelector(`[id="${uniqueCellId}"]`);
				// console.log(`CARD_LISTENER (${this.cardKey}): Found cell element to mark (using [id="${uniqueCellId}"]):`, cellToMark);

				if (cellToMark && !cellToMark.classList.contains('drawn')) {
					if (parseInt(cellToMark.innerText) === data.number) {
						// console.log(`CARD (${this.cardKey}): Marking specific cell ${uniqueCellId} based on server approval.`);
						Card.markDrawnNumber(cellToMark);

						if (!this.arrWinningNumbers.includes(uniqueCellId)) {
							this.arrWinningNumbers.push(uniqueCellId);
						}
						this.checkLocalBingo(cellToMark);
					} else {
						// console.warn(`CARD (${this.cardKey}): Approved cell ${uniqueCellId} number mismatch. Expected ${data.number}, found ${cellToMark.innerText}. Not marking.`);
					}
				} else if (cellToMark && cellToMark.classList.contains('drawn')) {
					// console.log(`CARD (${this.cardKey}): Cell ${uniqueCellId} was already marked.`);
				} else {
					if (uniqueCellId && !uniqueCellId.startsWith(this.cardKey + '-')) {
						// This check is mostly for debugging; the primary filter is data.roomId === this.roomId
					} else {
						// console.warn(`CARD (${this.cardKey}): Could not find approved cell with ID ${uniqueCellId}.`);
					}
				}
			});
		} else {
			console.error(`CARD (${this.cardKey}): No socket instance provided. Cannot listen for mark approvals.`);
		}

		// Constructor should not return the element directly
	}

	clickCell(element) {
		console.log("CARD: clickCell method entered. Element:", element); // Log entry and element
		// Ensure the clicked element is a TD and not already marked as drawn
		if (!element || element.tagName !== 'TD' || element.classList.contains('drawn')) {
			console.log(`CARD: clickCell ignored - Element not valid TD or already drawn. TagName: ${element?.tagName}, Drawn: ${element?.classList?.contains('drawn')}`);
			return;
		}

		const clickedNumber = parseInt(element.innerText);
		// Check if it's a valid number (ignore free space)
		if (isNaN(clickedNumber)) {
			return;
		}

		// Check if marking is allowed and if the number matches the last drawn one
		// We need access to the Initializer static properties here.
		// This creates a dependency, consider passing these values down or using events.
		// Emit request to server instead of checking local state
		if (this.socket) {
			const uniqueCellId = element.id;
			// console.log(`CARD (${this.cardKey}): Emitting checkAndMarkNumberRequest for room ${this.roomId}, number ${clickedNumber}, cell ${uniqueCellId}`);
			this.socket.emit('checkAndMarkNumberRequest', {
				roomId: this.roomId, // Include roomId
				number: clickedNumber,
				cellId: uniqueCellId
			});
		} else {
			console.error(`CARD (${this.cardKey}): Cannot emit checkAndMarkNumberRequest, socket instance missing.`);
		}
		// Removed extra closing brace here
	}

	// This method is now only used for marking based on server approval (via restorePlayerData or markNumberApproved)
	// It should NOT check for bingo here, as the server should be the authority.
	// Renaming for clarity might be good later.
	checkAndMarkNumber(number) {
		const cells = this.divCard.querySelectorAll('td');
		for (const cell of cells) {
			if (parseInt(cell.innerText) === number && !cell.classList.contains('drawn')) {
				// Found the cell, mark it visually
				Card.markDrawnNumber(cell);
				// Add unique ID to local win check array if needed for UI pattern display?
				if (!this.arrWinningNumbers.includes(cell.id)) { // cell.id is now unique
					this.arrWinningNumbers.push(cell.id);
				}
				// DO NOT check for bingo or dispatch BINGO event here. Server handles it.
				break; // Stop searching once the number is found and marked on this card
			}
		}
	}

	static markNumber(el) {
		if (!el.classList.contains('drawn') && el.id !== '33')
			el.classList.toggle('marked');
	}

	static markDrawnNumber(el) {
		console.log("CARD_STATIC: markDrawnNumber called for element:", el); // Log entry
		if (el && !el.classList.contains('drawn')) {
			console.log("CARD_STATIC: Adding 'drawn' class.");
			el.classList.add('drawn');
		} else {
			console.log("CARD_STATIC: Element already had 'drawn' class or was null.");
		}
	} // Added missing closing brace for markDrawnNumber

	// Helper method to check bingo locally (e.g., for UI feedback after server approval)
	// NOTE: This will need adjustment as WinningPatterns expects non-prefixed IDs ("11", "35")
	// We need to strip the prefix before passing to WinningPatterns
	checkLocalBingo(markedCellElement) {
		// Strip cardKey prefix from IDs before checking patterns
		const strippedWinningNumbers = this.arrWinningNumbers.map(id => id.substring(this.cardKey.length + 1));
		console.log("CARD: Checking local bingo with stripped IDs:", strippedWinningNumbers);

		let isBingo = false;
		if (WinningPatterns.checkHorizontalPattern(strippedWinningNumbers)) {
			isBingo = true;
		} else if (WinningPatterns.checkVerticalPattern(strippedWinningNumbers)) {
			isBingo = true;
		} else if (WinningPatterns.checkDiagonalPattern(strippedWinningNumbers)) {
			isBingo = true;
		} else if (WinningPatterns.checkCornersPattern(strippedWinningNumbers)) {
			isBingo = true;
		}

		if (isBingo) {
			console.log("CARD: Local Bingo check positive!");
			const elTable = markedCellElement.closest('table');
			if (elTable) elTable.classList.add('bingo');
			// Dispatch BINGO event to notify Initializer, which will then notify the server.
			const event = new CustomEvent(EventsConsts.BINGO, { detail: { time: new Date(), cardKey: this.cardKey }, bubbles: true, cancelable: true });
			this.divCard.dispatchEvent(event);
		}
	}
}

export default Card;
