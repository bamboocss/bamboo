/* eslint-disable */
import type { SystemStyleObject } from '../types/index';

type Styles = SystemStyleObject | undefined | null | false

interface CssRawFunction {
  (styles: Styles): SystemStyleObject
  (styles: Styles[]): SystemStyleObject
  (...styles: Array<Styles | Styles[]>): SystemStyleObject
  (styles: Styles): SystemStyleObject
}

interface CssFunction {
  (styles: Styles): string
  (styles: Styles[]): string
  (...styles: Array<Styles | Styles[]>): string
  (styles: Styles): string

  raw: CssRawFunction
}

export declare const css: CssFunction;

/**
 * Internal. Emitted for the source transform, which rewrites a single dynamic style
 * leaf into a call to this. Not part of the authoring API.
 */
export declare const cssLeaf: (prefix: string, prop: string, value: unknown) => string;