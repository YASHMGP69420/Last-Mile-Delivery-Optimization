const mongoose = require('mongoose');

async function run() {
  await mongoose.connect('mongodb://127.0.0.1:27017/smartroute');
  const collections = await mongoose.connection.db.listCollections().toArray();
  for (const c of collections) {
    const all = await mongoose.connection.db.collection(c.name).find({}).toArray();
    for (const doc of all) {
      const str = JSON.stringify(doc);
      if (str.toLowerCase().includes('lipsa')) {
        console.log(`[FOUND IN ${c.name}] id: ${doc._id}`);
        console.log(str.substring(0, 300));
      }
    }
  }
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
