---
'@bamboocss/vite': minor
---

Remove `denseClassNames`. Class-name compaction is the core `hash` option's job.

Two independent mechanisms shortened class names at different layers: core `hash`, which applies to every build path,
and this Vite-only rename applied after pruning. The overlap was never documented, and the second one contributed to
three separate defects — the reachability key that lost every `::before` rule went through its semantic lookup, its
`local` mode allocates names from a counter and so produced different names per build environment, and because compact
names contain no characters needing CSS escaping, every configuration using it left the escaping paths untested.

That last point was load-bearing in a way that was invisible: an existing assertion checked that each class a compiled
recipe returns has a rule, by looking for `.${token} {` in the sheet. The sheet spells a class escaped. Compact names
had nothing to escape, so the comparison passed without ever exercising the transform it depends on. With semantic names
it fails until the check goes through `esc`, which is now what it does.

Projects wanting short class names should set `hash: true` in `bamboo.config.ts`, which covers CLI and PostCSS output
too. Removing the option is a behaviour change for every Vite build: class names in the emitted CSS and JavaScript are
now the semantic ones unless `hash` says otherwise.
