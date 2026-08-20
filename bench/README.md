# Performance harnesses

## Vite cold import

Run the built `@bamboocss/vite` entry in genuinely fresh Node processes:

```bash
pnpm bench:vite-import
```

The default target is `packages/vite/dist/index.mjs`; build it first with `pnpm --filter=@bamboocss/vite build-fast`.
Configure the number of warmups and measured samples with `--warmups` and `--samples`.

Each measured round includes a no-op child-process control. The report shows both raw process lifetime and net time
(that round's import minus that round's control). It prints a concise human summary and writes the machine-readable
report to `bench/vite-cold-import.latest.json`. Use `--json -` for stdout or `--json <path>` for another file. The
destination is removed before measurement and a successful report replaces it atomically, so a failed run cannot leave
an older result masquerading as the latest one. `SIGINT`, `SIGTERM`, and per-child timeouts terminate the active child
process group.

Pass two built module paths or resolvable specifiers for a blind A/B run:

```bash
pnpm bench:vite-import -- ./before/index.mjs ./after/index.mjs --samples 30 --seed 42
```

The seed controls both the opaque A/B assignment and execution order. Every round interleaves control, A, and B in a
randomized order; complete six-round decks balance every permutation. The scheduling algorithm is versioned in the
report and pinned by a golden protocol test, so the same version and seed replay the same assignment and order.

Before and after measurement, an untimed, process-isolated import traces every loaded file. The final report discloses
the A/B mapping plus each entry and loaded-graph path, size, mtime, and SHA-256 identity. It also records the harness,
Node/OS/git environment, and every observation. A report is invalid when an endpoint graph or harness identity differs;
this endpoint check cannot detect a file changed and then restored with both its original contents and mtime.

The module graph is cold inside every child; warmups intentionally allow the host filesystem cache to settle. This
harness does not attempt to flush OS disk caches.

For a Vite source-code A/B, keep the two built ESM graphs before switching revisions. Copying them beside Vite's own
`node_modules` preserves resolution of their external imports, while separate directories preserve the entry's relative
imports of `class-name.mjs` and its lazy chunks:

```bash
artifact_root=packages/vite/node_modules/.cache/bamboo-vite-import
mkdir -p "$artifact_root/before" "$artifact_root/after"
pnpm --filter=@bamboocss/vite build-fast
cp packages/vite/dist/*.mjs "$artifact_root/before/"
# Switch to the candidate source, then rebuild it.
pnpm --filter=@bamboocss/vite build-fast
cp packages/vite/dist/*.mjs "$artifact_root/after/"
pnpm bench:vite-import -- "$artifact_root/before/index.mjs" "$artifact_root/after/index.mjs" --samples 30 --seed 42
```

Confirm the two entry hashes differ in the report. Both entries intentionally resolve external workspace packages from
the current checkout, so use isolated installations instead when the change being compared lives in one of those
dependencies.

The deterministic calculation and scheduling tests run with:

```bash
pnpm test run bench/vite-cold-import.test.mjs
```
