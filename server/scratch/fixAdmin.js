const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/firecode';

async function main() {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    // Check all users
    const users = await db.collection('users').find({}).toArray();
    console.log('Total users in DB:', users.length);
    users.forEach(u => {
        console.log(`- Username: ${u.username}, Email: ${u.email}, Role: ${u.role}`);
    });

    // Reset password for admin (or create if missing)
    const newHash = await bcrypt.hash('admin123', 10);

    const updateRes = await db.collection('users').updateOne(
        { username: 'admin' },
        {
            $set: {
                password: newHash,
                role: 'admin',
                email: 'admin@firecode.io'
            }
        },
        { upsert: true }
    );

    console.log('\nAdmin Password Reset Result:', updateRes);

    const adminUser = await db.collection('users').findOne({ username: 'admin' });
    const isMatch = await bcrypt.compare('admin123', adminUser.password);
    console.log('Verification check for password "admin123":', isMatch ? 'PASSED (Matches)' : 'FAILED');

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
