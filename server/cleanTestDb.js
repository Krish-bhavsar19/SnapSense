require('dotenv').config();
const mongoose = require('mongoose');

const TEST_DB_URI = 'mongodb+srv://bhavsarkrish624_db_user:SnapSense123@cluster0.tvv5ufc.mongodb.net/test?appName=Cluster0';

async function cleanTestDatabase() {
    try {
        console.log('Connecting to test database...');
        await mongoose.connect(TEST_DB_URI);
        console.log('Connected.');
        
        console.log('Dropping test database...');
        await mongoose.connection.db.dropDatabase();
        
        console.log('Successfully cleared all collections in the test database.');
        process.exit(0);
    } catch (err) {
        console.error('Error cleaning test database:', err);
        process.exit(1);
    }
}

cleanTestDatabase();
