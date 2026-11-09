const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smartroute');
  const route = await mongoose.connection.db.collection('routes').findOne({ _id: new mongoose.Types.ObjectId('6aebad7a9dfbc401f5c17071') });
  console.log('Route Code:', route.routeCode);
  console.log('Stops count:', route.stops?.length);
  for (let i = 0; i < Math.min(route.stops?.length, 5); i++) {
    const s = route.stops[i];
    console.log(`Stop ${i+1}:`, 'recipientName:', s.recipientName, 'customer:', s.customer?.name, 'deliveryId:', s.deliveryId, 'status:', s.status);
    if (s.deliveryId) {
      const del = await mongoose.connection.db.collection('deliveries').findOne({ _id: s.deliveryId });
      console.log('  -> Delivery doc customer:', del?.customer?.name, 'recipientName:', del?.recipientName);
    }
  }
  process.exit(0);
}

run().catch(console.error);
