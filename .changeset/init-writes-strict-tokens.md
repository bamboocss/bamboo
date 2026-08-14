---
'@bamboocss/dev': minor
'@bamboocss/node': minor
'@bamboocss/config': minor
---

Make `bamboo init` write the answers it collects, and stop steering Vite projects onto the runtime path.

`--strict-tokens` did nothing. cac parsed it, the interactive prompt asked for it, and the init action destructured
every other flag — so a project that asked for strict tokens got a config without the key, with nothing said. The flag
is in the CLI reference, which made it worse: the only way to find out was to write a misspelled token and wait for a
report that never came. It now reaches the generated config, and takes the middle mode too:
`bamboo init --strict-tokens unknown-tokens`, which was otherwise a config-file feature `init` could not produce. As
before, `init` writes nothing when a config already exists unless `--force` is passed, so the flag applies to the config
it creates.

An unrecognised value is refused rather than coerced. Mapping the unknown to `true` would make `--strict-tokens=false`
turn it _on_, and a typo in the middle mode's name pick the strictest setting there is — every raw CSS value in the
project becoming a type error with nothing naming the mistake. `false`, `no`, `off` and an empty value are all read as
off.

A config that names a setting which does not exist is now reported too. `strictTokens: 'unknown'` reached the generated
types as a comparison against two known values and emitted a _fourth_ prop shape that no setting asks for, from a build
that exited 0.

The interactive prompt's first question — "Would you like to use PostCSS?" — defaulted to yes for every project. That is
the choice between an integration that compiles your style calls away and one that ships the style engine to the client,
and both render identically, so pressing Enter picked the heavier one and nothing afterwards said so. It now defaults
from the project: a Vite config means `@bamboocss/vite` is available and the answer is no, unless the project is Svelte,
Vue or Astro, whose components the compiler does not transform. The wording says what the question decides rather than
naming the tool.

The strict-tokens prompt offers the three modes rather than yes/no, and `InitFlags` declares what `interactive()`
returns — the missing field behind an `as` cast is what let the answer be dropped in the first place.
