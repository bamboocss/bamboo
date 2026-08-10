---
'@bamboocss/node': patch
---

Read each source file once per build, and always ignore declaration files.

The keep set, the reachability gate and the `strict` accounting all want the same two copies of the same files, and each
fetched them itself. A strict build therefore opened every file three times — once to collect references, once to
account, and once more for the gate whenever the accounting declined. They now share one walk. Pinned by counting reads
rather than timing them, so it runs in CI.

`**/*.d.ts` is now always ignored by the source glob. It used to be a _default_ that a project's own `exclude` replaced,
so whether declaration files were scanned came down to whether the project happened to set an unrelated option:
`exclude: []` ignored them, `exclude: ['**/*.stories.tsx']` scanned them. A declaration file carries no runtime code and
can emit no styles; it was only ever read by the deliberately over-inclusive reference scans, where it could keep a
token named in a doc comment. Half of projects got that and half did not, by accident.
