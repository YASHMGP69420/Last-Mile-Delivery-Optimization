const fs = require('fs');
const path = 'client/src/components/deliveries/ConsignmentDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

// Use regex to replace the entire Fleet Resource Assignment Card section
// Match from "Fleet Resource Assignment Card" comment to the closing ")}" before "Inline Two-Step"
const regex = /        \{\/\* Fleet Resource Assignment Card \*\/\}\s+{canEdit && hasFleetOptions && \([\s\S]*?\)\}\s+\n\s+\{\/\* Inline Two-Step Consignment Deletion \(DRAFT \/ READY only\) \*\/\}/;

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

if (regex.test(content)) {
  content = content.replace(regex, newSection);
  fs.writeFileSync(path, content);
  console.log('Replacement successful!');
} else {
  console.log('Regex did not match. Trying alternative...');
  // Try to find the exact text
  const idx = content.indexOf('Fleet Resource Assignment Card');
  if (idx >= 0) {
    // Find the end of the section - look for "Inline Two-Step"
    const endIdx = content.indexOf('Inline Two-Step Consignment Deletion', idx);
    if (endIdx >= 0) {
      console.log('Found section from', idx, 'to', endIdx);
      console.log('Section length:', endIdx - idx);
      // Show the section
      console.log('Section:', content.substring(idx, endIdx + 50));
    }
  }
}