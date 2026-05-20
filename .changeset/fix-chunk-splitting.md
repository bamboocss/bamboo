---
'@bamboocss/dev': patch
'@bamboocss/config': patch
'@bamboocss/core': patch
'@bamboocss/studio': patch
---

Fix chunk splitting in build output that produced unstable hashed filenames in published packages.

- Build each entry point independently to prevent shared-code extraction into chunk files
- Fix build ordering race condition where studio postbuild could run before CLI was ready
