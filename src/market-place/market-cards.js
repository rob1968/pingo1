import { EventsConsts } from '../events/events-consts';
import ViewManipulator from '../utils/view-manipulator';
import ApiController from '../API/api-controller';

class MarketCards {
  constructor(container) {
    this.container = container;

    document.addEventListener(EventsConsts.END_GAME, () => {
      setTimeout(() => {
        ViewManipulator.toggleVisibility(container, true);
        ViewManipulator.toggleVisibility(document.querySelector('#footer'), true);
      }, 5000);
    });
  }

  getRadioButtonsArray() {
    return this.container.querySelectorAll('input[type=radio]');
  }

  static getPurchasedCardsCount(arrRadioButtons) {
    let numberOfCards = 0;
    for (let i = 0; i < arrRadioButtons.length; i++) {
      if (arrRadioButtons[i].checked) {
        numberOfCards = Number(arrRadioButtons[i].value);
        break;
      }
    }
    return numberOfCards;
  }

  static setCardPrices(price, arrElements) {
    arrElements.forEach(el => {
      const radio = el.querySelector('input[type=radio]');
      const priceElement = el.querySelector('.price');
      if (radio && priceElement) {
        const howManyCards = Number(radio.value);
        const totalPrice = parseInt(price * howManyCards);
        priceElement.innerHTML = `<i class="price-icon"></i>${totalPrice}`;
      } else {
        console.warn("MARKET: Skipped setting price due to missing element(s)");
      }
    });
    return arrElements;
  }

  static buyCards(count, price) {
    const totalSpent = Number(count) * Number(price);

    ApiController.getPlayerBalancePromise()
      .then(balance => {
        if (Number(balance) >= totalSpent) {
          // Deduct balance and update UI
          ApiController.setNewBalance(totalSpent); // Call the method to update balance

          // Dispatch event (might still be needed for other UI updates)
          const event = new CustomEvent(EventsConsts.ENOUGH_BALANCE);
          document.dispatchEvent(event);
        } else {
          alert("You don't have enough balance to buy these cards.");
          console.warn("MARKET: Insufficient balance. Needed:", totalSpent, "Available:", balance);
        }
      })
      .catch(err => {
        alert("Unable to retrieve balance. Please try again.");
        console.error("MARKET: Error checking balance in buyCards:", err);
      });
  }
}

export default MarketCards;
