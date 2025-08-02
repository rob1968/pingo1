const mongoose = require('mongoose');
let gracefulShutdown;
const db = mongoose.connection;

mongoose
  .connect(process.env.DB_URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
  })
  .then(() => console.log('DB Connected.'))
  .catch(err => {
    console.log(`DB Connection Error: ${err.message}`);
  });
// mongoose.set('useCreateIndex', true); // Removed deprecated option

db.on('connected', function () {
  console.log('Mongoose connected to ' + process.env.DB_URI);
});
db.on('error', function (err) {
  console.log('Mongoose connection error: ' + err);
});
db.on('disconnected', function () {
  console.log('Mongoose disconnected');
});

// Updated gracefulShutdown to use async/await with db.close()
// Simplified gracefulShutdown
gracefulShutdown = async function (msg) {
  try {
    await db.close();
    console.log('Mongoose disconnected through ' + msg);
  } catch (err) {
    console.error('Error during Mongoose disconnection:', err);
  }
};

// Signal handlers moved to server.js to ensure they are attached after server starts listening

require('./users');
require('./admins');

// Export gracefulShutdown so server.js can use it
module.exports.gracefulShutdown = gracefulShutdown;
