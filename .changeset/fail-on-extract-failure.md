---
'@bamboocss/node': minor
'@bamboocss/shared': minor
'@bamboocss/vite': minor
---

Fail the build when a file cannot be extracted, instead of logging it and exiting 0.

```
error during build:
[bamboocss:css] Could not load virtual:bamboo.css: 1 file(s) could not be extracted:

src/Timeline.tsx
  `{colors.brand.purple/35}` in the value `0 0 0 2px {colors.brand.purple/35}` is the retired
  token reference syntax. Write `token(colors.brand.purple/35)` instead.

Nothing emits a rule for a file the build could not read, so every style in these is absent from
the stylesheet and the classes their components ask for have nothing behind them.
```

Extraction caught, logged, and carried on. The file's styles never reach the encoder, so every rule it would have
contributed is simply gone — one retired token spelling in one component dropped that component's css and left a green
build behind it. Three error-level lines, exit 0, and `built` printed at the end.

**The two integrations disagreed about the same source.** `bamboo cssgen` exited 1 on a file it could not extract,
because it went through the one entry point that let the throw out; every bundler build went through the one that caught
it. CI running a build passed what CI running `cssgen` rejected. Both now go through the same path, so the question is
settled once rather than per integration.

Every broken file is named in one error rather than the first one aborting the pass, and a failure is keyed by file so
it survives the incremental passes that skip an unchanged one — otherwise a rebuild of identical, still-broken source
came back green. It is dropped once the file parses, is deleted, or leaves `include`, since a context outlives rebuilds
and all three of those are fixes. A watch rebuild still reports and keeps watching; only a build fails.

**`failOnUnfolded` counts a module the fold threw on.** A throw in the vite transform was caught and the module returned
unchanged, which is safe — its runtime call still works — but it landed in neither the folded column nor the declined
one. The coverage summary reported 100% over the files that did not throw, and the survivor check saw a file that was
never there, so the option's whole guarantee held vacuously over it. It now reports as `fold-failed`. Unknown counts as
survives: the claim is that _nothing_ still calls `css()`, and a module nobody could look at cannot support it. Without
`failOnUnfolded` it stays a logged error and a declined module, as before.
