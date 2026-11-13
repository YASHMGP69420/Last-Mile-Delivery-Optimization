const fs = require('fs');
const path = 'client/src/components/deliveries/ConsignmentDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace the Fleet Resource Assignment Card with Batch Status Chip
const oldSection = `        {/* Fleet Resource Assignment Card */}
        {canEdit && hasFleetOptions && (
            <div className="p-3.5 rounded-lg bg-white dark:bg-[#121417] border border-slate-200 dark:border-[#262A32] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-zinc-100 uppercase tracking-wider flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600 dark:text-teal-400" />
                  Fleet Resource Assignment
                </h4>
                {typeof displayedDelivery.batchId === 'object' && displayedDelivery.batchId?.code && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0B0C0E] border border-slate-200 dark:border-[#262A32] text-slate-600 dark:text-zinc-300">
                    BATCH: {displayedDelivery.batchId.code}
                  </span>
                )}
              </div>

              {assignError && (
                <div className="p-2.5 rounded bg-rose-500/10 border border-rose-500/30 border-l-4 border-l-rose-600 dark:border-l-rose-500 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>{assignError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Vehicle
                  </label>
                  <select
                    value={assignVehicleId}
                    onChange={(e) => setAssignVehicleId(e.target.value)}
                    disabled={isAssigningFleet}
                    className="w-full text-xs font-mono rounded-md border border-slate-300 dark:border-[#262A32] bg-slate-50 dark:bg-[#0B0C0E] px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select vehicle...</option>
                    {(vehicles || []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.vehicleId} [{v.availability}] — {v.capacityKg}kg
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-zinc-400 mb-1">
                    Driver
                  </label>
                  <select
                    value={assignDriverId}
                    onChange={(e) => setAssignDriverId(e.target.value)}
                    disabled={isAssigningFleet}
                    className="w-full text-xs rounded-md border border-slate-300 dark:border-[#262A32] bg-slate-50 dark:bg-[#0B0C0E] px-2.5 py-1.5 text-slate-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Select driver...</option>
                    {(drivers || []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {getDriverName(d)} [{d.availability}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleAssignFleet}
                  isLoading={isAssigningFleet}
                  disabled={!assignVehicleId || !assignDriverId}
                  leftIcon={<Truck className="w-3.5 h-3.5" />}
                >
                  Assign Fleet
                </Button>
              </div>
            </div>
          )}

          {/* Inline Two-Step Consignment Deletion (DRAFT / READY only) */}`;

const newSection = `        {/* Batch Status Chip */}
          {typeof displayedDelivery.batchId === 'object' && displayedDelivery.batchId?.code && (
            <div className="pt-2 border-t border-outline-variant/60">
              <div className="flex items-center gap-2">
                <span className="text-xs text-on-surface-variant font-medium">Batch:</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/10 text-secondary text-xs font-mono font-medium border border-secondary/20">
                  <span className="font-mono">{displayedDelivery.batchId.code}</span>
                  <span className={clsx(
                    'px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
                    displayedDelivery.batchId?.status === 'DISPATCHED'
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                      : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                  )}>
                    {displayedDelivery.batchId?.status || 'Pending'}
                  </span>
                </span>
              </div>
            </div>
          )}

          {/* Inline Two-Step Consignment Deletion (DRAFT / READY only) */}`;

if (content.includes(oldSection)) {
  content = content.replace(oldSection, newSection);
  fs.writeFileSync(path, content);
  console.log('Replacement successful!');
} else {
  console.log('Old section not found. Checking for partial match...');
  if (content.includes('Fleet Resource Assignment')) {
    console.log('Found Fleet Resource Assignment text');
  }
  if (content.includes('canEdit && hasFleetOptions')) {
    console.log('Found canEdit && hasFleetOptions');
  }
  // Try to find the exact boundary
  const idx = content.indexOf('Fleet Resource Assignment');
  if (idx >= 0) {
    console.log('Found at index:', idx);
    console.log('Context:', content.substring(idx - 50, idx + 200));
  }
}