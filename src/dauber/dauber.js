import ViewManipulator from '../utils/view-manipulator';
import { EventsConsts } from '../events/events-consts';
// Removed NumbersGenerator import as drawing is server-side
import PubSubService from '../events/pubsub-service';
import Ball from './ball';
import Animator from '../utils/animator';

class Dauber {
	constructor(conf = null, element) {
		if (conf !== null) {
			// Removed game start/end listeners and gameStarted flag
			this.conf = conf;
			this.element = element;
			// Removed arrDrawnNums and drawTimeout
			this.visibleBallNum = 0;
			this.arrVisibleBalls = [];
			this.isSecondPhase = false;
			this.pubsub = new PubSubService();
			this.pubsub.subscribe(EventsConsts.FIFTH_BALL_DRAWN, () => { this.animateVisibleBalls() });
			this.elVisibleBallsContainer = document.createElement('div');
			this.elVisibleBallsContainer.setAttribute('id', 'elVisibleBallsContainer');
			this.element.appendChild(this.elVisibleBallsContainer);
		} else {
			throw new Error('Dauber initialization error - no config');
		}
	}

	// Renamed from doDraw, now takes the number from the server
	displayNewBall(drawnNum) {
		console.log(`DAUBER: displayNewBall called with number: ${drawnNum}`); // Log entry
		const ball = new Ball(drawnNum, this.pubsub, this.conf.gameConf.skin);
		console.log(`DAUBER: Ball instance created:`, ball); // Log ball creation
		ball.draw(this.element, ++this.visibleBallNum, this.isSecondPhase); // This method is in Ball class
		this.arrVisibleBalls.push(ball);

		// Dispatch new event with the drawn number
		const event = new CustomEvent(EventsConsts.NEW_BALL_DRAWN, {
				detail: {
					drawnNumber: drawnNum,
					time: new Date()
				}, bubbles: true, cancelable: true
			}
		);
		this.element.dispatchEvent(event);

		if (this.visibleBallNum === 5) {
			this.visibleBallNum = 0;
			this.isSecondPhase = true;
		}

		// Removed client-side turn counting and game end logic
	}

	animateVisibleBalls() {
		if (this.arrVisibleBalls.length > 0) {
			ViewManipulator.toggleVisibility(this.arrVisibleBalls[0].elBall, false);
			this.arrVisibleBalls.shift();   // remove the first drawn ball from the array
			this.elVisibleBallsContainer.style.left = '0';
			if (this.elVisibleBallsContainer.lastChild) {
				this.elVisibleBallsContainer.removeChild(this.elVisibleBallsContainer.lastChild);
			}

			this.arrVisibleBalls.forEach((ball) => {
				ball.elBall.style.left = (parseInt(ball.elBall.style.left) - 15) + '%';
				Animator.rotateElement(ball.elBall, 360, Animator.linear, 500);
			});

			for (let i = 0, len = this.arrVisibleBalls.length; i < len; i++) {
				this.elVisibleBallsContainer.appendChild(this.arrVisibleBalls[i].elBall);
			}

			Animator.moveVerticalHorizontal(this.elVisibleBallsContainer, 0, -15, Animator.quad, 500, '%');
		}
	}
reset() {
		console.log("DAUBER: Resetting dauber state.");
		this.arrVisibleBalls = [];
		if (this.elVisibleBallsContainer) {
			this.elVisibleBallsContainer.innerHTML = ''; // Clear displayed balls
			this.elVisibleBallsContainer.style.left = '0'; // Reset position if needed
		}
		this.visibleBallNum = 0;
		this.isSecondPhase = false;
	}
}

export default Dauber;
