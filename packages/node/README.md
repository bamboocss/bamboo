# @bamboocss/node

The Node runtime behind Bamboo CSS: config loading, context creation, extraction and the write side of codegen and
`styles.css`.

This is an internal package. It is what `@bamboocss/dev` (the CLI), `@bamboocss/postcss` and `@bamboocss/vite` are built
on, and it is versioned with them — most projects should install one of those instead. User-facing documentation lives
at [bamboocss.com/docs](https://bamboocss.com/docs).

## Exports

Everything below is exported from `@bamboocss/node`.

### Context

- `loadConfigAndCreateContext({ cwd?, config?, configPath? })` – resolve the config file, merge presets and inline
  overrides, auto-inject the built-in plugins (`vue`, `svelte`), and return a `BambooContext`.
- `BambooContext` – the resolved config plus everything derived from it: tokens, utilities, conditions, recipes,
  patterns, the `ts-morph` project, the output engine and the diff engine.
- `Builder` – the incremental driver the bundler plugins use. It owns context setup, tracks which files and config
  dependencies changed, re-extracts only those, and hands back the stylesheet (`toCss`) or writes it into a PostCSS root
  (`write`).

### Commands

Each takes a `BambooContext`, and each backs the CLI command of the same name.

- `generate(config, configPath?)` – the full build, including `--watch`. Unlike the rest, it creates its own context.
- `codegen(ctx, ids?)` – write the generated `styled-system` artifacts.
- `cssgen(ctx, options)` – write the stylesheet.
- `analyze(ctx, options?)` – report token and recipe usage.
- `debug(ctx, options)` – write the resolved config, per-file AST and per-file CSS.
- `buildInfo(ctx, outfile)` – write the static extraction result as JSON, for consumers that ship it instead of source.
- `spec(ctx, options)` – write the spec files.

### Setup and utilities

- `setupConfig(cwd, options?)` / `setupPostcss(cwd)` – scaffold `bamboo.config.ts` and the PostCSS config.
- `setupGitIgnore(ctx)` – add the outdir to `.gitignore`, unless `config.gitignore` is off.
- `parseDependency(fileOrGlob)` – turn a `config.dependencies` entry into a PostCSS `dependency` or `dir-dependency`
  message.
- `setLogStream({ cwd, logfile })` – tee logs to a file.
- `startProfiling(cwd, prefix, isWatching?)` – start a V8 CPU profile; the returned function stops it and writes
  `bamboo-{prefix}-{timestamp}.cpuprofile` into `cwd`.
