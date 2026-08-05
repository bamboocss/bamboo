/**
 * `target.push(...source)`, without the cliff.
 *
 * Spreading passes every element as a separate argument, which is the faster way to append
 * while the array is small and stops being so abruptly. Measured here, per element:
 *
 *     10,750 elements   0.88 ns      <- still the fast path
 *     11,000 elements   4.37 ns      <- 5x, in 250 elements
 *
 * Past that it eventually throws rather than slowing down, because the elements become
 * arguments and stop fitting on the stack. Where is not a fixed number — 124,000 from an empty
 * stack, 16,000 from 9,000 frames down — so no threshold makes it safe, only unlikely.
 *
 * A loop has neither property. It gives up roughly 70ns on the hundred-element appends that
 * dominate, which is invisible against the per-object work on either side of it, and in
 * exchange the cost stays linear at every size.
 */
export function pushAll<T>(target: T[], source: readonly T[]) {
  // Read once: `pushAll(a, a)` would otherwise never terminate.
  const length = source.length
  for (let i = 0; i < length; i++) target.push(source[i]!)
}
