const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

async function fix() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smartroute');
  const user = await mongoose.connection.db.collection('users').findOne({ email: 'mishrayashaswee6@gmail.com' });
  console.log('Current user in DB:', user?.email, user?.name);

  if (user) {
    const passwordHash = await bcrypt.hash('driver123', 10);
    // Update name to Yashaswee Mishra and set password to driver123
    await mongoose.connection.db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          name: 'Yashaswee Mishra',
          passwordHash: passwordHash,
          role: 'DRIVER',
          active: true,
          accountStatus: 'ACTIVE',
        },
      }
    );
    console.log('Successfully updated user to Yashaswee Mishra with password driver123');

    // Update driver license
    const driver = await mongoose.connection.db.collection('drivers').findOne({ userId: user._id });
    if (driver) {
      await mongoose.connection.db.collection('drivers').updateOne(
        { _id: driver._id },
        {
          $set: {
            licenseNumber: 'OD-02-YM-2026',
            phone: '+91 97777 98614',
            availability: 'AVAILABLE',
          },
        }
      );
      console.log('Successfully updated driver profile license to OD-02-YM-2026');
    }
  }

  process.exit(0);
}

fix().catch((err) => {
  console.error(err);
  process.exit(1);
});
