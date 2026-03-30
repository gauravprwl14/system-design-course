---
title: "Design an Entity-Component-System (ECS) Architecture (OOD)"
layer: case-study
section: "16-system-design-problems/10-object-oriented-design"
difficulty: advanced
tags: [oop, ecs, observer, registry, data-oriented, game-engine, solid, cache-efficiency]
category: architecture
prerequisites: []
related_problems: []
linked_from: []
references:
  - title: "Game Programming Patterns — ECS Chapter (free online)"
    url: "https://gameprogrammingpatterns.com/component.html"
    type: article
  - title: "Head First Design Patterns — O'Reilly"
    url: "https://www.oreilly.com/library/view/head-first-design/0596007124/"
    type: article
  - title: "NeetCode OOD Playlist"
    url: "https://www.youtube.com/@NeetCode"
    type: article
  - title: "Design Patterns: Elements of Reusable Object-Oriented Software (GoF)"
    url: "https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612"
    type: article
---

# Design an Entity-Component-System (ECS) Architecture (OOD)

**Difficulty**: 🔴 Advanced
**Codemania**: #141
**Interview Frequency**: Medium

---

## Problem Statement

Design a data-oriented ECS framework used by game engines (Unity DOTS, Bevy, EnTT). Classic OOP inheritance for game objects leads to rigid class hierarchies and cache-unfriendly memory layouts. ECS separates the "what" (Entity — an ID), "data" (Component — plain structs), and "logic" (System — stateless processors) to enable flat composition, hot-swappable behaviour, and CPU cache-friendly iteration over 100,000+ entities at 60 FPS.

---

## Functional Requirements

- Create and destroy entities at runtime
- Attach, detach, and query components on any entity
- Run systems in a defined order each frame; each system filters to its required components
- Dispatch and receive inter-system events without tight coupling
- Support dense storage for frequent components (position, velocity) and sparse for rare ones (sound emitter)

---

## Core Entities (Meta-Architecture)

| Class/Concept | Responsibility |
|---------------|---------------|
| `World` | Root container: entity registry + component storage + system runner |
| `Entity` | Opaque integer ID; carries no data itself |
| `Component` | Plain data struct; no methods; tagged by type |
| `System` | Logic unit; declares required component types; stateless |
| `ComponentRegistry` | Maps component type → storage pool |
| `EntityRegistry` | Tracks which components each entity has (bitmask) |
| `EventDispatcher` | Typed publish/subscribe for inter-system communication |
| `Query` | Fluent builder: filters entities by component set |
| `Archetype` | Group of entities sharing the same component layout |
| `ComponentPool` | Typed dense array storing one component type |

---

## Class Diagram

```mermaid
classDiagram
    class World {
        +entityRegistry: EntityRegistry
        +componentRegistry: ComponentRegistry
        +systems: List~System~
        +eventDispatcher: EventDispatcher
        +createEntity(): Entity
        +destroyEntity(entity): void
        +addComponent(entity, component): void
        +removeComponent(entity, type): void
        +query(types): Query
        +update(deltaTime): void
    }
    class EntityRegistry {
        +nextId: int
        +alive: Set~Entity~
        +componentMask: Map~Entity, Bitmask~
        +create(): Entity
        +destroy(entity): void
        +hasComponent(entity, type): boolean
    }
    class ComponentRegistry {
        +pools: Map~ComponentType, ComponentPool~
        +register(type): void
        +get(entity, type): Component
        +add(entity, component): void
        +remove(entity, type): void
    }
    class System {
        <<abstract>>
        +requiredTypes: Set~ComponentType~
        +update(world, deltaTime): void
    }
    class EventDispatcher {
        +listeners: Map~EventType, List~Listener~~
        +emit(event): void
        +on(type, listener): void
    }
    class Query {
        +withAll(types): Query
        +withNone(types): Query
        +execute(world): List~Entity~
    }
    World --> EntityRegistry
    World --> ComponentRegistry
    World --> System
    World --> EventDispatcher
    ComponentRegistry --> ComponentPool
```

---

## Design Patterns Used

### 1. ECS (Data-Oriented Design)

**Why it fits**: 10,000 entities with position + velocity updated at 60 FPS = 600,000 update calls/second. With OOP inheritance, each `Entity.update()` call touches scattered heap objects causing cache misses. With ECS, all `PositionComponent` values live in one contiguous array — the CPU prefetcher loads them in bulk. Benchmark: inheritance = ~3M entities/sec; ECS = ~30M entities/sec (10× speedup on modern CPUs).

```
// Struct-of-Arrays layout: all X values together, all Y values together
class PositionPool:
  xs: float[]   // index = entity id
  ys: float[]

// System iterates over a tight array — no pointer chasing
class MovementSystem extends System:
  requiredTypes = {PositionComponent, VelocityComponent}

  update(world: World, dt: float):
    entities = world.query().withAll(requiredTypes).execute(world)
    posPool = world.getPool(PositionComponent)
    velPool = world.getPool(VelocityComponent)

    for entity in entities:
      posPool.xs[entity] += velPool.dxs[entity] * dt
      posPool.ys[entity] += velPool.dys[entity] * dt
```

### 2. Registry — Component Type → Pool

**Why it fits**: At runtime, callers add/get components by type (`world.addComponent(e, new HealthComponent(100))`). The `ComponentRegistry` maps each type to a strongly-typed pool. This is a Type Object / Registry pattern: the component type is a first-class runtime key.

```
class ComponentRegistry:
  pools: Map<ComponentType, ComponentPool>

  register(type: ComponentType): void
    pools[type] = new DenseComponentPool(type)

  add(entity: Entity, component: Component): void
    pool = pools[component.type]
    if pool == null: throw ComponentNotRegisteredException(component.type)
    pool.set(entity, component)

  get(entity: Entity, type: ComponentType): Component
    pool = pools[type]
    return pool?.get(entity)  // null if entity doesn't have this component

  remove(entity: Entity, type: ComponentType): void
    pools[type]?.remove(entity)
    entityRegistry.clearBit(entity, type)
```

### 3. Observer — EventDispatcher for Inter-System Communication

**Why it fits**: Systems must not hold references to each other — that reintroduces coupling. The `CollisionSystem` detecting a hit should not directly call `HealthSystem.damage()`. Instead it emits a `CollisionEvent`; `HealthSystem` subscribes. Any new consumer (audio, achievements) just subscribes — zero changes to `CollisionSystem`.

```
class EventDispatcher:
  listeners: Map<EventType, List<Listener>>

  emit(event: ECSEvent): void
    for listener in listeners.get(event.type) ?? []:
      listener.onEvent(event)

  on(type: EventType, listener: Listener): Subscription
    listeners.computeIfAbsent(type, () -> []).add(listener)
    return Subscription(() -> listeners[type].remove(listener))

// CollisionSystem
class CollisionSystem extends System:
  update(world, dt):
    // detect overlapping bounding boxes
    for (a, b) in broadPhase(world):
      world.eventDispatcher.emit(CollisionEvent(a, b))

// HealthSystem subscribes at startup
world.eventDispatcher.on(CollisionEvent, (e) -> {
  damage = world.getComponent(e.a, DamageComponent)?.value ?? 0
  health = world.getComponent(e.b, HealthComponent)
  if health != null: health.current -= damage
})
```

---

## Key Method: `getEntitiesWith<T>(types)`

The query is the heart of ECS — it must be fast because every System calls it every frame.

```
World:
  query(): Query
    return new Query(this)

Query:
  requiredTypes: Set<ComponentType>
  excludedTypes: Set<ComponentType>

  withAll(types): Query
    requiredTypes.addAll(types)
    return this

  withNone(types): Query
    excludedTypes.addAll(types)
    return this

  execute(world: World): List<Entity>
    requiredMask = world.componentRegistry.buildMask(requiredTypes)
    excludedMask = world.componentRegistry.buildMask(excludedTypes)

    result = []
    for entity in world.entityRegistry.alive:
      entityMask = world.entityRegistry.componentMask[entity]
      // Bitmask check: O(1) per entity
      if (entityMask AND requiredMask) == requiredMask
         AND (entityMask AND excludedMask) == 0:
        result.add(entity)

    return result
```

**Performance**: A bitmask AND for 64-component types fits in a single 64-bit integer comparison. 100,000 entities × 1 comparison = trivial per frame.

---

## Design Decisions & Trade-offs

| Decision | Option A | Option B | Choice |
|----------|----------|----------|--------|
| Component storage | Array-of-structs (all data per entity) | Struct-of-arrays (all data per type) | Struct-of-arrays — CPU cache locality; better for SIMD |
| Entity ID recycling | Increment forever (sparse) | Recycle freed IDs with generation counter | Recycle with generation — avoids stale entity references |
| System ordering | Explicit list ordering | Dependency graph auto-sort | Explicit list for small games; DAG for large engines |
| Sparse components | Same dense pool | Sparse set (hashtable) | Sparse set for components present on <5% of entities |

---

## Top Interview Questions

| Question | What It Tests |
|----------|--------------|
| Why is struct-of-arrays faster than array-of-structs for ECS iteration? | CPU cache lines, memory layout, SIMD |
| An entity is destroyed mid-frame while a system is iterating over it — how do you handle this? | Deferred destruction, tombstone pattern |
| How do you implement a query that finds entities with Position AND Velocity but NOT Static? | Bitmask AND/NOT query, exclude mask |

---

## Related Concepts

- [Game State Management OOD for ECS in full game loop context](./game-state-management)
- [Resource Management OOD for pool/allocation patterns](./resource-management)

---

## 📚 Resources & References

| Resource | Type | What You'll Learn |
|----------|------|------------------|
| [NeetCode OOD Playlist](https://www.youtube.com/@NeetCode) | 📺 YouTube | Component and composition patterns |
| [Game Programming Patterns — Component](https://gameprogrammingpatterns.com/component.html) | 📖 Blog | ECS rationale and implementation (free) |
| [ByteByteGo System Design](https://www.youtube.com/@ByteByteGo) | 📺 YouTube | Data-oriented design overview |
| [Head First Design Patterns](https://www.oreilly.com/library/view/head-first-design/0596007124/) | 📚 Book | Registry and Observer pattern chapters |
| [GoF Design Patterns](https://www.amazon.com/Design-Patterns-Elements-Reusable-Object-Oriented/dp/0201633612) | 📚 Book | Observer and Flyweight (Entity as flyweight) reference |
