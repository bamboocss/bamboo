---
'@bamboocss/dev': minor
'@bamboocss/node': minor
---

Remove `cssgen --minimal`, leaving the artifact type as the one way to say what `cssgen` emits.

`cssgen <type>` names one of `preflight`, `tokens`, `static`, `global` or `keyframes`. `--minimal` answered the same
question from the other side — everything _except_ those five — so which flag you reached for depended on which side of
the set you were standing on.

To ship only the css your source uses, generate everything and import the part you want. `--splitting` writes each layer
as its own file:

```bash
bamboo cssgen --splitting
```

```
styled-system/styles/utilities.css   # what --minimal emitted
styled-system/styles/recipes.css
```

That costs the generation of the layers you then do not import, which is build time rather than shipped bytes.
