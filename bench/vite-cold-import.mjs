#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { cpus, release, tmpdir } from 'node:os'
import { dirname, isAbsolute, join, parse, resolve, sep } from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HARNESS_PATH = fileURLToPath(import.meta.url)
const CHILD_PATH = resolve(dirname(HARNESS_PATH), 'vite-cold-import-child.mjs')
const DEFAULT_TARGET = './packages/vite/dist/index.mjs'
const DEFAULT_WARMUPS = 3
const DEFAULT_SAMPLES = 24
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_JSON = 'bench/vite-cold-import.latest.json'
const MAX_CHILD_OUTPUT = 1024 * 1024
const UINT32_MAX = 0xffff_ffff

const HELP = `Usage:
  pnpm bench:vite-import [-- [options]] [target [target]]

Targets:
  One target measures a single built module. Two targets run a blind A/B: the
  reported seed assigns them opaque A/B labels, and each round interleaves a
  no-op control plus both imports in balanced randomized order.

  A target may be a module path, file URL, or resolvable package specifier.
  Default: ${DEFAULT_TARGET}

Options:
  --target <value>     Add a target (may be repeated twice instead of positionals)
  --warmups <count>    Warmup rounds excluded from statistics (default: ${DEFAULT_WARMUPS})
  --samples <count>    Measured rounds (default: ${DEFAULT_SAMPLES})
  --seed <uint32>      Replay a target assignment and execution order
  --timeout-ms <ms>    Timeout for each fresh child (default: ${DEFAULT_TIMEOUT_MS})
  --json <path|->      JSON destination (default: ${DEFAULT_JSON}; - for stdout)
  --no-json            Suppress JSON output
  --quiet              Suppress the human summary on stderr
  --pretty             Pretty-print JSON
  --help               Show this help

Examples:
  pnpm bench:vite-import
  pnpm bench:vite-import -- ./before.mjs ./after.mjs --samples 30
  pnpm bench:vite-import -- --target ./a.mjs --target some-package --seed 42
  pnpm bench:vite-import -- --json /tmp/vite-import.json

For clean redirected JSON through pnpm, use --json - with pnpm --silent.
`

const assertInteger = (name, value, { min, max = Number.MAX_SAFE_INTEGER }) => {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}; received ${String(value)}`)
  }
}

const parseInteger = (name, value, range) => {
  if (value == null || value === '') throw new Error(`${name} requires a value`)
  const number = Number(value)
  assertInteger(name, number, range)
  return number
}

export const parseArguments = (argv, defaultSeed = randomBytes(4).readUInt32LE()) => {
  const config = {
    help: false,
    human: true,
    json: DEFAULT_JSON,
    pretty: false,
    samples: DEFAULT_SAMPLES,
    seed: defaultSeed,
    targets: [],
    timeoutMs: DEFAULT_TIMEOUT_MS,
    warmups: DEFAULT_WARMUPS,
  }

  const takeValue = (argument, index) => {
    const equals = argument.indexOf('=')
    if (equals !== -1) return { index, value: argument.slice(equals + 1) }
    return { index: index + 1, value: argv[index + 1] }
  }

  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--') continue

    if (argument === '--help' || argument === '-h') {
      config.help = true
    } else if (argument === '--quiet') {
      config.human = false
    } else if (argument === '--pretty') {
      config.pretty = true
    } else if (argument === '--no-json') {
      config.json = null
    } else if (argument === '--target' || argument.startsWith('--target=')) {
      const result = takeValue(argument, index)
      if (!result.value) throw new Error('--target requires a value')
      config.targets.push(result.value)
      index = result.index
    } else if (argument === '--warmups' || argument.startsWith('--warmups=')) {
      const result = takeValue(argument, index)
      config.warmups = parseInteger('--warmups', result.value, { min: 0 })
      index = result.index
    } else if (argument === '--samples' || argument.startsWith('--samples=')) {
      const result = takeValue(argument, index)
      config.samples = parseInteger('--samples', result.value, { min: 1 })
      index = result.index
    } else if (argument === '--seed' || argument.startsWith('--seed=')) {
      const result = takeValue(argument, index)
      config.seed = parseInteger('--seed', result.value, { min: 0, max: UINT32_MAX })
      index = result.index
    } else if (argument === '--timeout-ms' || argument.startsWith('--timeout-ms=')) {
      const result = takeValue(argument, index)
      config.timeoutMs = parseInteger('--timeout-ms', result.value, { min: 1 })
      index = result.index
    } else if (argument === '--json' || argument.startsWith('--json=')) {
      const result = takeValue(argument, index)
      if (!result.value) throw new Error('--json requires a path or -')
      config.json = result.value
      index = result.index
    } else if (argument.startsWith('-')) {
      throw new Error(`Unknown option: ${argument}`)
    } else {
      config.targets.push(argument)
    }
  }

  if (config.targets.length === 0) config.targets.push(DEFAULT_TARGET)
  if (config.targets.length > 2) throw new Error('Pass one target, or two targets for A/B')

  return config
}

/** Mulberry32: a small, stable uint32-seeded generator suitable for scheduling. */
export const createRandom = (seed) => {
  assertInteger('seed', seed, { min: 0, max: UINT32_MAX })
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b_79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 0x1_0000_0000
  }
}

const shuffle = (values, random) => {
  const result = [...values]
  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[result[index], result[swapIndex]] = [result[swapIndex], result[index]]
  }
  return result
}

const permutations = (values) => {
  if (values.length <= 1) return [[...values]]

  return values.flatMap((value, index) =>
    permutations(values.filter((_, otherIndex) => otherIndex !== index)).map((tail) => [value, ...tail]),
  )
}

const createRounds = (phase, count, labels, random) => {
  const allOrders = permutations(labels)
  const rounds = []
  let deck = []

  for (let round = 0; round < count; round++) {
    if (deck.length === 0) deck = shuffle(allOrders, random)
    rounds.push({ order: deck.shift(), phase, round })
  }

  return rounds
}

export const createProtocol = ({ samples, seed, targetCount, warmups }) => {
  assertInteger('samples', samples, { min: 1 })
  assertInteger('warmups', warmups, { min: 0 })
  assertInteger('targetCount', targetCount, { min: 1, max: 2 })

  const random = createRandom(seed)
  const labels = ['A', 'B'].slice(0, targetCount)
  const inputIndexes = shuffle(
    Array.from({ length: targetCount }, (_, index) => index),
    random,
  )
  const assignment = Object.fromEntries(labels.map((label, index) => [label, inputIndexes[index]]))
  const roundLabels = ['control', ...labels]

  return {
    algorithm: 'mulberry32 + balanced Fisher-Yates permutation decks, v1',
    assignment,
    labels,
    sampleRounds: createRounds('sample', samples, roundLabels, random),
    seed,
    warmupRounds: createRounds('warmup', warmups, roundLabels, random),
  }
}

const findPackage = (filePath) => {
  let directory = dirname(filePath)
  const root = parse(directory).root

  while (true) {
    const packagePath = join(directory, 'package.json')
    if (existsSync(packagePath)) {
      try {
        const manifest = JSON.parse(readFileSync(packagePath, 'utf8'))
        return {
          name: typeof manifest.name === 'string' ? manifest.name : null,
          path: realpathSync(packagePath),
          version: typeof manifest.version === 'string' ? manifest.version : null,
        }
      } catch {
        // Keep walking if a nearer package.json is not readable JSON.
      }
    }

    if (directory === root) return null
    directory = dirname(directory)
  }
}

const hashFile = (filePath) => createHash('sha256').update(readFileSync(filePath)).digest('hex')

const identifyFile = (realPath) => {
  const stats = statSync(realPath, { bigint: true })
  if (!stats.isFile()) throw new Error(`Artifact is not a file: ${realPath}`)

  return {
    bytes: Number(stats.size),
    modifiedAt: new Date(Number(stats.mtimeNs) / 1e6).toISOString(),
    modifiedAtNs: stats.mtimeNs.toString(),
    realPath,
    sha256: hashFile(realPath),
  }
}

export const identifyArtifact = (requested, cwd = process.cwd()) => {
  const localPath = resolve(cwd, requested)
  const looksLikePath =
    requested.startsWith('.') || requested.startsWith('/') || isAbsolute(requested) || existsSync(localPath)

  let resolvedUrl
  try {
    resolvedUrl = looksLikePath
      ? pathToFileURL(localPath).href
      : import.meta.resolve(requested, pathToFileURL(`${cwd}${sep}`).href)
  } catch (error) {
    throw new Error(`Cannot resolve target ${JSON.stringify(requested)} from ${cwd}`, { cause: error })
  }

  const url = new URL(resolvedUrl)
  if (url.protocol !== 'file:') {
    throw new Error(`Target ${JSON.stringify(requested)} resolved to ${url.protocol}; a file is required for hashing`)
  }

  let realPath
  try {
    realPath = realpathSync(fileURLToPath(url))
  } catch (error) {
    throw new Error(`Target ${JSON.stringify(requested)} resolved to a missing file: ${fileURLToPath(url)}`, {
      cause: error,
    })
  }

  const file = identifyFile(realPath)

  return {
    ...file,
    package: findPackage(realPath),
    requested,
    resolvedUrl,
  }
}

const childFailure = (result, label, targetUrl) => {
  const details = [
    `Fresh child failed for ${label}${targetUrl ? ` (${targetUrl})` : ''}`,
    result.error ? `error: ${result.error.message}` : null,
    result.signal ? `signal: ${result.signal}` : null,
    result.status != null ? `exit: ${result.status}` : null,
    result.stderr?.trim() ? `stderr:\n${result.stderr.trim().slice(0, 4000)}` : null,
    result.stdout?.trim() ? `stdout:\n${result.stdout.trim().slice(0, 4000)}` : null,
  ].filter(Boolean)
  return new Error(details.join('\n'))
}

const killChildTree = (child, signal) => {
  if (child.pid == null) return
  if (process.platform !== 'win32') {
    try {
      process.kill(-child.pid, signal)
      return
    } catch (error) {
      if (error?.code !== 'ESRCH') throw error
    }
  }
  child.kill(signal)
}

const runFreshNodeChild = ({ arguments_, cwd, label, targetUrl, timeoutMs }) =>
  new Promise((resolveChild, rejectChild) => {
    const start = process.hrtime.bigint()
    const child = spawn(process.execPath, arguments_, {
      cwd,
      detached: process.platform !== 'win32',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let error = null
    let interruptedBy = null
    let stderr = ''
    let stdout = ''
    let timedOut = false

    const appendOutput = (stream, chunk) => {
      const next = stream === 'stdout' ? stdout + chunk : stderr + chunk
      if (next.length > MAX_CHILD_OUTPUT) {
        error ??= new Error(`Fresh child exceeded ${MAX_CHILD_OUTPUT} bytes on ${stream}`)
        killChildTree(child, 'SIGKILL')
      }
      if (stream === 'stdout') stdout = next.slice(0, MAX_CHILD_OUTPUT)
      else stderr = next.slice(0, MAX_CHILD_OUTPUT)
    }
    child.stdout.on('data', (chunk) => appendOutput('stdout', chunk))
    child.stderr.on('data', (chunk) => appendOutput('stderr', chunk))
    child.on('error', (childError) => {
      error = childError
    })

    let forceTimer
    const forwardSignal = (signal) => {
      interruptedBy = signal
      killChildTree(child, signal)
      forceTimer = setTimeout(() => killChildTree(child, 'SIGKILL'), 500)
      forceTimer.unref()
    }
    const onInterrupt = () => forwardSignal('SIGINT')
    const onTerminate = () => forwardSignal('SIGTERM')
    process.once('SIGINT', onInterrupt)
    process.once('SIGTERM', onTerminate)

    const timeout = setTimeout(() => {
      timedOut = true
      error = new Error(`Fresh child timed out after ${timeoutMs}ms`)
      killChildTree(child, 'SIGKILL')
    }, timeoutMs)
    timeout.unref()

    child.once('close', (status, signal) => {
      clearTimeout(timeout)
      clearTimeout(forceTimer)
      process.removeListener('SIGINT', onInterrupt)
      process.removeListener('SIGTERM', onTerminate)
      const result = {
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
        error,
        pid: child.pid,
        signal,
        status,
        stderr,
        stdout,
      }

      if (interruptedBy) {
        const interrupted = childFailure(result, label, targetUrl)
        interrupted.exitCode = interruptedBy === 'SIGINT' ? 130 : 143
        rejectChild(interrupted)
      } else if (timedOut || error || status !== 0) {
        rejectChild(childFailure(result, label, targetUrl))
      } else {
        resolveChild(result)
      }
    })
  })

export const measureFreshChild = async ({ cwd, label, targetUrl, timeoutMs }) => {
  const mode = label === 'control' ? 'control' : 'import'
  const arguments_ = targetUrl ? [CHILD_PATH, mode, targetUrl] : [CHILD_PATH, mode]
  const result = await runFreshNodeChild({
    arguments_,
    cwd,
    label,
    targetUrl,
    timeoutMs,
  })

  return {
    durationMs: result.durationMs,
    pid: result.pid,
  }
}

const identifyArtifactGraph = async (artifact, cwd, timeoutMs) => {
  const directory = mkdtempSync(join(tmpdir(), 'bamboo-vite-import-graph-'))
  const graphPath = join(directory, 'graph.json')
  try {
    await runFreshNodeChild({
      arguments_: [CHILD_PATH, 'graph', artifact.resolvedUrl, graphPath],
      cwd,
      label: 'artifact graph',
      targetUrl: artifact.resolvedUrl,
      timeoutMs,
    })
    const urls = JSON.parse(readFileSync(graphPath, 'utf8'))
    if (!Array.isArray(urls) || urls.some((url) => typeof url !== 'string')) {
      throw new Error(`Artifact graph child returned invalid data for ${artifact.requested}`)
    }

    const filesByPath = new Map()
    for (const resolvedUrl of urls) {
      const url = new URL(resolvedUrl)
      if (url.protocol !== 'file:') continue
      const realPath = realpathSync(fileURLToPath(url))
      filesByPath.set(realPath, identifyFile(realPath))
    }
    const files = [...filesByPath.values()].sort((left, right) => left.realPath.localeCompare(right.realPath))
    if (!filesByPath.has(artifact.realPath)) {
      throw new Error(`Artifact graph did not include its entry file: ${artifact.realPath}`)
    }
    const digest = createHash('sha256')
    for (const file of files) {
      digest.update(file.realPath)
      digest.update('\0')
      digest.update(file.modifiedAtNs)
      digest.update('\0')
      digest.update(String(file.bytes))
      digest.update('\0')
      digest.update(file.sha256)
      digest.update('\0')
    }

    return {
      bytes: files.reduce((total, file) => total + file.bytes, 0),
      files,
      sha256: digest.digest('hex'),
    }
  } finally {
    rmSync(directory, { force: true, recursive: true })
  }
}

const identifyArtifactAndGraph = async (requested, cwd, timeoutMs) => {
  const artifact = identifyArtifact(requested, cwd)
  return {
    ...artifact,
    graph: await identifyArtifactGraph(artifact, cwd, timeoutMs),
  }
}

export const executeProtocol = async ({ artifacts, cwd, protocol, timeoutMs }, measure = measureFreshChild) => {
  const rounds = [...protocol.warmupRounds, ...protocol.sampleRounds]
  const observations = []

  for (const { order, phase, round } of rounds) {
    for (let position = 0; position < order.length; position++) {
      const label = order[position]
      const artifact = label === 'control' ? null : artifacts[protocol.assignment[label]]
      const measurement = await measure({
        cwd,
        label,
        targetUrl: artifact?.resolvedUrl,
        timeoutMs,
      })

      if (!Number.isFinite(measurement.durationMs) || measurement.durationMs < 0) {
        throw new Error(`Measurement for ${label} must be a finite non-negative duration`)
      }

      observations.push({
        durationMs: measurement.durationMs,
        label,
        phase,
        pid: measurement.pid ?? null,
        position,
        round,
      })
    }
  }

  return observations
}

export const summarize = (samples) => {
  if (samples.length === 0 || samples.some((sample) => !Number.isFinite(sample))) {
    throw new Error('summarize requires one or more finite samples')
  }

  const sorted = [...samples].sort((a, b) => a - b)
  const midpoint = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[midpoint - 1] + sorted[midpoint]) / 2 : sorted[midpoint]
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1)

  return {
    count: sorted.length,
    max: sorted.at(-1),
    median,
    min: sorted[0],
    p95: sorted[p95Index],
  }
}

export const calculateResults = (protocol, observations) => {
  const samples = observations.filter((observation) => observation.phase === 'sample')
  const perRound = new Map()

  for (const observation of samples) {
    const round = perRound.get(observation.round) ?? new Map()
    if (round.has(observation.label)) {
      throw new Error(`Duplicate ${observation.label} observation in sample round ${observation.round}`)
    }
    round.set(observation.label, observation.durationMs)
    perRound.set(observation.round, round)
  }

  const controlSamples = []
  const rawByLabel = Object.fromEntries(protocol.labels.map((label) => [label, []]))
  const netByLabel = Object.fromEntries(protocol.labels.map((label) => [label, []]))

  for (const { round } of protocol.sampleRounds) {
    const values = perRound.get(round)
    const control = values?.get('control')
    if (control == null) throw new Error(`Missing control observation in sample round ${round}`)
    controlSamples.push(control)

    for (const label of protocol.labels) {
      const raw = values.get(label)
      if (raw == null) throw new Error(`Missing ${label} observation in sample round ${round}`)
      rawByLabel[label].push(raw)
      netByLabel[label].push(raw - control)
    }
  }

  const targets = Object.fromEntries(
    protocol.labels.map((label) => [
      label,
      {
        net: summarize(netByLabel[label]),
        netSamples: netByLabel[label],
        raw: summarize(rawByLabel[label]),
        rawSamples: rawByLabel[label],
      },
    ]),
  )

  let comparison = null
  if (protocol.labels.length === 2) {
    const [a, b] = protocol.labels
    const pairedDeltaSamples = rawByLabel[b].map((value, index) => value - rawByLabel[a][index])
    const pairedDelta = summarize(pairedDeltaSamples)
    comparison = {
      direction: `${b} - ${a}; negative means ${b} was faster`,
      pairedDelta,
      pairedDeltaPercentOfARawMedian: (pairedDelta.median / targets[a].raw.median) * 100,
      pairedDeltaSamples,
    }
  }

  return {
    comparison,
    control: {
      raw: summarize(controlSamples),
      rawSamples: controlSamples,
    },
    targets,
  }
}

const runGit = (cwd, arguments_) => {
  const result = spawnSync('git', arguments_, { cwd, encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trimEnd() : null
}

const getGitState = (cwd) => {
  const root = runGit(cwd, ['rev-parse', '--show-toplevel'])
  if (root == null) return { available: false }

  const commit = runGit(root, ['rev-parse', 'HEAD'])
  const status = runGit(root, ['status', '--porcelain=v1', '--untracked-files=all'])
  return {
    available: true,
    commit,
    dirty: status == null ? null : status.length > 0,
    root,
    status: status == null || status === '' ? [] : status.split('\n'),
  }
}

const sameGitState = (left, right) => JSON.stringify(left) === JSON.stringify(right)

const sameFile = (left, right) =>
  left.resolvedUrl === right.resolvedUrl &&
  left.realPath === right.realPath &&
  left.bytes === right.bytes &&
  left.modifiedAtNs === right.modifiedAtNs &&
  left.sha256 === right.sha256

const sameArtifact = (left, right) => sameFile(left, right) && left.graph.sha256 === right.graph.sha256

const environment = (cwd, gitStart, gitEnd) => {
  const cpu = cpus()[0]
  return {
    arch: process.arch,
    cpu: cpu
      ? {
          logicalCount: cpus().length,
          model: cpu.model,
        }
      : null,
    cwd,
    git: {
      changedDuringRun: !sameGitState(gitStart, gitEnd),
      end: gitEnd,
      start: gitStart,
    },
    node: {
      execArgv: process.execArgv,
      executable: process.execPath,
      nodeOptions: process.env.NODE_OPTIONS ?? null,
      version: process.version,
    },
    osRelease: release(),
    platform: process.platform,
  }
}

const buildHumanOutput = (report) => {
  const git = report.environment.git.start
  const gitDescription = git.available
    ? `${git.commit?.slice(0, 12) ?? 'unknown'} ${git.dirty ? 'dirty' : 'clean'}`
    : 'not a git worktree'
  const format = (stats) =>
    `median ${stats.median.toFixed(2)}, p95 ${stats.p95.toFixed(2)}, min ${stats.min.toFixed(2)}, max ${stats.max.toFixed(2)}`

  const lines = [
    `@bamboocss/vite cold import — Node ${report.environment.node.version}, ${report.environment.platform}/${report.environment.arch} ${report.environment.osRelease}, git ${gitDescription}`,
    `${report.configuration.samples} samples + ${report.configuration.warmups} warmups, seed ${report.protocol.seed}, fresh child per observation`,
  ]

  for (const label of report.protocol.labels) {
    const artifact = report.artifacts[label]
    lines.push(`${label}: ${artifact.requested} -> ${artifact.realPath}`)
    lines.push(`   sha256 ${artifact.sha256}, ${artifact.bytes} bytes`)
    lines.push(`   graph ${artifact.graph.sha256}, ${artifact.graph.files.length} files, ${artifact.graph.bytes} bytes`)
  }

  lines.push(`control raw ms: ${format(report.results.control.raw)}`)
  for (const label of report.protocol.labels) {
    const result = report.results.targets[label]
    lines.push(`${label} raw ms: ${format(result.raw)}`)
    lines.push(`${label} net ms: ${format(result.net)}`)
  }

  if (report.results.comparison) {
    lines.push(
      `paired B-A ms: ${format(report.results.comparison.pairedDelta)} (${report.results.comparison.pairedDeltaPercentOfARawMedian.toFixed(2)}% of A raw median)`,
    )
  }

  if (!report.validity.artifactsStable) lines.push('INVALID: an artifact graph differed between run endpoints')
  if (!report.validity.harnessStable) lines.push('INVALID: the benchmark harness differed between run endpoints')
  if (report.environment.git.changedDuringRun) lines.push('note: git state changed during the run')
  return lines.join('\n')
}

const writeReport = (report, config, outputPath) => {
  if (config.human) process.stderr.write(`${buildHumanOutput(report)}\n`)
  if (config.json == null) return

  const json = `${JSON.stringify(report, null, config.pretty ? 2 : 0)}\n`
  if (config.json === '-') {
    process.stdout.write(json)
  } else {
    const temporaryPath = `${outputPath}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`
    try {
      writeFileSync(temporaryPath, json, { flag: 'wx' })
      renameSync(temporaryPath, outputPath)
    } finally {
      rmSync(temporaryPath, { force: true })
    }
    if (config.human) process.stderr.write(`JSON: ${outputPath}\n`)
  }
}

const prepareReportOutput = (config) => {
  if (config.json == null || config.json === '-') return null
  const outputPath = resolve(process.cwd(), config.json)
  rmSync(outputPath, { force: true })
  return outputPath
}

export const run = async (config) => {
  const cwd = process.cwd()
  const gitStart = getGitState(cwd)
  const artifactsAtStart = await Promise.all(
    config.targets.map((target) => identifyArtifactAndGraph(target, cwd, config.timeoutMs)),
  )
  const harnessAtStart = {
    child: identifyArtifact(CHILD_PATH, cwd),
    entry: identifyArtifact(HARNESS_PATH, cwd),
  }
  const protocol = createProtocol({
    samples: config.samples,
    seed: config.seed,
    targetCount: artifactsAtStart.length,
    warmups: config.warmups,
  })
  const observations = await executeProtocol({
    artifacts: artifactsAtStart,
    cwd,
    protocol,
    timeoutMs: config.timeoutMs,
  })
  const artifactsAtEnd = await Promise.all(
    config.targets.map((target) => identifyArtifactAndGraph(target, cwd, config.timeoutMs)),
  )
  const harnessAtEnd = {
    child: identifyArtifact(CHILD_PATH, cwd),
    entry: identifyArtifact(HARNESS_PATH, cwd),
  }
  const gitEnd = getGitState(cwd)
  const artifactsStable = artifactsAtStart.every((artifact, index) => sameArtifact(artifact, artifactsAtEnd[index]))
  const harnessStable =
    sameFile(harnessAtStart.child, harnessAtEnd.child) && sameFile(harnessAtStart.entry, harnessAtEnd.entry)
  const artifacts = Object.fromEntries(
    protocol.labels.map((label) => [label, artifactsAtStart[protocol.assignment[label]]]),
  )

  return {
    artifacts,
    configuration: {
      childCommand: [process.execPath, CHILD_PATH, '<control|import>', '<resolved-target-url>'],
      clock: 'parent process.hrtime.bigint around one child process',
      invocation: [process.execPath, HARNESS_PATH, ...process.argv.slice(2)],
      processIsolation: 'one new child process per control, warmup, and measured import',
      samples: config.samples,
      statistics: {
        net: 'target raw duration minus the control raw duration from the same round',
        p95: 'nearest rank: sorted[ceil(0.95 * count) - 1]',
        pairedComparison: 'B raw duration minus A raw duration from the same round',
      },
      timeoutMs: config.timeoutMs,
      unit: 'milliseconds',
      warmups: config.warmups,
    },
    createdAt: new Date().toISOString(),
    environment: environment(cwd, gitStart, gitEnd),
    harness: harnessAtStart,
    name: '@bamboocss/vite cold import',
    observations,
    protocol,
    results: calculateResults(protocol, observations),
    schemaVersion: 1,
    validity: {
      artifactsAtEnd: artifactsStable ? null : artifactsAtEnd,
      artifactsStable,
      harnessAtEnd: harnessStable ? null : harnessAtEnd,
      harnessStable,
    },
  }
}

const main = async () => {
  const config = parseArguments(process.argv.slice(2))
  if (config.help) {
    process.stdout.write(HELP)
    return
  }

  const outputPath = prepareReportOutput(config)
  const report = await run(config)
  writeReport(report, config, outputPath)
  if (!report.validity.artifactsStable || !report.validity.harnessStable) process.exitCode = 2
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(HARNESS_PATH)) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = Number.isInteger(error?.exitCode) ? error.exitCode : 1
  })
}
