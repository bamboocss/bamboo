const newRule = /(?:([\u0080-\uFFFF\w-%@]+) *:? *([^{;]+?);|([^;}{]*?) *{)|(}\s*)/g
const ruleClean = /\/\*[^]*?\*\/|  +/g
const ruleNewline = /\n+/g
const empty = ' '

export const astish = (val: string, tree: any[] = [{}]): Record<string, any> => {
  if (!val) return tree[0]
  let block, left

  // `newRule` is a module-level `/g` regex, so `exec` carries `lastIndex` between calls.
  // A loop that runs to completion resets it, but one that *throws* — which malformed CSS
  // like `{ }` does, since neither a property nor a selector matches — leaves it mid-string,
  // and the next call starts parsing from that offset. It does not fail there: it silently
  // returns a shifted result, so `color: red` comes back as `olor: red`. Resetting on entry
  // makes each call independent of how the last one ended.
  newRule.lastIndex = 0

  while ((block = newRule.exec(val.replace(ruleClean, '')))) {
    if (block[4]) tree.shift()
    else if (block[3]) {
      left = block[3].replace(ruleNewline, empty).trim()
      if (!left.includes('&') && !left.startsWith('@')) left = '& ' + left
      tree.unshift((tree[0][left] = tree[0][left] || {}))
    } else tree[0][block[1]] = block[2].replace(ruleNewline, empty).trim()
  }

  return tree[0]
}
