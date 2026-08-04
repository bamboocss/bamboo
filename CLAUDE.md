# Claude Code Guide for Bamboo CSS

This guide helps AI assistants understand the Bamboo CSS codebase structure, conventions, and best practices.

## Project Overview

Bamboo CSS is a CSS-in-JS framework with static extraction capabilities. The project is a monorepo managed by **pnpm**
with workspace support.

## Key Architecture

### Monorepo Structure

```
/packages/          # Core packages published to npm
  /core/           # CSS processing, rule generation, optimization (PostCSS/LightningCSS)
  /node/           # Node.js APIs, config resolution, file watching
  /cli/            # CLI tool (@bamboocss/dev package)
  /parser/         # Static analysis and extraction
  /generator/      # Code generation for styled-system
  /fixture/        # Shared test fixtures and utilities
  /postcss/        # PostCSS plugin
  /preset-*/       # Design system presets

/sandbox/          # Integration tests and examples
  /codegen/        # Generated code validation tests
  /vite-ts/        # Vite integration example
  /next-js-*/      # Next.js examples

/playground/       # Interactive playground application

/website/          # Documentation site
```

### Key Concepts

1. **Static Extraction**: Bamboo analyzes source files to extract styles at build time
2. **Design Tokens**: Type-safe design tokens defined in config
3. **Recipes**: Reusable component style patterns (like variants)
4. **Conditions**: Responsive and state-based styling (e.g., `_hover`, `md:`, `_dark`)
5. **CSS Optimization**: Uses PostCSS (default) or LightningCSS (optional) for CSS processing

## Critical Rules

### 🚨 CSS Output is Sacred

**NEVER** accept changes that modify CSS output snapshots without explicit user approval:

- Run tests BEFORE and AFTER any dependency updates
- If snapshots change, investigate why and get user confirmation
- The test `packages/core/__tests__/atomic-rule.test.ts` is the primary CSS output validator
- CSS output consistency is more important than using latest package versions

### Testing Workflow

**Always run tests from the project root:**

```bash
# ✅ Correct
pnpm test packages/core
pnpm test packages/parser

# ❌ Incorrect
cd packages/core && pnpm test
```

**Key test commands:**

```bash
pnpm test <path>              # Run tests for specific package/file
pnpm test packages/core       # Test all core package tests
pnpm build                    # Build all packages
pnpm build-fast               # Fast build without type definitions
```

### Benchmarks

Perf-sensitive code has Vitest benchmarks in `{packages,sandbox}/*/__tests__/*.bench.ts` (core `static-css`, extractor,
parser `ts-eval`, generator runtime `css()`, the vite fold's per-module cost, and a React render of a folded tree).

🚨 **Nothing in CI catches a performance regression.** The Quality workflow runs format, tests, lint, knip and typecheck
— benchmarks are excluded on purpose, for the reason below. That makes measuring a _manual obligation before
committing_, not an optional follow-up:

- Touching a path with a benchmark, or any hot path — extraction, the generated runtime, the fold, css emission — means
  taking a before and after reading and reporting the diff in the commit.
- If the change is meant to be perf-neutral, say so and show the numbers. "Should be fine" is how regressions land.
- If a benchmark does not cover the path you changed, that is a reason to add one, not a reason to skip measuring.

This is not hypothetical. A per-call-site import scan added to the vite fold cost **+74%** on the largest sandbox file
and was caught only because the change happened to be re-measured. Nothing else would have found it.

```bash
pnpm bench                    # Run all benchmarks
pnpm bench <path>             # Run one suite, e.g. pnpm bench extract-speed
pnpm bench:baseline           # Record a baseline to bench/baseline.json
pnpm bench:compare            # Re-run and diff against that baseline
```

**Benchmarks are reported, not asserted.** Wall-clock numbers depend on the machine and its load, so they are
deliberately excluded from `pnpm check` and CI — a threshold would fail on a busy runner rather than on a real
regression. Where behaviour must not regress, lock it down by counting the work instead of timing it — e.g.
`packages/shared/__tests__/memo.test.ts` counts serialization calls rather than measuring them, and that _does_ run in
CI. If a change you cannot benchmark deterministically still matters, that is the shape to reach for.

To measure a change, take both readings on the same idle machine:

```bash
git stash && pnpm bench:baseline    # unchanged tree
git stash pop && pnpm bench:compare # changed tree
```

Read the `rme` and `samples` columns before believing a diff: a bench reporting ±15% cannot show you a 10% regression,
and one reporting a handful of samples cannot show you anything.

Back-to-back runs of an unchanged tree currently agree to within ~5%, so **treat anything under ~10% as noise.** The one
exception is `rule set 3 only (base styles)`, which is sub-0.1ms and swings further. Three things keep it there, and are
worth preserving when editing benches:

- The scripts pass `--no-file-parallelism`. Vitest otherwise runs bench files concurrently, and the CPU contention
  inflates rme past the effect sizes these exist to catch. It is also no slower overall.
- `warmupIterations` has to cover lazy init, not just JIT. Whichever expensive bench runs first pays for module init of
  the path under test; at one warmup iteration the same bench read 750ms in one run and 198ms in the next.
- `iterations` is a floor on sample count, _not_ a cap, and `time` (default 500ms) is the sampling budget. Raise `time`
  for fast cases and `iterations` for cases slow enough that 500ms only buys a few samples.

### Package Management

**Use `--ignore-scripts` for dependency updates:**

```bash
pnpm install --ignore-scripts
pnpm update <package> --ignore-scripts
```

**When updating PostCSS or browserslist-related packages:**

1. Update package.json versions
2. Run `pnpm install --ignore-scripts`
3. Run `pnpm test packages/core` to verify CSS output unchanged
4. Check for browserslist warnings in sandbox projects
5. Create changeset if changes affect users

### Dependency Strategy

- **PostCSS ecosystem**: Coordinate updates across all PostCSS plugins to avoid CSS output changes
- **browserslist**: Updates affect `postcss-merge-rules` behavior - test thoroughly
- **lightningcss**: Used optionally via `config.lightningcss` flag, depends on browserslist for targets
- **Node.js packages**: Core packages (`@bamboocss/core`, `@bamboocss/node`, etc.) must stay in sync

## Common Workflows

### Making Code Changes

1. Read relevant source files in `/packages/<name>/src/`
2. Understand the change impact (does it affect CSS output?)
3. Make changes
4. Run tests: `pnpm test packages/<name>`
5. If tests fail, investigate and fix (don't just update snapshots)
6. Create changeset for user-facing changes

### Updating Dependencies

1. Check current versions in package.json
2. Research latest compatible versions
3. Update package.json files
4. Run `pnpm install --ignore-scripts`
5. **Run CSS output tests first**: `pnpm test packages/core/__tests__/atomic-rule.test.ts`
6. If snapshots change, investigate the root cause
7. Run broader test suite: `pnpm test packages/core`
8. Create changeset documenting the update

### Creating Changesets

```bash
# Changesets are in .changeset/ directory
# Create a new file: .changeset/<descriptive-name>.md
```

**Format:**

```markdown
---
'@bamboocss/package-name': patch|minor|major
---

Brief description of the change and its impact.

- Detail 1
- Detail 2
```

**Changeset types:**

- `patch`: Bug fixes, dependency updates, non-breaking changes
- `minor`: New features, backwards-compatible changes
- `major`: Breaking changes

## Important Files & Patterns

### Configuration Flow

1. User config → `packages/config/` → Config resolution
2. Config hooks → `packages/types/src/config.ts`
3. Context creation → `packages/node/src/` → `BambooContext`
4. Code generation → `packages/generator/`

### CSS Processing Flow

1. Style objects → `packages/core/src/rule-processor.ts`
2. CSS generation → `packages/core/src/stylesheet.ts`
3. Optimization → `packages/core/src/optimize.ts`
   - PostCSS path: `optimize-postcss.ts`
   - LightningCSS path: `optimize-lightningcss.ts`

### Test Fixtures

- `packages/fixture/` contains shared test utilities
- `createContext()` and `createRuleProcessor()` are used throughout tests
- Fixtures provide a base config with design tokens and recipes

## Debugging Tips

### Understanding Test Failures

**Snapshot mismatches:**

- Compare expected vs received CSS output carefully
- Look for media query ordering, selector merging, or whitespace changes
- Identify which dependency update caused the change
- Common culprits: `postcss-merge-rules`, `postcss-nested`, `browserslist`

**Build failures:**

- Check TypeScript errors in `packages/*/src/`
- Run `pnpm build-fast` for faster iteration without type checking
- Use `pnpm typecheck` for type-only validation

### Finding Code

**Use search tools strategically:**

- Grep for function names, class names, or specific strings
- Check both `/src/` and `/__tests__/` directories
- Look in `/packages/types/src/` for type definitions
- Config options are defined in `packages/types/src/config.ts`

## Watch Out For

1. **Circular dependencies**: Be careful when adding imports between core packages
2. **Browser compatibility**: Changes to browserslist affect CSS transformation
3. **PostCSS plugin order**: Order matters in `optimize-postcss.ts`
4. **Workspace protocol**: Internal packages use `workspace:*` in dependencies
5. **Multiple package.json**: Each package has its own, plus root package.json
6. **Sandbox warnings**: Even if main packages are fine, check sandbox projects for warnings
7. **TypeScript version sync**: The TypeScript version in the root `package.json` must match the version used by
   `ts-morph`'s dependency. Mismatches can cause parsing errors and type issues. Always verify `ts-morph` compatibility
   when updating TypeScript.

## Package Relationships

```
@bamboocss/dev (CLI)
  ├─ @bamboocss/node (core runtime)
  │   ├─ @bamboocss/core (CSS processing)
  │   ├─ @bamboocss/parser (static analysis)
  │   ├─ @bamboocss/generator (codegen)
  │   └─ @bamboocss/config (config resolution)
  └─ @bamboocss/postcss (PostCSS plugin)

@bamboocss/core
  ├─ postcss (CSS processing)
  ├─ lightningcss (optional, faster CSS processing)
  ├─ browserslist (browser targets)
  └─ postcss-* plugins (optimization)
```

## Useful References

- **Main documentation**: `/website/` (documentation source)
- **Type definitions**: `packages/types/src/` (comprehensive types)
- **Integration examples**: `/sandbox/` (real-world usage)
- **Test patterns**: `packages/fixture/` and `packages/core/__tests__/`

## Best Practices for AI Assistants

1. **Always read before writing**: Understand existing patterns before making changes
2. **Test incrementally**: Run tests after small changes, not just at the end
3. **Preserve CSS output**: When in doubt, prioritize CSS output stability
4. **Use workspace knowledge**: Remember this is a monorepo - changes may affect multiple packages
5. **Document breaking changes**: If CSS output must change, explain why clearly
6. **Check sandboxes**: Don't just test main packages - verify sandbox projects too

## Emergency Rollback

If a change breaks things:

```bash
git checkout packages/          # Revert package.json changes
pnpm install --ignore-scripts   # Restore dependencies
pnpm test packages/core         # Verify tests pass
```

---

**Last Updated**: 2025-01-17 **Project Version**: 1.4.2
