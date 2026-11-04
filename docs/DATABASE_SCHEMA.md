# DATABASE SCHEMA

## Collections
| Collection | Fields (key) | References |
|---|---|---|
| users | `_id`, `email`, `passwordHash`, `role`, `name`, `createdAt`, `updatedAt` | — |
| drivers | `_id`, `userId` (ref users), `licenseNumber`, `phone`, `status`, `createdAt`, `updatedAt` | users |
| vehicles | `_id`, `vehicleId`, `type` (Bike/Van/Truck), `capacityKg`, `fuelType` (Petrol/Diesel/Electric), `mileageKmPerLitre` / `energyKWhPerKm`, `status`, `createdAt`, `updatedAt` | — |
| deliveries | `_id`, `address`, `geo`, `priority` (Urgent/Standard), `timeWindow` (`start`, `end`), `weightKg`, `status`, `batchId` (ref batches), `assignedVehicleId` (ref vehicles), `assignedDriverId` (ref drivers), `createdAt`, `updatedAt` | batches, vehicles, drivers |
| deliveryBatches | `_id`, `name`, `depotGeo`, `deliveryIds` [ref deliveries], `vehicleIds` [ref vehicles], `driverIds` [ref drivers], `status`, `createdAt`, `updatedAt` | deliveries, vehicles, drivers |
| routes | `_id`, `batchId` (ref batches), `vehicleId` (ref vehicles), `stopSequence` [{`deliveryId`, `order`, `eta`}], `totalDistanceKm`, `totalDurationMin`, `fuelCost`, `createdAt`, `updatedAt` | batches, vehicles, deliveries |
| tracking | `_id`, `driverId` (ref drivers), `vehicleId` (ref vehicles), `lat`, `lng`, `timestamp` | drivers, vehicles |
| notifications | `_id`, `userId` (ref users), `type`, `message`, `read`, `createdAt` | users |
| reports | `_id`, `name`, `type`, `data` (JSON), `generatedAt` | — |
| settings | `_id`, `key`, `value` | — |

Indexes are created on fields used for lookup (e.g., `userId`, `batchId`, `vehicleId`, `driverId`).

All timestamps use ISODate.

