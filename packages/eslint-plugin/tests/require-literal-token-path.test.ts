import multiline from 'multiline-ts'
import rule, { RULE_NAME } from '../src/rules/require-literal-token-path'
import { eslintTester } from '../test-utils'

/**
 * A token path the build cannot resolve costs the whole token layer, because `token()` returns
 * a variable reference for *any* token and an unreadable path could name any of them. Under
 * `pruneUnusedTokens: 'strict'` it fails the build outright.
 *
 * The rule reports it where it is written, rather than as a build message about a file. A
 * template with a static head is reported separately and more mildly: the build bounds it to
 * that category, so it is a size cost rather than a cliff.
 */
eslintTester.run(RULE_NAME, rule, {
  invalid: [
    {
      // The real import, declared *after* an unrelated one that used to mask it.
      code: multiline`
  import { token as authToken } from './auth';
  import { token } from './bamboo/tokens';
  
  export const color = (s) => token(s)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // A tagged template never resolves: the artifact exports a function, not a tag.
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = (s) => token\`colors.\${s}\``,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // Computed access, which the build declines even with a literal path.
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = token['value']('colors.red.300')`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // A bare `token` the file never imported. The build keys on the name too, so staying
      // quiet here would mean `strict` failing a build the editor called clean.
      code: multiline`
  export const color = (p) => token(p)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import { token as t } from './bamboo/tokens';
  
  export const color = (s) => t(s)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import * as ds from './bamboo/tokens';
  
  export const space = (s) => ds.token.value(s)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // No argument at all — reaches the report fallback, since there is no node to point at.
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = token()`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import { token, Token } from './bamboo/tokens';
  
  export const color = (s) => token(s satisfies Token)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = (shade) => token(shade)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  const KEY = 'colors.red.300'
  export const color = token(KEY)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // Nothing in front of the substitution, so there is no category to keep.
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = (path) => token(\`\${path}\`)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const value = (p) => token.value(p)`,
      errors: [{ messageId: 'opaqueTokenPath' }],
    },
    {
      // Bounded, not opaque: the build keeps `colors.*` and prunes the rest.
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = (shade) => token(\`colors.\${shade}\`)`,
      errors: [{ messageId: 'boundedTokenPath' }],
    },
    {
      code: multiline`
  import * as ds from './bamboo/tokens';
  
  export const color = (shade) => ds.token(\`colors.\${shade}\`)`,
      errors: [{ messageId: 'boundedTokenPath' }],
    },
  ],
  valid: [
    {
      // An unrelated `token` import must neither fire nor mask a real one — the shared import
      // helper searched every module and took the first match, so line order decided.
      code: multiline`
  import { token as authToken } from './auth';
  
  export const a = (id) => authToken(id)`,
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = token('colors.red.300')`,
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const space = token.value('spacing.4')`,
    },
    {
      // A typed caller needs the assertion — the generated `Token` type is a union of template
      // literals, so a `string` substitution does not typecheck without one.
      code: multiline`
  import { token, Token } from './bamboo/tokens';
  
  export const color = token('colors.red.300' as Token)`,
    },
    {
      code: multiline`
  import { token } from './bamboo/tokens';
  
  export const color = token(\`colors.red.300\`)`,
    },
  ],
})
