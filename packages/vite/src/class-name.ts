/**
 * A class name with its CSS escapes removed, which is the only spelling the compiler and
 * stylesheet inventory both agree on.
 *
 * This stays in the eager graph because the output lifecycle uses it for a synchronous safety
 * check. The PostCSS parser which consumes the same spelling belongs to the lazy CSS-output
 * boundary instead.
 */
export const bare = (className: string) => className.replaceAll('\\', '')
