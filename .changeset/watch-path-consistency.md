---
'@bamboocss/node': patch
'@bamboocss/dev': patch
---

Use absolute paths consistently in the file watchers.

The watch handlers removed files by absolute path but reloaded and created them by the path the watcher reported, which
is relative to the working directory. A reload that fails to match the file the project holds does nothing and returns
quietly, leaving the edit unread — and with cross-file extraction, an unread edit also leaves every importer emitting
the previous styles.

A newly added file now also rebuilds the files importing it, since it can satisfy an import that previously resolved to
nothing.
