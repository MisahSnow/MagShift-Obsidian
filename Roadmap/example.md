# Dev Timeline Examples

This note includes one timeline example and one kanban example for the plugin.

## Timeline Example

```dev-timeline
title: Hover Vehicles Roadmap
subtitle: April 2026 to July 2026

phases:
  - label: Vertical Slice
    color: purple
    tasks:
      - name: Vehicle Garage
        start: 2026-04-01
        end: 2026-04-08
        done: true
      - name: Upgrade Flow
        start: 2026-04-08
        end: 2026-04-20
        active: true
      - name: Tutorial Mission
        start: 2026-04-21
        end: 2026-05-05
      - name: Slice Review
        start: 2026-05-06
        milestone: true

  - label: Alpha
    color: teal
    tasks:
      - name: Combat Balance Pass
        start: 2026-05-08
        end: 2026-05-24
      - name: Track Set 01
        start: 2026-05-12
        end: 2026-06-05
      - name: AI Rival Behaviors
        start: 2026-05-20
        end: 2026-06-18
      - name: Alpha Build
        start: 2026-06-20
        milestone: true

  - label: Beta
    color: amber
    tasks:
      - name: Performance Cleanup
        start: 2026-06-22
        end: 2026-07-08
      - name: Final UX Polish
        start: 2026-06-26
        end: 2026-07-14
      - name: Beta Release
        start: 2026-07-15
        milestone: true
```

## Kanban Example

```dev-kanban
title: Vertical Slice Board
subtitle: Weekly planning board

columns:
  - label: In Progress
    color: purple
    tasks:
      - name: Vehicle Upgrades L2
        progress: 72
        owner: Jason
        due: 2026-04-12
        status: At Risk

        note: Handling is stable, but upgrade UI still needs balancing.
        subtasks:
          - name: Upgrade stats tuning
            done: true
          - name: UI layout pass
            progress: 80
          - name: Save/load validation
            progress: 35
      - name: Career Mode Tutorial
        owner: Jason
        status: Active
        subtasks:
          - name: Intro beats
            progress: 100
          - name: Objective scripting
            progress: 45
          - name: Checkpoint fail states
            progress: 10

  - label: Up Next
    color: teal
    tasks:
      - name: Track Hazard Pass
        progress: 15
        owner: Design
        due: 2026-04-18
        tags: design, track
        subtasks:
          - name: Gravity pad placement
          - name: FX hook-up
          - name: Audio pass
      - name: Rival Personality Set
        owner: AI
        status: Planned
        tags:
          - ai
          - narrative

  - label: Done
    color: green
    tasks:
      - name: Vehicle Garage
        done: true
        owner: Jason
        tags:
          - systems
          - ui
        subtasks:
          - name: Inventory list
            done: true
          - name: Stat preview
            done: true
          - name: Input support
            done: true
```
