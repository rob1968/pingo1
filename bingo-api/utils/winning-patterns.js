// Server-side copy of utility functions needed for Bingo checking

const Utils = {
  eliminateDuplicates(arr) {
    // Ensure input is an array before using Set
    if (!Array.isArray(arr)) {
        console.error("eliminateDuplicates received non-array:", arr);
        return [];
    }
    return [...new Set(arr)];
  },

  countInArray(array, what) {
    // Ensure input is an array before filtering
    if (!Array.isArray(array)) {
        console.error("countInArray received non-array:", array);
        return 0;
    }
    // Use loose equality (==) as in original, but consider strict (===) if types are certain
    return array.filter(item => item == what).length;
  }
};

const WinningPatterns = {
	// Free space ID (adjust if different)
	FREE_SPACE_ID: "33",

	// arr: Array of marked cell IDs (e.g., ["11", "12", "13", "14", "15"])
	// Returns: { isBingo: boolean, patternType?: string, winningCells?: string[] }
	checkHorizontalPattern(arr) {
		if (!Array.isArray(arr) || arr.length < 4) return { isBingo: false };

		const markedSet = new Set(arr);
		if (markedSet.has(this.FREE_SPACE_ID)) {
			markedSet.delete(this.FREE_SPACE_ID); // Temporarily remove free space for counting
		}

		for (let row = 1; row <= 5; row++) {
			const requiredCount = (row === 3) ? 4 : 5; // Row 3 needs 4 marks + free space
			let count = 0;
			let potentialWinningCells = [];
			for (let col = 1; col <= 5; col++) {
				const cellId = `${col}${row}`;
				if (markedSet.has(cellId)) {
					count++;
					potentialWinningCells.push(cellId);
				}
			}

			if (count >= requiredCount) {
				// Add free space back if it was row 3
				if (row === 3) {
					potentialWinningCells.push(this.FREE_SPACE_ID);
				}
				return {
					isBingo: true,
					patternType: 'horizontal',
					winningCells: potentialWinningCells
				};
			}
		}
		return { isBingo: false };
	},

	// arr: Array of marked cell IDs (e.g., ["11", "21", "31", "41", "51"])
	// Returns: { isBingo: boolean, patternType?: string, winningCells?: string[] }
	checkVerticalPattern(arr) {
		if (!Array.isArray(arr) || arr.length < 4) return { isBingo: false };

		const markedSet = new Set(arr);
		if (markedSet.has(this.FREE_SPACE_ID)) {
			markedSet.delete(this.FREE_SPACE_ID); // Temporarily remove free space
		}

		for (let col = 1; col <= 5; col++) {
			const requiredCount = (col === 3) ? 4 : 5; // Column 3 needs 4 marks + free space
			let count = 0;
			let potentialWinningCells = [];
			for (let row = 1; row <= 5; row++) {
				const cellId = `${col}${row}`;
				if (markedSet.has(cellId)) {
					count++;
					potentialWinningCells.push(cellId);
				}
			}

			if (count >= requiredCount) {
				// Add free space back if it was column 3
				if (col === 3) {
					potentialWinningCells.push(this.FREE_SPACE_ID);
				}
				return {
					isBingo: true,
					patternType: 'vertical',
					winningCells: potentialWinningCells
				};
			}
		}
		return { isBingo: false };
	},

	// arr: Array of marked cell IDs
	// Returns: { isBingo: boolean, patternType?: string, winningCells?: string[] }
	checkDiagonalPattern(arr) {
		if (!Array.isArray(arr) || arr.length < 4) return { isBingo: false };

		const markedSet = new Set(arr); // Use Set for efficient checking
		const arrPatternLeft = ["11", "22", "44", "55"]; // Needs 4 marks (excluding free space 33)
		const arrPatternRight = ["15", "24", "42", "51"]; // Needs 4 marks (excluding free space 33)

		// Check left diagonal (\) - requires free space implicitly
		const hasLeftDiagonal = arrPatternLeft.every(elem => markedSet.has(elem));
		if (hasLeftDiagonal) {
			return {
				isBingo: true,
				patternType: 'diagonal-left',
				winningCells: [...arrPatternLeft, this.FREE_SPACE_ID] // Include free space
			};
		}

		// Check right diagonal (/) - requires free space implicitly
		const hasRightDiagonal = arrPatternRight.every(elem => markedSet.has(elem));
		if (hasRightDiagonal) {
			return {
				isBingo: true,
				patternType: 'diagonal-right',
				winningCells: [...arrPatternRight, this.FREE_SPACE_ID] // Include free space
			};
		}

		return { isBingo: false };
	},

	// arr: Array of marked cell IDs
	// Returns: { isBingo: boolean, patternType?: string, winningCells?: string[] }
	checkCornersPattern(arr) {
		if (!Array.isArray(arr) || arr.length < 4) return { isBingo: false };

		const markedSet = new Set(arr);
		const arrPattern = ["11", "15", "51", "55"]; // Needs all 4 corners

		const hasCorners = arrPattern.every(elem => markedSet.has(elem));
		if (hasCorners) {
			return {
				isBingo: true,
				patternType: 'corners',
				winningCells: arrPattern
			};
		}
		return { isBingo: false };
	}
};

// Export for use in server.js
module.exports = { WinningPatterns };