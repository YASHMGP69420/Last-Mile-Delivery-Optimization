# SmartRoute

SmartRoute is a planned role-based web platform for optimizing last-mile delivery operations. It will help fleet managers create delivery batches, assign drivers and vehicles, optimize multi-stop routes, monitor execution, and analyze planned versus actual performance.

## Project status

Pre-development planning complete. Implementation has not started. Read the execution plan in `docs/01-execution-plan.txt` before creating the application.

## Planned stack

- Frontend: React + Tailwind CSS
- API: Node.js + Express
- Database: MongoDB Atlas
- Authentication: JWT + bcrypt
- Maps and routing: Google Maps Platform (with a deterministic simulated-traffic fallback)
- Realtime: Socket.IO
- Charts / CSV: Recharts / PapaParse
- Hosting: Vercel (frontend) + Render (API)

## Documentation index

| Document | Purpose |
| --- | --- |
| `docs/00-project-charter.txt` | Scope, outcomes, roles, and success measures |
| `docs/01-execution-plan.txt` | Phased build plan, milestones, and acceptance gates |
| `docs/02-implementation-checklist.txt` | Work checklist used during delivery |
| `docs/03-architecture.txt` | System boundaries, modules, and data flow |
| `docs/04-requirements-traceability.txt` | Requirement-to-test mapping |
| `docs/05-data-model.txt` | Entities, fields, and lifecycle rules |
| `docs/06-api-contract.txt` | Initial REST and Socket.IO interface contract |
| `docs/07-optimization-specification.txt` | Algorithm behavior and measurable evaluation |
| `docs/08-quality-test-plan.txt` | Test strategy and release criteria |
| `docs/09-risk-register.txt` | Risks, mitigations, and contingencies |
| `docs/10-decision-log.txt` | Decisions required before implementation |
| `docs/11-deployment-readiness.txt` | Production configuration and launch gate |

## First action

Resolve every item marked Open in `docs/10-decision-log.txt`, then complete the Phase 0 gate in the execution plan.
