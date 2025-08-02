const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config();

// Establish DB connection (this also registers models)
require('./bingo-api/models/db');

// Get the Admins model (ensure it's registered in db.js or admins.js)
const Admin = mongoose.model('Admins');

// Path to the JSON file
const jsonFilePath = path.join(__dirname, 'admins.sample.json');

async function importData() {
  try {
    // Read the JSON file (assuming one JSON object per line, but file only has one line)
    const jsonData = fs.readFileSync(jsonFilePath, 'utf-8').trim(); // Read the single line and trim whitespace
    const adminDataRaw = JSON.parse(jsonData); // Parse the single object

    // Manually extract values from Extended JSON for problematic fields
    const adminData = {
      ...adminDataRaw,
      _id: adminDataRaw._id ? adminDataRaw._id.$oid : undefined, // Extract ObjectId string
      __v: adminDataRaw.__v ? parseInt(adminDataRaw.__v.$numberInt, 10) : undefined // Extract __v number
    };
    // Remove original complex objects if they exist to avoid confusion
    delete adminData._id;
    delete adminData.__v;


    // Optional: Clear existing admins before import (uncomment if needed)
    // console.log('Clearing existing admin...');
    // await Admin.deleteOne({ email: adminData.email }); // Example: delete if exists
    // console.log('Existing admin cleared.');

    // Insert the new admin using the transformed data
    console.log(`Importing 1 admin...`);
    const result = await Admin.create(adminData); // Use the cleaned data
    console.log(`Successfully imported admin: ${result.email}`);

  } catch (error) {
    console.error('Error importing admin data:', error);
  } finally {
    // Close the Mongoose connection
    await mongoose.connection.close();
    console.log('Mongoose connection closed.');
  }
}

// Wait for the initial DB connection to establish before importing
mongoose.connection.once('open', () => {
  console.log('DB connection established, starting import...');
  importData();
});

mongoose.connection.on('error', (err) => {
  console.error('DB connection error during import script:', err);
  process.exit(1); // Exit if connection fails
});