/**
 * Ambient declaration for the virtual stylesheet, so `import 'virtual:bamboo.css'`
 * typechecks.
 *
 * Reference it once, next to the `vite/client` reference a vite project already has:
 *
 *     /// <reference types="@bamboocss/vite/client" />
 *
 * Shipped as a separate entry rather than folded into the package's own types, because a
 * `declare module` in the main entry would apply to every consumer of the exported API —
 * including builds that do not use the plugin.
 */
declare module 'virtual:bamboo.css' {}
