---
'@bamboocss/generator': patch
'@bamboocss/dev': patch
---

Give the generated `styled-system/package.json` a name.

That file was emitted without one, deliberately, so that two outputs in a single workspace could not collide on the same
name. But a nameless `package.json` is not one a workspace scanner skips — it is one it refuses. pnpm, npm and
changesets all abort with `missing the "name" field`, and none of them say which directory produced it. Any project
whose workspace globs reach an output directory hit this, and a recursive glob such as `packages/**` reaches every one
of them.

The name is derived from `outdir`, the only input that is both deterministic and portable (`cwd` is absolute, so putting
it in generated output would make that output differ per machine). Two projects in one workspace that both keep the
default `outdir` therefore still collide — but on a duplicate-name error that names both paths, rather than on a missing
field that points nowhere.

`bamboo emit-pkg` used to treat a missing name as its signal that the file was generated rather than hand-authored. It
now keys on the file being `private` with no `version`, which is what actually distinguishes generated output from a
package the consumer owns — a private _named_ package in the output directory is the `@acme/styled-system` workspace
layout the component-library guide recommends, and that is still left alone.
