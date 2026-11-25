# Spikes

Exploratory prototypes that prove feasibility and shape implementation.

## Ideas

### offline-sync: Offline-First Driver Handheld Sync

Enable drivers in low-connectivity urban and rural fringe corridors (e.g. basement parking, cellular dead-zones around Bhubaneswar peripheral zones) to reliably progress stops, capture proof-of-delivery (signatures, notes, photo blobs), and continue navigating without active network access. Action events queue locally in IndexedDB with transactional idempotency keys and replay automatically when network connectivity is restored.

#### Requirements

- Offline mutation queuing: Driver stop transitions and POD actions save locally to IndexedDB when offline.
- Conflict-free replay: Replay queue flushes with idempotency keys and handles optimistic state transitions cleanly.
- Visual connectivity & sync queue HUD: Driver UI displays explicit offline/syncing/synced states and pending mutation count.

## Spikes

| # | Name | Idea | Type | Status | Verdict |
|---|------|------|------|--------|---------|
