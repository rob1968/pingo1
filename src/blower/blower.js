import ViewManipulator from '../utils/view-manipulator';
import { paper } from '../../node_modules/paper/dist/paper-full';
import { NumbersGenerator } from '../utils/numbers-generator';
import { EventsConsts } from '../events/events-consts';

class Ball {
	constructor(point, vector) {
		if (!vector || vector.isZero()) {
			this.vector = {x: Math.random() * 5, y: Math.random() * 5};
		} else {
			this.vector = {x: vector.x * 2, y: vector.y * 2};
		}

		this.point = point;
		this.dampen = 0.4;
		this.gravity = 3;
		Ball.bounce = -0.6;

		let color = {
			hue: Math.random() * 360,
			saturation: 1,
			brightness: 1
		};
		let gradient = new paper.Gradient([color, 'black'], true);
		let radius = this.radius = 15;
		let ball = new paper.Group({
			children: [
				new paper.Path.Circle({
					radius: radius
				})
			],
			fillColor: new paper.Color(gradient, 0, radius, radius / 8)
		});

		let txt = new paper.PointText(this.center);
		txt.style = {
			justification: 'center',
			fontWeight: 'bold',
			fillColor: 'white'
		};

		txt.content = NumbersGenerator.getRandomNumber(1, 75);
		ball.addChild(txt);

		this.item = new paper.Group({
			children: [ball],
			transformContent: false,
			position: this.point
		});
	}

	iterate() {
	console.log("BALL: iterate called for a ball"); // Uncommented for detailed tracing
		let size = paper.view.size;
		this.vector.y += this.gravity;
		this.vector.x *= 0.99;
		let pre = {
			x: this.point.x + this.vector.x,
			y: this.point.y + this.vector.y
		};


		if (pre.x < this.radius || pre.x > size.width - this.radius)
			this.vector.x *= -this.dampen / 2;

		if (pre.y < this.radius || pre.y > size.height - this.radius) {
			if (Math.abs(this.vector.x) < 3) {
				this.vector = {
					x: Math.random() * 150,
					y: Math.random() * 320
				};
			}
			this.vector.y *= Ball.bounce / 2;
		}

		let max = paper.Point.max(this.radius, {
			x: this.point.x + this.vector.x,
			y: this.point.y + this.vector.y
		});

		this.item.position = this.point = paper.Point.min(max, {
			x: size.width - this.radius,
			y: size.height - this.radius
		});
		this.item.rotate(this.vector.x);
	}

	putBallsOnBottom() {
		let size = paper.view.size;
		this.vector.y += this.gravity;
		this.vector.x *= 0.99;
		let pre = {
			x: this.point.x + this.vector.x,
			y: this.point.y + this.vector.y
		};

		if (pre.x < this.radius || pre.x > size.width - this.radius)
			this.vector.x *= -this.dampen;

		if (pre.y < this.radius || pre.y > size.height - this.radius) {
			if (Math.abs(this.vector.x) < .3) {
				this.vector = {
					x: Math.random() * 150,
					y: Math.random() * 320
				};
			}
		}

		let max = paper.Point.max(this.radius, {
			x: this.point.x + this.vector.x,
			y: this.point.y + this.vector.y
		});

		this.item.position = this.point = paper.Point.min(max, {
			x: size.width - this.radius,
			y: size.height - this.radius
		});
		this.item.rotate(this.vector.x);
	}
}

class Blower {
	constructor(element) {
		console.log("BLOWER: Constructor called with element:", element); // Log constructor

		// Controleer of het canvas-element correct wordt geïnitialiseerd
		if (!element || !(element instanceof HTMLCanvasElement)) {
			throw new Error('Het opgegeven element is geen geldig canvas-element. Controleer of het element correct wordt doorgegeven.');
		}

		// Controleer of paper.js correct is ingesteld
		if (!paper || !paper.setup) {
			throw new Error('paper.js is niet correct geladen of ingesteld. Controleer of de library correct is geïmporteerd.');
		}

		this.element = element;
		this.balls = [];
		// Removed START_GAME and END_GAME listeners. Control will come from Initializer.
		this.init = {
			play: false,
			isPlaying: false
		};

		if (element) {
			element.setAttribute('width', '208px');
			element.setAttribute('height', '208px');
			paper.setup(element);
			console.log("BLOWER: paper.setup called. paper.view:", paper.view); // Log paper.view after setup
			// ViewManipulator.toggleVisibility(this.element, true); // Remove this
			this.element.style.display = 'block'; // Force display style directly
		} else {
			throw new Error('There is no canvas element to draw the blower in.');
		}

		for (let i = 0; i < 75; i++) {
			let position = {
					x: Math.random() * (paper.view.size.width - 1) + 1,
					y: Math.random() * (paper.view.size.height - 140) + 140
				},
				vector = new paper.Point((Math.random() - 0.5) * 50, Math.random() * 100),
				ball = new Ball(position, vector);

			this.balls.push(ball);
		}

		// Controleer of het canvas-element zichtbaar is
		if (getComputedStyle(this.element).display === 'none' || getComputedStyle(this.element).visibility === 'hidden') {
			console.warn('Het canvas-element is verborgen. Controleer de CSS-stijlen.');
		}

		paper.view.onFrame = () => {
			try { // Add try block
				console.log("BLOWER: onFrame executing. play:", this.init.play, "isPlaying:", this.init.isPlaying); // Log frame execution
				for (let i = 0, l = this.balls.length; i < l; i++) {
					if (this.init.play) {
						// console.log(`BLOWER: iterating ball ${i} at position`, this.balls[i].point); // Log ball position (optional)
						this.balls[i].iterate();
					} else if (this.init.play === false && this.init.isPlaying === true) {
						// console.log(`BLOWER: putting ball on bottom ${i} at position`, this.balls[i].point); // Log ball position (optional)
						this.balls[i].putBallsOnBottom();
					}
				}
			} catch (error) { // Add catch block
				console.error("BLOWER: Error inside onFrame handler:", error);
				if (paper.view) paper.view.pause(); // Stop the loop if an error occurs
			}
		};
	}

	startAnimation() {
		console.log("BLOWER: startAnimation called"); // Log start
		// ViewManipulator.toggleVisibility(this.element, true); // Removed
		for (let i = 0, l = this.balls.length; i < l; i++) {
			this.balls[i].point = {
				x: Math.random() * (paper.view.size.width - 10) + 10,
				y: Math.random() * (paper.view.size.height - 10) + 10
			};
		}
		this.init.play = true;
		this.init.isPlaying = true;
		if (paper.view) {
			paper.view.play(); // Explicitly start the view's animation loop
		}
	}

	stopAnimation() {
		console.log("BLOWER: stopAnimation called"); // Log stop
		this.init.play = false;
		if (paper.view) {
			paper.view.pause(); // Explicitly pause the view's animation loop
		}

		setTimeout(() => {
			this.init.isPlaying = false;
			// ViewManipulator.toggleVisibility(this.element, false); // Remove this for now
		}, 5000);
	}
}

export default Blower;
