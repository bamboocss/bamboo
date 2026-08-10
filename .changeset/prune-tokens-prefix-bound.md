---
'@bamboocss/node': minor
---

Bound a dynamic token path by its static prefix instead of keeping every declaration.

Under `pruneUnusedTokens: 'strict'`, ``token(`colors.${shade}`)`` used to be reported as unresolvable, which keeps the
whole token layer — 468 declarations on the default preset against 68 for the old, narrower exemption. Bamboo cannot
tell which token that call wants, but it can tell which it _cannot_: everything the expression produces starts
`colors.`. It now keeps that category and prunes the rest.

The static head was already sitting in the source and was thrown away. It is the shape the documentation site itself
uses, and the only genuinely dynamic token call in this repository.

A head that bounds nothing — ``token(`${path}`)`` — is still reported, and still keeps everything.
