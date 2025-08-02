const mongoose = require('mongoose');
const User = mongoose.model('Users');

// These functions are no longer needed as authentication is handled by Pi SDK
// module.exports.register = async function (req, res) { ... };
// module.exports.login = function (req, res) { ... };
