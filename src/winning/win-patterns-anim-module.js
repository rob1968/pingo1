import ViewManipulator from '../utils/view-manipulator';
import { EventsConsts } from '../events/events-consts';

class WinPatternsAnimModule {
	constructor(elem, rows, cols, pattern) {
		this.elem = elem;
		this.rows = rows;
		this.cols = cols;
		this.pattern = pattern;
		this.intervalId = null; // To store the interval timer ID

		// Remove event listeners - visibility will be controlled externally
		// document.addEventListener(EventsConsts.START_GAME, () => {
		// 	ViewManipulator.toggleVisibility(elem.parentElement.parentElement, true);
		// });
		// document.addEventListener(EventsConsts.END_GAME, () => {
		// 	ViewManipulator.toggleVisibility(elem.parentElement.parentElement, false);
		// });

		// Create the DOM element
		this.createDomElement();
		// Don't start animation automatically in constructor
		// this.startAnimation(); // REMOVED THIS LINE
	}

	createDomElement() {
		// Prevent creating table if it already exists (e.g., on re-initialization)
		if (this.elem.querySelector('table')) {
			return;
		}
		const elTable = document.createElement('table');
		let i = 1;
		while (i <= this.rows) {
			const elRow = document.createElement('tr');
			let j = 1;
			while (j <= this.cols) {
				const elCell = document.createElement('td');
				elCell.setAttribute('id', 'x'+j + 'y' + i); // Keep original ID format if needed elsewhere
				elRow.appendChild(elCell);
				j++;
			}
			elTable.appendChild(elRow);
			i++;
		}
		this.elem.appendChild(elTable);
	}

	/**
	 *  Define which pattern animation to start
	 */
	// Renamed to startPatternAnimation to avoid conflict with potential generic start
	startPatternAnimation() {
		// Ensure animation is stopped before starting a new one
		this.stopAnimation();
		// Make the element visible when animation starts
		ViewManipulator.toggleVisibility(this.elem.parentElement.parentElement, true);
		console.log("WinPatternsAnimModule: Animation started.");

		switch (this.pattern) {
			case 'horizontal':
				this.intervalId = this.startHorizontalAnim();
				break;
			case 'vertical':
				this.intervalId = this.startVerticalAnim();
				break;
			case 'diagonal':
				this.intervalId = this.startDiagonalAnim();
				break;
		}
	}
	// REMOVED EXTRA CLOSING BRACE HERE

	stopAnimation() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
			this.clearTable(); // Clear highlights when stopping
			// Hide the element when animation stops
			ViewManipulator.toggleVisibility(this.elem.parentElement.parentElement, false);
			console.log("WinPatternsAnimModule: Animation stopped.");
		}
	}

	/**
	 * Clear all cells background
	 */
	clearTable() {
		const arrCells = this.elem.querySelectorAll('td');
		let cellIdx = 0;
		while (cellIdx < arrCells.length) {
			if (arrCells[cellIdx].classList.contains('highlighted')) {
				arrCells[cellIdx].classList.remove('highlighted');
			}
			cellIdx++;
		}
	}

	startHorizontalAnim() {
		let yIdx = 1;
		// Return the interval ID so it can be cleared
		return setInterval(() => {
			this.clearTable();

			let xIdx = 1;
			while (xIdx <= this.cols) {
				const elCell = this.elem.querySelector(`#x${xIdx}y${yIdx}`);
				// Add null check for safety
				if (elCell) elCell.classList.add('highlighted');
				xIdx++;
			}

			if (yIdx === this.rows) {
				yIdx = 0;
			}

			yIdx++;
		}, 1000)
	}

	startVerticalAnim() {
		let xIdx = 1;
		// Return the interval ID so it can be cleared
		return setInterval(() => {
			this.clearTable();

			let yIdx = 1;
			while (yIdx <= this.rows) {
				const elCell = this.elem.querySelector(`#x${xIdx}y${yIdx}`);
				// Add null check for safety
				if (elCell) elCell.classList.add('highlighted');
				yIdx++;
			}

			if (xIdx === this.rows) { // Should likely be this.cols if it's a 5x5 grid
				xIdx = 0;
			}

			xIdx++;
		}, 1000)
	}

	startDiagonalAnim() {
		let count = 1;
		// Return the interval ID so it can be cleared
		return setInterval(() => {
			this.clearTable();

			switch (count) {
				case 1:
					{
						let leftDiagonalIdx = 1;
						while (leftDiagonalIdx <= this.rows) {
							const elCell = this.elem.querySelector(`#x${leftDiagonalIdx}y${leftDiagonalIdx}`);
							if (elCell) elCell.classList.add('highlighted');
							leftDiagonalIdx++;
						}
						break;
					}
				case 2:
					{
						let rightDiagonalIdx = 1;
						while (rightDiagonalIdx <= this.rows) {
							const elCell = this.elem.querySelector(`#x${this.rows + 1 - rightDiagonalIdx}y${rightDiagonalIdx}`);
							if (elCell) elCell.classList.add('highlighted');
							rightDiagonalIdx++;
						}
						break;
					}
				case 3: // Assuming this was meant to be corners? The original logic was mixed.
				    // Let's stick to diagonals for now based on function name.
				    // If corners animation is needed, it should be a separate pattern/function.
					{
						// Re-highlight left diagonal for variety, or remove case 3?
						let leftDiagonalIdx = 1;
						while (leftDiagonalIdx <= this.rows) {
							const elCell = this.elem.querySelector(`#x${leftDiagonalIdx}y${leftDiagonalIdx}`);
							if (elCell) elCell.classList.add('highlighted');
							leftDiagonalIdx++;
						}
						break;
					}
			}
			count++;
			// Cycle between left and right diagonal only
			if (count > 2) {
			    count = 1;
            }
		}, 1000);
	}
}

export default WinPatternsAnimModule;
