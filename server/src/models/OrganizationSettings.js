const mongoose = require('mongoose');
const { CANONICAL_DEPOT } = require('../config/constants');

const depotSchema = new mongoose.Schema({
  depotId: { type: String, required: true },
  name: { type: String, required: true },
  address: { type: String, required: true },
  location: {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  operatingHours: {
    start: { type: String, default: '06:00' },
    end: { type: String, default: '22:00' },
  },
  serviceRegion: { type: String, default: 'Bhubaneswar Metropolitan' },
  active: { type: Boolean, default: true },
});

const organizationSettingsSchema = new mongoose.Schema(
  {
    orgKey: {
      type: String,
      required: true,
      unique: true,
      default: 'DEFAULT_ORG',
    },
    organizationName: {
      type: String,
      default: 'SmartRoute Logistics Corp',
    },
    logoUrl: {
      type: String,
      default: '',
    },
    businessAddress: {
      street: { type: String, default: 'Plot 104/A, Rasulgarh Industrial Estate' },
      city: { type: String, default: 'Bhubaneswar' },
      state: { type: String, default: 'Odisha' },
      postalCode: { type: String, default: '751010' },
      country: { type: String, default: 'India' },
    },
    contactDetails: {
      email: { type: String, default: 'ops@smartroute.io' },
      phone: { type: String, default: '+91 674 258 0100' },
      supportEmergencyPhone: { type: String, default: '+91 674 258 0911' },
    },
    operatingRegions: {
      type: [String],
      default: ['Patia (Z-1)', 'Jaydev Vihar (Z-2)', 'Saheed Nagar (Z-3)', 'Khandagiri (Z-4)', 'Chandrasekharpur', 'Rasulgarh Central'],
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    currency: {
      type: String,
      default: 'INR (₹)',
    },
    businessHours: {
      start: { type: String, default: '07:00' },
      end: { type: String, default: '21:00' },
    },
    depots: {
      type: [depotSchema],
      default: [
        {
          depotId: 'DEPOT-BBSR-01',
          name: CANONICAL_DEPOT.name,
          address: CANONICAL_DEPOT.address,
          location: { lat: CANONICAL_DEPOT.geo.lat, lng: CANONICAL_DEPOT.geo.lng },
          operatingHours: { start: '06:00', end: '22:00' },
          serviceRegion: 'Bhubaneswar Central & Industrial',
          active: true,
        },
        {
          depotId: 'DEPOT-PATIA-02',
          name: 'Patia North Hub',
          address: 'Kiit Square, Infocity Road, Patia, Bhubaneswar',
          location: { lat: 20.3533, lng: 85.8192 },
          operatingHours: { start: '06:30', end: '21:30' },
          serviceRegion: 'Patia & North Technology Corridor',
          active: true,
        },
      ],
    },
    optimizationSettings: {
      distanceWeight: { type: Number, default: 0.35, min: 0, max: 1 },
      timeWeight: { type: Number, default: 0.30, min: 0, max: 1 },
      fuelCostWeight: { type: Number, default: 0.20, min: 0, max: 1 },
      deliveryPriorityWeight: { type: Number, default: 0.15, min: 0, max: 1 },
      workloadBalancingWeight: { type: Number, default: 0.10, min: 0, max: 1 },
      maxRouteDurationMinutes: { type: Number, default: 480, min: 60, max: 720 },
      defaultReturnToDepot: { type: Boolean, default: true },
      defaultServiceDurationMinutes: { type: Number, default: 10, min: 1, max: 60 },
      allowedVehicleTypes: {
        type: [String],
        default: ['Bike', 'Van', 'Truck'],
      },
      defaultProfile: {
        type: String,
        enum: ['Distance Optimized', 'Time Optimized', 'Fuel Optimized', 'Balanced'],
        default: 'Balanced',
      },
      lastModifiedBy: { type: String, default: 'System Admin' },
      lastModifiedAt: { type: Date, default: Date.now },
    },
    fuelSettings: {
      petrolPricePerLiter: { type: Number, default: 103.20 },
      dieselPricePerLiter: { type: Number, default: 94.80 },
      cngPricePerKg: { type: Number, default: 85.50 },
      electricityTariffPerKwh: { type: Number, default: 7.20 },
      carbonEmissionFactors: {
        petrolGramsPerKm: { type: Number, default: 230 },
        dieselGramsPerKm: { type: Number, default: 210 },
        electricGramsPerKm: { type: Number, default: 0 },
      },
      effectiveDate: { type: Date, default: Date.now },
      currencySymbol: { type: String, default: '₹' },
    },
    integrations: {
      geoapify: {
        enabled: { type: Boolean, default: true },
        hasKey: { type: Boolean, default: true },
        lastStatus: { type: String, default: 'HEALTHY' },
        lastChecked: { type: Date, default: Date.now },
      },
      leafletOsm: {
        enabled: { type: Boolean, default: true },
        tileProvider: { type: String, default: 'OpenStreetMap Standard & Geoapify Tiles' },
        lastStatus: { type: String, default: 'HEALTHY' },
      },
      mongoDb: {
        status: { type: String, default: 'CONNECTED' },
        databaseName: { type: String, default: 'smartroute' },
      },
      socketIo: {
        enabled: { type: Boolean, default: true },
        status: { type: String, default: 'OPERATIONAL' },
      },
    },
    permissionsConfig: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({
        ADMIN: {
          userManagement: ['view', 'create', 'edit', 'delete', 'approve'],
          fleetManagement: ['view', 'create', 'edit', 'delete', 'assign', 'override'],
          driverManagement: ['view', 'create', 'edit', 'delete', 'assign'],
          routeOptimization: ['view', 'create', 'edit', 'override', 'dispatch'],
          organizationSettings: ['view', 'edit'],
          auditLogs: ['view', 'export'],
          systemConfig: ['view', 'edit'],
        },
        FLEET_MANAGER: {
          userManagement: ['view'],
          fleetManagement: ['view', 'create', 'edit', 'assign'],
          driverManagement: ['view', 'create', 'edit', 'assign'],
          routeOptimization: ['view', 'create', 'dispatch'],
          organizationSettings: ['view'],
          auditLogs: ['view'],
          systemConfig: [],
        },
        DRIVER: {
          userManagement: [],
          fleetManagement: ['view_assigned'],
          driverManagement: ['view_profile'],
          routeOptimization: ['view_assigned'],
          organizationSettings: [],
          auditLogs: [],
          systemConfig: [],
        },
      }),
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Helper to get or create singleton organization settings
organizationSettingsSchema.statics.getSettings = async function () {
  let settings = await this.findOne({ orgKey: 'DEFAULT_ORG' });
  if (!settings) {
    settings = await this.create({ orgKey: 'DEFAULT_ORG' });
  }
  return settings;
};

const OrganizationSettings = mongoose.model('OrganizationSettings', organizationSettingsSchema);

module.exports = OrganizationSettings;