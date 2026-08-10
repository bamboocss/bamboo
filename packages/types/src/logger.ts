export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

export interface LogEntry {
  level: LogLevel | null
  msg: string
  [key: string]: any
}

export interface LoggerInterface {
  level: 'debug' | 'info' | 'warn' | 'error' | 'silent'
  /**
   * Comma-separated globs over the namespaced log type. Non-empty shows only matching types,
   * at debug level, whatever `level` is set to.
   */
  filter: string
  print(data: any): void
  onLog?: (entry: LogEntry) => void
  warn: (type: string, data: any) => void
  info: (type: string, data: any) => void
  debug: (type: string, data: any) => void
  error: (type: string, data: any) => void
  /**
   * Log a caught error with context. Extracts the message for the error level,
   * and logs the full stack at debug level.
   */
  caughtError: (type: string, context: string, error: unknown) => void
  log: (data: string) => void
  time: {
    info: (msg: string) => (_msg?: string) => void
    debug: (msg: string) => (_msg?: string) => void
  }
  isDebug: boolean
}
