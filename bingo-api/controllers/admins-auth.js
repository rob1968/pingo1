const passport = require('passport');
const mongoose = require('mongoose');
const Admin = mongoose.model('Admins');

// Refactored register function to use async/await
module.exports.register = async function (req, res) {
	try {
		const admin = new Admin();
		admin.name = req.body.name;
		admin.email = req.body.email;

		// Check for existence using await
		const count = await Admin.countDocuments({ email: admin.email }); // Use countDocuments

		if (count > 0) {
			res.status(200).json({
				'isExisted': true
			});
		} else {
			admin.setPassword(req.body.password);

			// Save admin using await
			await admin.save();

			const token = admin.generateJwt();
			res.status(200).json({
				'token': token
			});
		}
	} catch (err) {
		console.error("Admin registration error:", err); // Log the error server-side
		res.status(500).json({ message: "Admin registration failed", error: err.message });
	}
};

module.exports.loginAdmin = function (req, res) {
	passport.authenticate('adminLogin', function (err, admin, info) {
		let token;

		if (err) {
			res.status(404).json(err);
			return;
		}

		if (admin) {
			token = admin.generateJwt();
			res.status(200);
			res.json({
				'token': token
			});
		} else {
			res.status(401).json(info);
		}
	})(req, res);
};
