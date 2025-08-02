const mongoose = require('mongoose');
const jwt = require('jsonwebtoken'); // Add jwt import

const playerSchema = new mongoose.Schema({
  email: { // Placeholder, as Pi might not provide email by default
    type: String,
    unique: false, // Email is not unique if it's a placeholder
    required: false // Email is not required if it's a placeholder
  },
  name: { // This will be the Pi username
    type: String,
    required: true
  },
  piUid: { // Pi User ID - primary identifier from Pi
    type: String,
    unique: true,
    required: true, // Essential for Pi-based login
    index: true     // Good for query performance
  },
  piUsername: { // Store the Pi username explicitly
    type: String,
    required: true
  },
  balance: {
    type: Number,
    required: true,
    default: 50 // Default balance for new players
  },
  wins: {
    type: Number,
    required: true,
    default: 0 // Default wins for new players
  },
  cards: { // Store player's active bingo cards
    type: mongoose.Schema.Types.Mixed, // Flexible type for nested card objects
    default: {} // Default to an empty object if no cards are active
  },
  markedCells: { // Store marked cells for each card
    type: mongoose.Schema.Types.Mixed, // Flexible type for marked cells object
    default: {} // Default to an empty object
  },
  country: {
    type: String,
    required: false
  },
  city: {
    type: String,
    required: false
  },
  age: {
    type: Number,
    required: false
  },
  hobby: {
    type: String,
    required: false
  },
  interests: {
    type: String,
    required: false
  }
});

// Methods for balance and wins can be useful
playerSchema.methods.setBalance = function(amount) {
	this.balance = amount;
};

playerSchema.methods.setWins = function(count) {
	this.wins = count;
};

playerSchema.methods.generateJwt = function() {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 7);

	return jwt.sign({
		_id: this._id,
		piUid: this.piUid,
		piUsername: this.piUsername, // Use piUsername from schema
		name: this.name, // This is the Pi username
		balance: this.balance,
		wins: this.wins,
		exp: parseInt(expiry.getTime() / 1000)
	}, process.env.DB_SECRET);
};

mongoose.model('Players', playerSchema);