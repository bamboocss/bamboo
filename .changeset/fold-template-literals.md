---
'@bamboocss/vite': minor
---

Fold static `css` tagged templates under `syntax: 'template-literal'`.

A tagged template is not a call expression, so none of them ever reached the fold — every one was declined as
`no-call-expression`, including the ones that resolve to a plain class string. In a project using this syntax that is
most of them:

```tsx
// you write
const cls = css`
  color: red.300;
  padding: 4px;
`

// the bundle gets
const cls = 'color_red.300 padding_4px'
```

The care here is in deciding what the tag is. Under this syntax the parser records _every_ styling tag as a `css` entry
— `styled.button` and `styled('span')` included — and those define components. Folding one to a string would replace a
component with text, so the tag is established structurally rather than taken from the entry's name: a bare identifier,
or a property access whose leaf is the `css` export, and never a call or a factory member. The parser's own normalized
name has to agree, which is also what lets an aliased `css as xcss` fold.

A template carrying an interpolation declines as `dynamic`. The parser reads the template's text and an interpolation is
a value that text cannot carry, so nothing accounts for it.

Outside `syntax: 'template-literal'` nothing changes — the parser does not read tagged templates there, so there is no
extraction behind them and a folded class would have no rule.

Perf-neutral, and structurally so: the new code is reachable only from the branch that previously just recorded a skip.
An A/B of the fold bench put every case inside the ~10% noise band with mixed signs (synthetic module −5.9%, Button
+9.6%) while the controls themselves moved −0.4% and −4.2%.

No CSS output changes.
