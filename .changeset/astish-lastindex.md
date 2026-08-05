---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Stop a failed `astish` parse from corrupting the next one.

`astish` matches with a module-level `/g` regex, so `exec` carries `lastIndex` between calls. A loop that runs to
completion resets it; one that _throws_ does not. Malformed CSS throws — `{ }` matches neither a property nor a
selector, so the property branch reads `undefined` — and the next call then resumes from wherever the last one died.

It does not fail there, which is what makes it dangerous. It returns a **shifted** parse:

```js
astish('{ }') // throws
astish('color: red.300; padding: 4px;')
// → { olor: 'red.300', padding: '4px' }   ← `color` became `olor`
```

Everything downstream then agrees on the wrong answer: the stylesheet emits `.olor_red\.300 { olor: red.300 }`, and
under source transformation the same wrong class is written into the bundle. A caller that catches the first error and
carries on — which is exactly what the Vite plugin does per module — sees plausible nonsense from that point on.

`astish` also ships in the generated runtime for `syntax: 'template-literal'`, so this reached the browser: one
malformed template shifted every `css` tag evaluated after it.

Fixed by resetting `lastIndex` on entry, which makes each call independent of how the last one ended. Malformed input
still throws — only the contamination of the next call is gone.
