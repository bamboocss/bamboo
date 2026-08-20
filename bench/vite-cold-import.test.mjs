import { spawn, spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, test, vi } from 'vitest'
import { calculateResults, createProtocol, executeProtocol, parseArguments, summarize } from './vite-cold-import.mjs'

const harnessPath = join(process.cwd(), 'bench/vite-cold-import.mjs')

const runHarness = (arguments_, options = {}) =>
  spawnSync(process.execPath, [harnessPath, ...arguments_], {
    cwd: options.cwd,
    encoding: 'utf8',
    env: options.env,
    timeout: 10_000,
  })

const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds))

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const waitForStablePid = async (pidPath) => {
  const deadline = Date.now() + 5000
  while (Date.now() < deadline) {
    if (existsSync(pidPath)) {
      const pid = Number(readFileSync(pidPath, 'utf8'))
      if (Number.isInteger(pid) && isProcessAlive(pid)) {
        await delay(100)
        if (Number(readFileSync(pidPath, 'utf8')) === pid && isProcessAlive(pid)) return pid
      }
    }
    await delay(20)
  }
  throw new Error('Timed out waiting for the measured import child')
}

describe('vite cold-import harness', () => {
  test('calculates median, nearest-rank p95, min, and max deterministically', () => {
    expect(summarize([100, 1, 4, 2, 3, 6, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19])).toEqual({
      count: 20,
      max: 100,
      median: 10.5,
      min: 1,
      p95: 19,
    })
  })

  test('builds replayable, interleaved, position-balanced A/B rounds', () => {
    const first = createProtocol({ samples: 12, seed: 42, targetCount: 2, warmups: 2 })
    const replay = createProtocol({ samples: 12, seed: 42, targetCount: 2, warmups: 2 })

    expect(replay).toEqual(first)
    expect({
      assignment: first.assignment,
      samples: first.sampleRounds.map(({ order }) => order),
      warmups: first.warmupRounds.map(({ order }) => order),
    }).toEqual({
      assignment: { A: 0, B: 1 },
      samples: [
        ['A', 'B', 'control'],
        ['control', 'B', 'A'],
        ['control', 'A', 'B'],
        ['B', 'A', 'control'],
        ['B', 'control', 'A'],
        ['A', 'control', 'B'],
        ['A', 'control', 'B'],
        ['control', 'A', 'B'],
        ['B', 'A', 'control'],
        ['B', 'control', 'A'],
        ['A', 'B', 'control'],
        ['control', 'B', 'A'],
      ],
      warmups: [
        ['A', 'control', 'B'],
        ['B', 'control', 'A'],
      ],
    })
    expect(Object.values(first.assignment).sort()).toEqual([0, 1])

    for (const round of [...first.warmupRounds, ...first.sampleRounds]) {
      expect([...round.order].sort()).toEqual(['A', 'B', 'control'])
    }

    for (const sixRoundDeck of [first.sampleRounds.slice(0, 6), first.sampleRounds.slice(6, 12)]) {
      for (const label of ['control', 'A', 'B']) {
        expect(
          [0, 1, 2].map((position) => sixRoundDeck.filter((round) => round.order[position] === label).length),
        ).toEqual([2, 2, 2])
      }
    }
  })

  test('executes every observation in protocol order and excludes warmups from results', async () => {
    const protocol = createProtocol({ samples: 2, seed: 7, targetCount: 2, warmups: 1 })
    const durations = {
      sample: [
        { A: 30, B: 40, control: 10 },
        { A: 50, B: 45, control: 20 },
      ],
      warmup: [{ A: 900, B: 800, control: 700 }],
    }
    const measure = vi.fn(({ label }) => ({
      durationMs: durations[current.phase][current.round][label],
      pid: measure.mock.calls.length + 100,
    }))
    let current
    const wrappedMeasure = (input) => {
      current = inputContext.shift()
      return measure(input)
    }
    const inputContext = [...protocol.warmupRounds, ...protocol.sampleRounds].flatMap(({ order, phase, round }) =>
      order.map(() => ({ phase, round })),
    )

    const observations = await executeProtocol(
      {
        artifacts: [{ resolvedUrl: 'file:///a.mjs' }, { resolvedUrl: 'file:///b.mjs' }],
        cwd: '/repo',
        protocol,
        timeoutMs: 1000,
      },
      wrappedMeasure,
    )
    const results = calculateResults(protocol, observations)

    expect(measure).toHaveBeenCalledTimes(9)
    expect(observations.map(({ label }) => label)).toEqual(
      [...protocol.warmupRounds, ...protocol.sampleRounds].flatMap(({ order }) => order),
    )
    expect(results.control.rawSamples).toEqual([10, 20])
    expect(results.targets.A.rawSamples).toEqual([30, 50])
    expect(results.targets.A.netSamples).toEqual([20, 30])
    expect(results.targets.B.rawSamples).toEqual([40, 45])
    expect(results.targets.B.netSamples).toEqual([30, 25])
    expect(results.comparison.pairedDeltaSamples).toEqual([10, -5])
    expect(results.comparison.pairedDelta.median).toBe(2.5)
  })

  test('parses configurable counts, seed, JSON output, and two targets', () => {
    expect(
      parseArguments(
        ['--warmups=0', '--samples', '5', '--seed', '123', '--timeout-ms=50', '--json', 'result.json', 'a', 'b'],
        999,
      ),
    ).toMatchObject({
      json: 'result.json',
      samples: 5,
      seed: 123,
      targets: ['a', 'b'],
      timeoutMs: 50,
      warmups: 0,
    })
  })

  test('records the loaded file graph rather than only the entry file', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bamboo-vite-import-graph-'))
    try {
      const entryPath = join(directory, 'entry.mjs')
      const dependencyPath = join(directory, 'dependency.mjs')
      writeFileSync(dependencyPath, 'export const value = 1\n')
      writeFileSync(entryPath, "import './dependency.mjs'\n")

      const result = runHarness(['--warmups', '0', '--samples', '1', '--quiet', '--json', '-', entryPath], {
        cwd: directory,
      })

      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      const report = JSON.parse(result.stdout)
      expect(report.artifacts.A.graph.files.map(({ realPath }) => realPath)).toEqual(
        [realpathSync(dependencyPath), realpathSync(entryPath)].sort(),
      )
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  test('removes a stale latest report before a failed run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'bamboo-vite-import-output-'))
    try {
      const outputPath = join(directory, 'latest.json')
      writeFileSync(outputPath, '{"stale":true}\n')

      const result = runHarness(
        ['--warmups', '0', '--samples', '1', '--quiet', '--json', outputPath, './missing-target.mjs'],
        { cwd: directory },
      )

      expect(result.status).toBe(1)
      expect(existsSync(outputPath)).toBe(false)
    } finally {
      rmSync(directory, { force: true, recursive: true })
    }
  })

  test('terminates the active import child when the harness is interrupted', { timeout: 10_000 }, async () => {
    const directory = mkdtempSync(join(tmpdir(), 'bamboo-vite-import-signal-'))
    const pidPath = join(directory, 'child.pid')
    const targetPath = join(directory, 'target.mjs')
    writeFileSync(
      targetPath,
      "import { writeFileSync } from 'node:fs'\nwriteFileSync(process.env.BAMBOO_BENCH_CHILD_PID, String(process.pid))\nsetInterval(() => {}, 1000)\n",
    )
    const harness = spawn(
      process.execPath,
      [harnessPath, '--warmups', '0', '--samples', '1', '--timeout-ms', '8000', '--quiet', '--no-json', targetPath],
      {
        cwd: directory,
        env: { ...process.env, BAMBOO_BENCH_CHILD_PID: pidPath },
        stdio: 'ignore',
      },
    )
    let childPid
    try {
      childPid = await waitForStablePid(pidPath)
      harness.kill('SIGINT')
      await new Promise((resolveClose, rejectClose) => {
        const timeout = setTimeout(() => rejectClose(new Error('Harness did not exit after SIGINT')), 3000)
        harness.once('close', () => {
          clearTimeout(timeout)
          resolveClose()
        })
      })
      await delay(100)
      expect(isProcessAlive(childPid)).toBe(false)
    } finally {
      if (harness.exitCode == null && harness.signalCode == null) harness.kill('SIGKILL')
      if (childPid && isProcessAlive(childPid)) process.kill(childPid, 'SIGKILL')
      rmSync(directory, { force: true, recursive: true })
    }
  })
})
