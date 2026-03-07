require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

async function fixNegativeCounts() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find users with negative counts
        const usersWithNegativeCounts = await User.find({
            $or: [
                { screenshotCount: { $lt: 0 } },
                { totalUploads: { $lt: 0 } }
            ]
        });

        console.log(`\n📊 Found ${usersWithNegativeCounts.length} users with negative counts\n`);

        for (const user of usersWithNegativeCounts) {
            console.log(`Fixing user: ${user.email}`);
            console.log(`  Before - screenshotCount: ${user.screenshotCount}, totalUploads: ${user.totalUploads}`);
            
            user.screenshotCount = Math.max(0, user.screenshotCount || 0);
            user.totalUploads = Math.max(0, user.totalUploads || 0);
            
            await user.save();
            
            console.log(`  After  - screenshotCount: ${user.screenshotCount}, totalUploads: ${user.totalUploads}`);
            console.log('  ✅ Fixed\n');
        }

        console.log('✅ All negative counts have been reset to 0');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixNegativeCounts();
