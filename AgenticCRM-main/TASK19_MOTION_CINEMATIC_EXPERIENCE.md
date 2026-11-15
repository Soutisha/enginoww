# Task 19 — Motion and Cinematic Experience

## Delivered

- Enhanced dashboard route transitions with enter/exit motion, subtle blur and vertical movement.
- Added staggered widget entrance animations and a reusable `MotionPressable` interaction wrapper.
- Added animated numeric KPI values that preserve currency prefixes and compact suffixes.
- Added premium card hover treatment, touch-target transitions and a restrained ambient radial glow in the application shell.
- Enabled smooth native scrolling for the dashboard content area and anchor navigation.
- Kept skeleton shimmer loading treatment and made it respect reduced-motion preferences.
- Added reduced-motion handling to route and stagger transitions using Motion's `useReducedMotion`, plus global CSS fallbacks for all animation and scrolling.
- Kept effects CSS/native and dependency-free so no additional runtime bundle or WebGL context is required.

## Implementation choices and scope gaps

The repository already includes `motion` and existing skeleton components. This task extends those rather than adding another animation framework. The requested GSAP-specific timeline engine and Lenis package were not introduced because neither dependency exists in the workspace lockfile and package installation was unavailable. Route choreography and interactions use the already-installed Motion library; smooth scrolling uses browser-native CSS scrolling. The atmospheric lighting is a CSS radial gradient, not a WebGL shader. These are deliberate low-cost fallbacks, not claims that GSAP, Lenis or WebGL are installed.

The effects are restrained, avoid continuous animation loops, and honor `prefers-reduced-motion`.

## Verification

Run:

```bash
pnpm verify:task19
pnpm --filter @wacrm/dashboard type-check
pnpm --filter @wacrm/dashboard lint
```

The static verifier checks the route transitions, KPI animation, ambient treatment, scroll behavior, skeleton shimmer and reduced-motion fallbacks. Full Next.js build and browser performance testing require workspace dependencies and a running app.
