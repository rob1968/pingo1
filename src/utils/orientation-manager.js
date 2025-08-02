class OrientationManager {
  constructor() {
    this.promptElement = document.getElementById('orientationPrompt');
    this.messageElement = document.getElementById('orientationMessage');
    this.currentCardCount = 0;

    if (!this.promptElement || !this.messageElement) {
      console.error("OrientationManager: Could not find prompt elements (#orientationPrompt or #orientationMessage).");
      return;
    }

    // Use matchMedia for more reliable orientation detection
    this.portraitMatcher = window.matchMedia("(orientation: portrait)");
    this.landscapeMatcher = window.matchMedia("(orientation: landscape)");

    // Add listener for changes
    this.portraitMatcher.addEventListener('change', () => this.checkOrientation());
    // No need to listen to landscape, portrait change covers both transitions

    console.log("OrientationManager initialized.");
    // Initial check
    this.checkOrientation();
  }

  updateCardCount(count) {
    console.log(`OrientationManager: Updating card count to ${count}`);
    this.currentCardCount = count;
    this.checkOrientation(); // Re-check orientation logic when card count changes
  }

  isPortrait() {
    // Check screen dimensions as a fallback or primary method
    // return window.innerHeight > window.innerWidth;
    // Use matchMedia result
    return this.portraitMatcher.matches;
  }

  checkOrientation() {
    if (!this.promptElement) return; // Guard if elements weren't found

    const isPortrait = this.isPortrait();
    console.log(`OrientationManager: Checking orientation. Cards: ${this.currentCardCount}, IsPortrait: ${isPortrait}`);

    if (this.currentCardCount > 2 && isPortrait) {
      this.showMessage("Please rotate your device to landscape mode for the best experience with multiple cards.");
    } else if (this.currentCardCount <= 2 && !isPortrait) {
      // Optional: Prompt for portrait if landscape with few cards isn't ideal
      // this.showMessage("Portrait mode is recommended for 1 or 2 cards.");
      this.hidePrompt(); // For now, just hide if landscape is okay
    } else {
      this.hidePrompt(); // Hide prompt if orientation matches card count recommendation
    }
  }

  showMessage(message) {
    if (this.messageElement && this.promptElement) {
      console.log(`OrientationManager: Showing prompt - ${message}`);
      this.messageElement.textContent = message;
      this.promptElement.style.display = 'flex'; // Use flex to enable align/justify
    }
  }

  hidePrompt() {
    if (this.promptElement) {
      // Only log if it was previously visible
      if (this.promptElement.style.display !== 'none') {
          console.log("OrientationManager: Hiding prompt.");
      }
      this.promptElement.style.display = 'none';
    }
  }
}

export default OrientationManager;