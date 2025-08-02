import { EventsConsts } from '../events/events-consts';
import { WinningPatterns } from '../utils/winning-patterns';

class Card {
	constructor(objCard) {
		this.arrDrawnNumbers = [];
		this.divCard = document.createElement('div');
		this.divCard.setAttribute('id', 'card');
		this.divCard.setAttribute('class', 'col-xs-6 col-sm-3');
		this.divCard.innerHTML = '<table>' +
			'<tr>' +
			'<th class="firstCol">B</th>' +
			'<th class="secondCol">I</th>' +
			'<th class="thirdCol">N</th>' +
			'<th class="fourthCol">G</th>' +
			'<th class="fifthCol">O</th>' +
			'</tr>' +
			'<tr>' +
			'<td id="11">' + objCard.col1[0] + '</td>' +
			'<td id="21">' + objCard.col2[0] + '</td>' +
			'<td id="31">' + objCard.col3[0] + '</td>' +
			'<td id="41">' + objCard.col4[0] + '</td>' +
			'<td id="51">' + objCard.col5[0] + '</td>' +
			'</tr>' +
			'<tr>' +
			'<td id="12">' + objCard.col1[1] + '</td>' +
			'<td id="22">' + objCard.col2[1] + '</td>' +
			'<td id="32">' + objCard.col3[1] + '</td>' +
			'<td id="42">' + objCard.col4[1] + '</td>' +
			'<td id="52">' + objCard.col5[1] + '</td>' +
			'</tr>' +
			'<tr>' +
			'<td id="13">' + objCard.col1[2] + '</td>' +
			'<td id="23">' + objCard.col2[2] + '</td>' +
			'<td id="33">' + objCard.col3[2] + '</td>' +
			'<td id="43">' + objCard.col4[2] + '</td>' +
			'<td id="53">' + objCard.col5[2] + '</td>' +
			'</tr>' +
			'<tr>' +
			'<td id="14">' + objCard.col1[3] + '</td>' +
			'<td id="24">' + objCard.col2[3] + '</td>' +
			'<td id="34">' + objCard.col3[3] + '</td>' +
			'<td id="44">' + objCard.col4[3] + '</td>' +
			'<td id="54">' + objCard.col5[3] + '</td>' +
			'</tr>' +
			'<tr>' +
			'<td id="15">' + objCard.col1[4] + '</td>' +
			'<td id="25">' + objCard.col2[4] + '</td>' +
			'<td id="35">' + objCard.col3[4] + '</td>' +
			'<td id="45">' + objCard.col4[4] + '</td>' +
			'<td id="55">' + objCard.col5[4] + '</td>' +
			'</tr>' +
			'</table>';

		this.divCard.addEventListener('click', (e) => {
			this.clickCell(e.target);
		});

		document.addEventListener(EventsConsts.NEW_BALL_DRAWN, (e) => {
			// Removed listener for local NEW_BALL_DRAWN event. Will rely on checkAndMarkNumber.
		});

		this.arrWinningNumbers = [];

		// Constructor should not return the element directly
	}

	clickCell(element) {
		Card.markNumber(element);
		const clickedElementValue = parseInt(element.innerText);
		if (clickedElementValue && !isNaN(clickedElementValue)) {
			// The check against arrDrawnNumbers is removed here, as clicking should only toggle 'marked'
			// The actual marking as 'drawn' and win checking happens in checkAndMarkNumber
			if (!element.classList.contains('drawn')) {
				// We only toggle 'marked' on click now.
				// Win checking logic is moved to checkAndMarkNumber
				// this.arrWinningNumbers.push(element.id); // Moved
				Card.markDrawnNumber(element);

				let isBingo = false;
				if (WinningPatterns.checkHorizontalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkVerticalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkDiagonalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkCornersPattern(this.arrWinningNumbers)) {
					isBingo = true;
				}

				if (isBingo) {
					const elTable = element.parentElement.parentElement.parentElement.parentElement;
					elTable.classList.add('bingo');

					// Dispatch new event when a Bingo is won
					const event = new CustomEvent(EventsConsts.BINGO, {
							detail: {
								time: new Date()
							}, bubbles: true, cancelable: true
						}
					);
					this.divCard.dispatchEvent(event);
				}
			}
		}
	}

	// New method to check and mark a number received from the server
	checkAndMarkNumber(number) {
		const cells = this.divCard.querySelectorAll('td');
		for (const cell of cells) {
			if (parseInt(cell.innerText) === number && !cell.classList.contains('drawn')) {
				// Found the cell, mark it
				this.arrWinningNumbers.push(cell.id); // Add ID for win checking
				Card.markDrawnNumber(cell);

				// Check for Bingo
				let isBingo = false;
				if (WinningPatterns.checkHorizontalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkVerticalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkDiagonalPattern(this.arrWinningNumbers)) {
					isBingo = true;
				} else if (WinningPatterns.checkCornersPattern(this.arrWinningNumbers)) {
					isBingo = true;
				}

				if (isBingo) {
					const elTable = cell.closest('table'); // Find the parent table
					if (elTable) elTable.classList.add('bingo');

					// Dispatch BINGO event
					const event = new CustomEvent(EventsConsts.BINGO, { detail: { time: new Date() }, bubbles: true, cancelable: true });
					this.divCard.dispatchEvent(event);
				}
				break; // Stop searching once the number is found and marked on this card
			}
		}
	}

	static markNumber(el) {
		if (!el.classList.contains('drawn') && el.id !== '33')
			el.classList.toggle('marked');
	}

	static markDrawnNumber(el) {
		if (!el.classList.contains('drawn'))
			el.classList.add('drawn'); // Keep this static method
	}
}

export default Card;
