import { EventsConsts } from '../events/events-consts';
import Animator from '../utils/animator';
import ApiController from '../API/api-controller';

class FlyingPrize {
	constructor() {
		// this.sum is no longer needed here as it comes from the event

		// REMOVED automatic listener. Animation will be triggered manually.
		// document.addEventListener(EventsConsts.PRIZE_WON, (event) => {
		// 	const prizeAmount = event.detail?.prizeAmount;
		// 	if (typeof prizeAmount === 'number' && prizeAmount > 0) {
		// 		FlyingPrize.animatePrizeFlying(prizeAmount);
		// 	} else {
		// 		console.warn("FlyingPrize: PRIZE_WON event did not contain a valid prizeAmount.", event.detail);
		// 	}
		// });
	}

	static animatePrizeFlying(sum) {
		const elFlyingPrize = document.createElement('div');
		elFlyingPrize.setAttribute('id', 'flyingPrize');
		elFlyingPrize.innerHTML = sum;
		document.body.appendChild(elFlyingPrize);

		// Animate moving the element to given top and left positions
		Animator.moveDiagonally(elFlyingPrize, 45, 45, -45, 42, Animator.quad, 3000, '%');

		document.addEventListener(EventsConsts.FLYING_PRIZE_ANIMATION_ENDS, () => {
			if (document.body.contains(elFlyingPrize)) {
				document.body.removeChild(elFlyingPrize);

				// Add the new prize sum to the player balance
				ApiController.setNewBalance(sum, false);
			}
		});
	}
}

export default FlyingPrize;
