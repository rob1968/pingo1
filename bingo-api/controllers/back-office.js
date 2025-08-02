const mongoose = require('mongoose');
const User = mongoose.model('Users');

// Refactored getPlayersData with async/await
module.exports.getPlayersData = async function (req, res) {
	try {
		const allUsers = await User.find(); // Use await
		res.status(200).json(allUsers);
	} catch (err) {
		console.error("Get players data error:", err);
		res.status(500).json({ message: "Error getting players data", error: err.message });
	}
};

// Refactored createPlayer with async/await
module.exports.createPlayer = async function (req, res) {
	try {
		const playerData = req.body.objPlayerData; // Simplify access
		if (!playerData || !playerData.email || !playerData.name || !playerData.password || playerData.balance === undefined || playerData.wins === undefined) {
			return res.status(400).json({ message: "Missing required player data fields" });
		}

		// Check for existence
		const count = await User.countDocuments({ email: playerData.email }); // Use countDocuments

		if (count > 0) {
			return res.status(200).json({ // Return early
				'isExisted': true
			});
		}

		// Create and save new user
		const user = new User();
		user.name = playerData.name;
		user.email = playerData.email;
		user.setBalance(playerData.balance);
		user.setWins(playerData.wins);
		user.setPassword(playerData.password);

		await user.save(); // Use await

		const token = user.generateJwt();
		res.status(200).json({
			'token': token // Note: Sending token on admin creation might be unusual, review if needed
		});

	} catch (err) {
		console.error("Create player error:", err);
		res.status(500).json({ message: "Error creating player", error: err.message });
	}
};

// Refactored deletePlayer with async/await and deleteOne
module.exports.deletePlayer = async function (req, res) {
	if (!req.body.email) {
		return res.status(400).json({ // Use 400 for bad request
			"message": "Missing email for deletion"
		});
	}
	try {
		const result = await User.deleteOne({ "email": req.body.email }); // Use deleteOne and await
		if (result.deletedCount === 0) {
			return res.status(404).json({ message: "User not found for deletion" });
		}
		res.status(200).json({ message: "User deleted successfully", result: result }); // Send meaningful response
	} catch (err) {
		console.error("Delete player error:", err);
		res.status(500).json({ message: "Error deleting player", error: err.message });
	}
};

// Refactored updatePlayerData with async/await
module.exports.updatePlayerData = async function (req, res) {
	const playerData = req.body.objPlayerData; // Simplify access
	if (!playerData || !playerData.email) {
		return res.status(400).json({ // Use 400 for bad request
			"message": "Missing player email for update"
		});
	}
	try {
		const user = await User.findOne({ email: playerData.email }); // Use await
		if (!user) {
			return res.status(404).json({ "message": "User not found for update" });
		}

		// Update fields if provided
		user.name = playerData.name !== undefined ? playerData.name : user.name;
		user.email = playerData.email; // Assuming email can be updated, might need validation if unique
		if (playerData.balance !== undefined) user.setBalance(playerData.balance);
		if (playerData.wins !== undefined) user.setWins(playerData.wins);
		if (playerData.password) user.setPassword(playerData.password); // Update password if provided

		const updatedUser = await user.save(); // Use await
		res.status(200).json(updatedUser);

	} catch (err) {
		console.error("Update player data error:", err);
		res.status(500).json({ message: "Error updating player data", error: err.message });
	}
};
