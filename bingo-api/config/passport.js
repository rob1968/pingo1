const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const mongoose = require('mongoose');
const User = mongoose.model('Users');
const Admin = mongoose.model('Admins');


// Refactored adminLogin strategy with async/await
passport.use('adminLogin', new LocalStrategy({
		usernameField: 'email'
	},
	async function(username, password, done) { // Added async
		try {
			const admin = await Admin.findOne({ email: username }); // Use await

			if (!admin) {
				return done(null, false, {
					message: 'Admin not found'
				});
			}

			if (!admin.validPassword(password)) {
				return done(null, false, {
					message: 'Password is wrong'
				});
			}

			return done(null, admin);
		} catch (err) {
			return done(err); // Pass error to done callback
		}
	}
));
