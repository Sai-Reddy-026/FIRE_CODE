const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/firecode';

async function main() {
    await mongoose.connect(MONGODB_URI);
    const db = mongoose.connection.db;

    const newHash = await bcrypt.hash('adminPassword123', 10);

    const updateRes = await db.collection('users').updateOne(
        { username: 'admin' },
        {
            $set: {
                password: newHash,
                role: 'admin',
                email: 'admin@firecode.com'
            }
        },
        { upsert: true }
    );

    console.log('Admin user updated:', updateRes);

    const adminUser = await db.collection('users').findOne({ username: 'admin' });
    console.log('Verification check for password "adminPassword123":', await bcrypt.compare('adminPassword123', adminUser.password));

    process.exit(0);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
