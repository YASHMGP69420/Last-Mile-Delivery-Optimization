const Hub = require('../models/Hub');

const DEFAULT_HUBS = [
  {
    name: 'Rasulgarh Logistics Hub',
    code: 'HUB-RASULGARH',
    address: 'Plot 104/A, Rasulgarh Industrial Estate, Bhubaneswar',
    location: {
      lat: 20.2961,
      lng: 85.8645,
    },
    contactPhone: '+91 674 2580100',
    operatingHours: { open: '08:00', close: '20:00' },
    isActive: true,
    isCanonical: true,
  },
  {
    name: 'Patia Infocity Hub',
    code: 'HUB-PATIA',
    address: 'Infocity Avenue, Patia, Bhubaneswar',
    location: {
      lat: 20.3533,
      lng: 85.8178,
    },
    contactPhone: '+91 674 2740200',
    operatingHours: { open: '08:00', close: '20:00' },
    isActive: true,
    isCanonical: false,
  },
  {
    name: 'Khandagiri Distribution Terminal',
    code: 'HUB-KHANDAGIRI',
    address: 'NH-16 Khandagiri Square, Bhubaneswar',
    location: {
      lat: 20.2588,
      lng: 85.7825,
    },
    contactPhone: '+91 674 2380300',
    operatingHours: { open: '08:00', close: '20:00' },
    isActive: true,
    isCanonical: false,
  },
];

/**
 * Seed initial Bhubaneswar logistics hubs safely with upsert
 * @returns {Promise<Array<Hub>>}
 */
async function seedHubs() {
  const seeded = [];
  for (const hubData of DEFAULT_HUBS) {
    const hub = await Hub.findOneAndUpdate(
      { code: hubData.code },
      { $set: hubData },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    seeded.push(hub);
  }
  return seeded;
}

module.exports = {
  DEFAULT_HUBS,
  seedHubs,
};
