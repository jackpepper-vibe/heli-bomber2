# Development Standards — Dynamite Dan

---

# High-Performance Game Development Standards

## 1. Tech Stack Requirements
- **Language:** TypeScript (Strict mode).
- **Renderer:** PixiJS (WebGPU/WebGL). No raw HTML5 Canvas.
- **Physics:** Rapier.js (Fixed-timestep loop).
- **Tooling:** Vite for bundling and HMR.

## 2. Code Architecture
- **No Monoliths:** Do not put everything in one file. Use a modular Class-based structure.
- **State Management:** Use a Finite State Machine (FSM) for player/enemy behavior (Idle, Move, Jump, Attack).
- **Game Loop:** Implement a professional loop that separates 'Update' (logic/physics) from 'Draw' (rendering).

## 3. Visual "Juice" & Professionalism
- **Camera:** Use Linear Interpolation (lerp) for smooth camera tracking.
- **Parallax:** Minimum 3 layers of depth for all backgrounds.
- **Animations:** Implement 'Squash and Stretch' logic for all character movements.
- **Game Feel:** Include Coyote Time (100ms) and Jump Buffering (100ms) for platforming.
- **Shaders:** Use GLSL fragment shaders for lighting, bloom, or environmental effects where appropriate.

## 4. Performance Standards
- **Object Pooling:** Use pools for frequent entities (bullets, particles, dust) to avoid Garbage Collection spikes.
- **Asset Management:** Centralized `AssetLoader` class with progress tracking.
- **Fixed Timestep:** Physics must run at a consistent 60hz regardless of screen refresh rate.

## 5. Visual Polish & "Juice" (Mandatory)
- **Atmospheric Lighting:** Never use flat background colors. Always implement a multi-layered parallax system (minimum 3 layers).
- **Post-Processing:** Every scene must have a global filter pass (e.g., subtle Bloom, Vignette, or Color Grading) to unify the art style.
- **Dynamic Entities:** Interactive items (pickups, buttons) must never be static. Implement a 'bobbing' animation or a 'pulsing' glow filter.
- **Particle Systems:** Use particle emitters for player landing (dust), enemy destruction (sparks), and item collection (glitter/glow).
- **Texture Tiling:** For platforms and borders, use tiling textures with `PIXI.TilingSprite` rather than drawing repeated primitive rectangles.
- **Shadows:** Use `DropShadowFilter` or `BlurFilter` on a separate layer beneath platforms to ground them in the world.

## 6. UI & HUD Standards
- **Depth:** HUD elements should exist on a separate top-level container and should not be affected by world shaders.
- **Typography:** Always use high-quality web fonts or BitmapFonts; avoid default system sans-serif.
- **Transitions:** Implement 'Fade-to-Black' or 'Wipe' transitions between scenes using GSAP.

---

## Stack
- **Language**: TypeScript (strict mode)
- **Bundler**: Vite
- **Rendering**: PixiJS 8
- **Physics**: Rapier2D (compat WASM build)

---

## Folder Conventions

| Folder | Purpose |
|---|---|
| `src/core/` | Game loop, asset loader, base interfaces |
| `src/entities/` | Player, enemies, items — each file owns its logic + sprite |
| `src/systems/` | Stateless systems: physics, input, camera, parallax |
| `src/scenes/` | MainMenu, Level, GameOver — one class per scene |
| `src/utils/` | Pure helpers: math, constants, type guards |
| `public/assets/sprites/` | Spritesheets (PNG + JSON atlas) |
| `public/assets/audio/` | SFX (OGG/MP3) and music |
| `public/assets/shaders/` | Custom `.frag` / `.vert` GLSL files |

---

## TypeScript Rules

- **Strict mode** is on — no `any`, no `!` non-null unless you can justify it in a comment.
- Prefer `interface` over `type` for object shapes.
- Export only what is needed outside the file.
- No barrel re-exports (`index.ts`) unless the folder has 4+ exports.

---

## Entity Pattern

Each entity lives in its own file and owns its sprite and update logic:

```ts
export class Spider {
  sprite: Container;               // PixiJS display object
  body: RAPIER.RigidBody;          // Rapier physics body
  constructor(world: World) { ... }
  update(dt: number): void { ... }
  destroy(): void { ... }          // clean up body + sprite
}
```

- Entities do **not** import from `systems/` — systems receive entities as arguments.
- Entities do **not** directly read from `Input` — systems pass intent vectors to them.

---

## System Pattern

Systems are functions or classes that act on entities, not the other way around:

```ts
// Good
export function applyInput(player: Player, intent: Intent): void { ... }

// Bad — entity importing input directly
import { input } from '../systems/input';
```

---

## Scene Lifecycle

Every scene must implement:

```ts
interface Scene {
  init(): Promise<void>;   // async setup, load assets
  update(dt: number): void;
  destroy(): void;         // release all resources
}
```

Scenes are loaded by the core `SceneManager` and must call `destroy()` cleanly so there are no memory leaks between transitions.

---

## Asset Loading

- All assets go through the core `AssetLoader` (wraps PixiJS Assets).
- Use string constants from `src/utils/constants.ts` for asset keys — no magic strings.
- Spritesheets must include a JSON atlas alongside the PNG.

---

## Physics

- Rapier units: **pixels** (1 unit = 1 px).
- All rigid bodies are created by the owning entity and destroyed in its `destroy()`.
- One-way platforms use a KCC collision predicate — see `src/systems/physics.ts`.
- Never hold a stale Rapier handle after `world.step()` without re-querying.

---

## Naming

| Thing | Convention | Example |
|---|---|---|
| Files | `camelCase.ts` | `assetLoader.ts` |
| Classes | `PascalCase` | `class Player` |
| Constants | `SCREAMING_SNAKE` | `TILE_SIZE = 16` |
| Functions | `camelCase` | `applyGravity()` |
| Interfaces | `PascalCase` with `I` prefix only when ambiguous | `Scene`, `IRenderable` |

---

## Git

- Commits follow **Conventional Commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- One logical change per commit.
- Never commit `.env.local`, `dist/`, or `node_modules/`.
