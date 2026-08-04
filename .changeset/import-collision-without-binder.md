---
'@bamboocss/vite': patch
---

Decide whether the fold can add its `cx` import without binding the whole program.

The check went through `sourceFile.getLocals()`, which reaches the compiler's symbol table and binds every `.d.ts` the
module's imports touch. A syntactic walk of the module's statements answers the same question. Fold-only cost for a
module that splits, A/B on an idle machine:

| project size | before  | after  |
| ------------ | ------- | ------ |
| ~500 files   | 5.28ms  | 0.06ms |
| ~2500 files  | 11.57ms | 0.07ms |

85x at 500 files and 178x at 2500, and flat in project size where it previously grew linearly.

The walk follows statements but not function or class bodies, since those open a new variable scope — so a hoisted `var`
in any top-level block still blocks the insert, while one inside a function does not.
