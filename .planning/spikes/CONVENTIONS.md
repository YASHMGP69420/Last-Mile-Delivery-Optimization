# Spike Conventions

Patterns and stack choices established across spike sessions.

## Stack
- **Frontend / Client Storage**: Browser-native IndexedDB (`window.indexedDB`) wrapped in Promises for transactional offline storage.
- **Styling**: Tailwind CSS with Hallmark Obsidian dark theme (`#090D14` background, `#141B29` surface, `#059669` emerald primary).
- **Testing**: Zero-dependency Node test harness using in-memory mocks and Node `perf_hooks` for millisecond latency benchmarks.

## Patterns
- **Idempotency Keys**: Format `${ACTION}_${ENTITY_ID}_${TIMESTAMP}_${UUID}` indexed with `unique: true` constraint to prevent duplicate submissions.
- **Queue Ordering**: Numeric auto-increment ID ensuring atomic FIFO dequeue sequence.
- **Experiential Demos**: Standalone `index.html` pages with simulated network toggles, metrics dashboards, and real-time forensic logs.
