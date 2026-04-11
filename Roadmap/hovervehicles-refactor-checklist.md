# HoverVehicles Refactor Checklist

This note is the prioritized refactor backlog for the current project codebase.

## Tasks

- [ ] Refactor `HoverVehicleController`
- [ ] Refactor `VehiclePickupInventory`
- [ ] Refactor `HoverAIController`

## Task Definitions

### `HoverVehicleController`

- Split movement/hover physics, network authority/RPCs, temporary status effects, and visual/material effect handling.
- Preserve existing scene/prefab-facing behavior and public entrypoints.

### `VehiclePickupInventory`

- Split inventory state, pickup execution, projectile simulation, mine lifecycle, and local VFX/audio concerns.

### `HoverAIController`

- Split route following, combat behavior, avoidance, recovery, and debug instrumentation.

## Completion Rule

- Check a task off only when:
- the refactor is implemented,
- behavior is preserved,
- affected tests are updated or added where needed,
- and the changed area has been validated with the project's normal compile/test/smoke-check path.
- Do not split this into multiple notes or boards; keep all checkbox state in this single note.

## Assumptions

- The repo-local vault at `Documents/Obsidian` is the intended project Obsidian.
- `Roadmap` is the correct destination folder for this checklist.
- No public gameplay/editor API changes are planned as part of creating this note; this is only a tracked refactor backlog.
