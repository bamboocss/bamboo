import { cx } from '../styled-system/css'
import { ButtonVariantProps, button } from '../styled-system/recipes'

/**
 * A recipe component, written the way the recipes guide prescribes.
 *
 * The override is a `className`, not a `css` prop. An arbitrary style object handed to `css()`
 * has no finite rule set behind it — the caller decides it, so the build cannot know which
 * declarations to emit — and this integration has no runtime styling fallback to fall back on.
 * A class string is already compiled by the time it arrives here, so composing one with `cx`
 * costs nothing and stays correct.
 *
 * `button(variantProps)` is a different matter and is fine: a recipe's axes are declared, so a
 * selection the build cannot read is still drawn from a set it can enumerate.
 */
interface ButtonProps extends ButtonVariantProps {
  children: React.ReactNode
  className?: string
}

export function Button(props: ButtonProps) {
  const { children, className, ...rest } = props
  const [variantProps] = button.splitVariantProps(rest)
  return <button className={cx(button(variantProps), className)}>{children}</button>
}

export function ListedButton({ children, variant, size, className }: ButtonProps) {
  return <button className={cx(button({ variant, size }), className)}>{children}</button>
}

export function AnotherButtonWithRegex({ children, variant, size, className }: ButtonProps) {
  return <button className={cx(button({ variant, size }), className)}>{children}</button>
}
