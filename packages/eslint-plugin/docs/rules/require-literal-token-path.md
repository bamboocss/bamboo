# Require a token path the build can resolve, so `pruneUnusedTokens` can drop the declarations nothing asks for (`@bamboocss/require-literal-token-path`)

⚠️ This rule _warns_ in the 🌐 `all` config.

<!-- end auto-generated rule header -->

`token()` returns a css variable reference for every token, so a path the build cannot read could name any of them — and
every token declaration has to be kept in case it does.

```tsx
import { token } from '../styled-system/tokens'

// ✅ one declaration kept
token('colors.red.300')

// ⚠️ the colour tokens kept — the head bounds it, but only to the category
token(`colors.${shade}`)

// ⚠️ every token declaration kept — nothing bounds it
token(shade)
token(`${path}`)
```

On the default preset that is the difference between one declaration and several hundred.

## Why lint it

The build already knows. `pruneUnusedTokens` reports what it could not account for, and
[`pruneUnusedTokens: 'strict'`](https://bamboocss.com/docs/references/config#pruneunusedtokens) fails the build on a
token path it cannot follow.

This rule moves the same finding to where the code is written, so it shows up in the editor rather than in a build log —
and it fires whatever `pruneUnusedTokens` is set to, which is useful before you turn `strict` on.

## The two messages

**`opaqueTokenPath`** — nothing about the path is knowable, so every token declaration survives. Spell the path at the
call, or give a template a static prefix.

**`boundedTokenPath`** — the template's head names a category, so the build keeps that category and prunes the rest. Not
wrong, and sometimes exactly what you want; it is reported because a spelled-out path keeps one declaration where this
keeps hundreds.

## When not to use it

A project that reaches for tokens dynamically on purpose — a theme browser, a docs site rendering every colour — will
trip this on every call, and no rewrite helps. Turn it off there and keep `pruneUnusedTokens` at its default, which
keeps everything and says nothing.

It is not in `recommended` for that reason: the dynamic form is a supported way to use tokens, and this rule is about a
size trade rather than a mistake.

## What it recognises

`token()` and `token.value()`, under the name the file imported them as, through a namespace import
(`import * as ds from '…/tokens'`), and as a bare `token(…)` with no import at all — the build's accounting keys on the
name too, so staying quiet there would mean `strict` failing a build the editor called clean.

A type assertion around the path is unwrapped first. The generated `Token` type is a union of template literals, so
``token(`colors.${shade}` as Token)`` is what a typed caller has to write, and it bounds perfectly well.

Two spellings are reported without looking at the path at all, because the build cannot resolve the _call_: a computed
member (`token['value'](…)`) and a tagged template (``token`colors.${s}` ``).

## What it does not catch

The rule reads call sites, so it says nothing about a binding that escapes one — `const t = token`,
`[token].map(f => …)`, a default import. The build declines all of those, and `strict` fails on them, so a clean lint
run is not a promise that `strict` will pass.

It also matches the tokens artifact by a substring of the import specifier, where the build resolves tsconfig path
mappings. A token import reached only through a path alias that does not spell `tokens` is invisible to the rule.
