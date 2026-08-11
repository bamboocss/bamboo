---
'@bamboocss/node': patch
---

Stop reporting unresolved styles in files bamboo generated.

```
warn [css] styled-system/css/css.mjs:48:36 — an object spread or computed key leaves the
build unable to tell which properties this call sets.
```

`include` conventionally covers a source tree that `outdir` sits inside — `./src/**` and `src/styled-system` — so the
build routinely parses its own output. The generated `css.mjs` defines `cssLeaf` as `css({ [prop]: value })`, a computed
key and so unenumerable by construction, and that warned on every build of every such project. There was no edit that
would silence it: the file is regenerated from bamboo's own template.

That is worse than noise. It sits in the same channel as the losses that do matter and have fixes — an unresolvable
value, a recipe whose hash the browser will not agree with — and a line that is always there teaches everyone reading
the log to skip the channel.

Suppressed at the report rather than by dropping the directory from the scan, because that overlap is load-bearing
elsewhere: the token and keyframe reference scans read whatever `include` covers. Authored source is reported exactly as
before.
