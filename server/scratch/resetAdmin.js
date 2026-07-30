const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/firecode';

async function main() {
    await mongoose.connect(MONGODB_URI);
    const newHash = await bcrypt.hash('adminPassword123', 10);
    const res = await mongoose.connection.db.collection('users').updateOne(
        { username: 'admin' },
        { $set: { password: newHash } }
    );
    console.log('Password reset result:', res);
    
    // Verify
    const admin = await mongoose.connection.db.collection('users').findOne({ username: 'admin' });
    const match = await bcrypt.compare('adminPassword123', admin.password);
    console.log('Password match verification:', match);
    
    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
