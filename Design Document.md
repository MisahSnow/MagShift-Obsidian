## Overview

**MagShift** is a fast-paced, aggressive hover sports racing game. Players race magnetic hover vehicles across alien planets, battling rivals and pushing their machines to the limit. The tone is kinetic and competitive — every race should feel dangerous, rewarding, and high-speed.

---

## Core Vision

A planet-hopping hover racer where mastering your vehicle and beating increasingly brutal tracks is the path to glory. MagShift rewards aggressive, skilled play. Players aren't just racing — they're conquering worlds.

---

## Core Gameplay Loop

```
Race → Finish Placement → Earn Money → Unlock Vehicles → Clear Planet → Unlock Next Planet
           ↑                                                                      |
           └──────────────────────────────────────────────────────────────────────┘
```

1. **Race** — Player competes on a track against opponents on the current planet
    
2. **Earn** — Finishing races awards money based on placement and performance
    
3. **Spend** — Money is used to purchase new vehicles from the Vehicle Catalog
    
4. **Progress** — Clearing all races on a planet unlocks the next planet
    
5. **Repeat** — New planets introduce harder tracks and stronger competition
    

---

## Central Systems

### Driving

The foundation of MagShift. Hover vehicles use magnetic levitation, meaning handling is distinct from traditional racing — momentum, drift, and surface interaction all behave differently. The driving model should feel weighty but responsive, rewarding players who learn their vehicle's characteristics.

Key considerations:

- Hover height and stability management
    
- Speed-dependent steering sensitivity
    
- Ramp and jump behavior
    
- Collision aggression (bumping, shunting rivals)
    
- Per-vehicle feel and balance
    

### Racing

The competitive structure that drives the game forward. Races are the primary content unit — each planet contains a set of races that must be cleared to progress.

Key considerations:

- Race placement determines money reward
    
- Rival AI difficulty scales per planet
    
- Track design escalates in complexity and aggression across planets
    
- Respawn system for when vehicles fall off track
    
- Lap/checkpoint structure
    

---

## Progression Structure

```
Planet 1 (Starter)
├── Race 1
├── Race 2
└── Race 3 → Planet Cleared → Unlock Planet 2

Planet 2
├── Race 1
├── Race 2
├── Race 3
└── Race 4 → Planet Cleared → Unlock Planet 3

...and so on
```

- Planets act as difficulty tiers
    
- Each planet has a fixed set of races that must all be completed to progress
    
- Vehicle unlocks are global — a vehicle purchased on Planet 2 can be used on Planet 1
    

---

## Vehicle System

- Players own and select vehicles from an unlockable catalog
    
- Vehicles vary in stats (speed, handling, weight, boost, etc.)
    
- Vehicles are purchased with race earnings
    
- Vehicle balance is a tunable system (see Vehicle Balance Runner tooling)
    

---

## Narrative

### Setting

MagShift takes place across a universe shattered by corporate greed. **Spectre Galactic Media** — a massive, morally bankrupt media conglomerate — engineered a universe-wide economic collapse. With governments and planets desperate for resources, Spectre exploited the crisis by creating **The Dominion Trials**: a televised racing tournament broadcast across the galaxy.

### The Dominion Trials

The Trials are framed as a sporting event but are essentially state-sanctioned execution entertainment. A planet's government can voluntarily enroll their world into the Trials, nominating a single champion racer to compete on their behalf.

- **If the champion wins** — the planet is rewarded with enormous wealth and prosperity, rebuilding what the collapse destroyed
    
- **If the champion loses** — the planet is vaporized by Spectre's fleet of Planet Destroying Star Ships, live on broadcast
    

Spectre profits either way: through viewership, gambling, sponsorships, and the fear that keeps other planets compliant.

### Tone

The Trials are glamorous, high-production, and deeply sinister. The contradiction between the spectacle and the stakes is intentional — the universe watches because they have to, and Spectre loves every second of it.

### Player Role

The player is their planet's enrolled champion. Every race isn't just about prize money — it's about survival. Losing the tournament means their home planet ceases to exist.

---

## Key Constraints

---

## Out of Scope (Initial Scope)

- On-foot / non-vehicle gameplay
    
- Track editor or user-generated content