const mongoose = require('mongoose');
const Player = mongoose.model('Players'); // Changed from User to Player

// Refactored profileRead to use async/await and req.auth
module.exports.profileRead = async function (req, res) {
	// If no user ID exists in the JWT return a 401
	if (!req.auth || !req.auth._id) { // Check req.auth instead of req.payload
		return res.status(401).json({
			"message": "UnauthorizedError: private profile"
		});
	}
	try {
		// Otherwise continue
		const player = await Player.findById(req.auth._id); // Changed from User to Player
		if (!player) { // Changed from user to player
			return res.status(404).json({ "message": "Player not found" }); // Changed message
		}
		res.status(200).json(player); // Changed from user to player
	} catch (err) {
		console.error("Profile read error:", err);
		res.status(500).json({ message: "Error reading profile", error: err.message });
	}
};

// Refactored setNewBalance to use async/await and req.auth
module.exports.setNewBalance = async function (req, res) {
	if (!req.auth || !req.auth._id) { // Check req.auth
		return res.status(401).json({
			"message": "UnauthorizedError: unauthorized attempt to set balance"
		});
	}
	// It's generally better practice to update the currently authenticated user (req.auth._id)
	// instead of relying on an email sent in the body, but keeping original logic for now.
	// For Players, email is a placeholder, so using req.auth._id is more appropriate.
	// However, the original logic used req.body.email. If this needs to change, it's a larger refactor.
	// For now, let's assume we want to update the authenticated player.
	try {
		const player = await Player.findById(req.auth._id); // Changed to find by ID for the authenticated player
		if (!player) { // Changed from user to player
			return res.status(404).json({ "message": "Player not found" }); // Changed message
		}

		if (req.body.spending) {
			player.setBalance(player.balance - req.body.newSum); // Changed from user to player
		} else {
			player.setBalance(player.balance + req.body.newSum); // Changed from user to player
		}

		const updatedPlayer = await player.save(); // Changed from user to player
		res.status(200).json(updatedPlayer); // Changed from updatedUser to updatedPlayer

	} catch (err) {
		console.error("Set balance error:", err);
		res.status(500).json({ message: "Error setting balance", error: err.message });
	}
};

// Refactored setWins to use async/await and req.auth
module.exports.setWins = async function (req, res) {
	if (!req.auth || !req.auth._id) { // Check req.auth
		return res.status(401).json({
			"message": "UnauthorizedError: unauthorized attempt to set wins"
		});
	}
	// Similar to setNewBalance, ideally update based on req.auth._id
	try {
		const player = await Player.findById(req.auth._id); // Changed to find by ID for the authenticated player
		if (!player) { // Changed from user to player
			return res.status(404).json({ "message": "Player not found" }); // Changed message
		}

		player.setWins(player.wins + req.body.wins); // Changed from user to player

		const updatedPlayer = await player.save(); // Changed from user to player
		res.status(200).json(updatedPlayer); // Changed from updatedUser to updatedPlayer

	} catch (err) {
		console.error("Set wins error:", err);
		res.status(500).json({ message: "Error setting wins", error: err.message });
	}
};

module.exports.profileUpdate = async function (req, res) {
	if (!req.auth || !req.auth._id) {
		return res.status(401).json({
			"message": "UnauthorizedError: private profile"
		});
	}
	try {
		const player = await Player.findById(req.auth._id); // Changed from User to Player
		if (!player) { // Changed from user to player
			return res.status(404).json({ "message": "Player not found" }); // Changed message
		}

		// Update fields if they are provided in the request body
		// Note: 'name' for Player model is piUsername, which shouldn't be changed by user here.
		// If you want to allow changing a display name separate from piUsername, add a new field to Player model.
		// For now, commenting out direct name update.
		// if (req.body.name) player.name = req.body.name;
		if (req.body.country) player.country = req.body.country;
		if (req.body.city) player.city = req.body.city;
		if (req.body.age) player.age = req.body.age;
		if (req.body.hobby) player.hobby = req.body.hobby;
		if (req.body.interests) player.interests = req.body.interests;

		const updatedPlayer = await player.save(); // Changed from user to player
		res.status(200).json(updatedPlayer); // Changed from updatedUser to updatedPlayer

	} catch (err) {
		console.error("Profile update error:", err);
		res.status(500).json({ message: "Error updating profile", error: err.message });
	}
};
