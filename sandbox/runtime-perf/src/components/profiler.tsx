import {
  Fragment,
  type ProfilerOnRenderCallback,
  Profiler as ReactProfiler,
  type ReactNode,
  useCallback,
  useState,
} from 'react'

/**
 * One `onRender` call, held so the whole run can be printed as a table rather than as a
 * line per commit.
 *
 * A class rather than the constructor function this was, which `strict` cannot type: `this`
 * in a plain function has no annotation to infer from, so every field landed as `any` and
 * the six parameters with it.
 */
class ProfilerResult {
  constructor(
    readonly id: string,
    readonly phase: 'mount' | 'update' | 'nested-update',
    readonly actualDuration: number,
    readonly baseDuration: number,
    readonly startTime: number,
    readonly commitTime: number,
  ) {}
}

const entries: ProfilerResult[] = []

const profilerResults: ProfilerOnRenderCallback = (...args) => {
  entries.push(new ProfilerResult(...args))
  console.group('Profiler')
  console.table(entries)
  console.groupEnd()
}

interface ProfilerProps {
  children: ReactNode
  /** Passed through to React's `Profiler`, which reports it back on every commit. */
  id: string
  name?: string
  onRerender: (value: number) => void
}

export const Profiler = ({ children, id, name: _name, onRerender }: ProfilerProps) => {
  const [value, setValue] = useState(0)

  const onClick = useCallback(() => {
    setValue((value) => value + 1)
    onRerender(value)
  }, [value])

  return (
    <Fragment>
      <h1>Bamboo</h1>
      <button onClick={onClick}>Force Rerender</button>
      <hr style={{ margin: '24px 0' }} />
      <ReactProfiler onRender={profilerResults} id={id}>
        {children}
      </ReactProfiler>
    </Fragment>
  )
}
