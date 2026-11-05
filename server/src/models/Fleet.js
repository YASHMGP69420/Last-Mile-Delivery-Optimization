// server/src/models/Fleet.js
const mongoose = require('mongoose');
const { ROLES } = require('../config/constants');

const fleetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: '' },
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { transform: (doc, ret) => { ret.id = ret._id.toString(); delete ret._id; delete ret.__v; return ret; } } }
);

// fleetSchema.index({ name: 1 }); // removed duplicate explicit index – unique field already creates an index

const Fleet = mongoose.model('Fleet', fleetSchema);
module.exports = Fleet;
