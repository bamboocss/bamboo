# Release process

## Overview

Our release process is very flexible and can be adapted to the needs of the project. We generally aim for a release per
week, but we do immediate releases for critical bugs and security issues.

## Versioning

All packages are versioned equally and managed with [Changeset](https://github.com/changesets/changesets).

## Changelogs

There is no hand-written changelog. Changeset writes a `CHANGELOG.md` per package from the changeset files, and the
Publish workflow cuts a [GitHub release](https://github.com/gajus/bamboocss/releases) per package from the same content.
The docs site links to those releases.

A root `CHANGELOG.md` used to be maintained by hand alongside this. It fell three minor versions behind before anyone
noticed, because nothing in the release path touched it, so it was removed rather than kept limping.

Write the changeset well and the changelog follows: it is the text end users read.

## Process

Before creating a new release, make sure that there are no pending pull requests that should be included in the release.

1. Merge the `Version Packages` Pull Request opened by the Changeset GitHub Action.

   Merging it bumps every package, consumes the changesets, and triggers Publish, which authenticates to npm over OIDC
   as a [trusted publisher](https://docs.npmjs.com/trusted-publishers/) rather than with a token.

2. Add any lingering documentation.

To publish without a qualifying commit — to retry a failed publish, or to re-open a closed Version Packages PR:

```bash
gh workflow run release.yaml --repo gajus/bamboocss --ref main
```
