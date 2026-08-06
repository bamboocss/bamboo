---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
'@bamboocss/parser': patch
'@bamboocss/node': patch
---

Stop `cssMode: 'grouped'` rendering an element with no styles when the build could not see the whole `css()` call.

A grouped class names a whole call, so the build has to have seen that exact call to emit its rule. When it had not — an
unresolvable value, a combination it declined to enumerate — the runtime returned a class with nothing behind it and the
element rendered blank. Not a degraded version of the styles: none of them.

Three pieces, and the feature needs all three:

- The build writes the set of grouped classes it emitted to `styled-system/css/groups.mjs`, refreshed after every
  extraction — including `--watch`, which reaches CSS emission through a path of its own. `codegen` seeds an empty one
  when the file is missing, so the import resolves on a fresh project, and leaves a populated one alone rather than
  blanking it.
- The generated `css()` consults it. A class in the set is returned alone, as before. A class that is not keeps the
  group class and **adds** atomic names for each declaration.
- A call the build flagged as unresolvable now contributes atomic rules as well as its group, so those names have
  somewhere to land. Gated on the call actually being at risk, so the duplication is bounded by unresolvable call sites
  rather than by stylesheet size.

Adding to the group class rather than replacing it is what makes a stale registry harmless: it lags the stylesheet as a
matter of when files land, and replacing would turn every lag into an element stripped of styles it really had. A wrong
miss now costs one class that matches nothing. Only a false _hit_ can hurt, which is why the registry is an exact set
and not a probabilistic one.

A value the build never saw still has no rule under any mode — the same limit `atomic` has. What changes is that the
declarations it _did_ resolve now apply.
