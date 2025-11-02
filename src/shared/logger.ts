/**
 * Logger
 *
 * Centralized logging system with log levels and formatting.
 * Provides a consistent way to log messages throughout the application.
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static currentLevel: LogLevel = LogLevel.INFO;
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  /**
   * Set the global log level
   */
  static setLogLevel(level: LogLevel): void {
    Logger.currentLevel = level;
  }

  /**
   * Get the current log level
   */
  static getLogLevel(): LogLevel {
    return Logger.currentLevel;
  }

  /**
   * Format timestamp for logs
   */
  private getTimestamp(): string {
    const now = new Date();
    return now.toISOString().split('T')[1].split('.')[0];
  }

  /**
   * Format log message with context and timestamp
   */
  private format(level: string, message: string, ...args: unknown[]): [string, ...unknown[]] {
    const timestamp = this.getTimestamp();
    const prefix = `[${timestamp}] [${level}] [${this.context}]`;
    return [prefix + ' ' + message, ...args];
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (Logger.currentLevel <= LogLevel.DEBUG) {
      console.debug(...this.format('DEBUG', message, ...args));
    }
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    if (Logger.currentLevel <= LogLevel.INFO) {
      console.log(...this.format('INFO', message, ...args));
    }
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    if (Logger.currentLevel <= LogLevel.WARN) {
      console.warn(...this.format('WARN', message, ...args));
    }
  }

  /**
   * Log error message
   */
  error(message: string, ...args: unknown[]): void {
    if (Logger.currentLevel <= LogLevel.ERROR) {
      console.error(...this.format('ERROR', message, ...args));
    }
  }

  /**
   * Log error with stack trace
   */
  exception(message: string, error: Error): void {
    if (Logger.currentLevel <= LogLevel.ERROR) {
      console.error(...this.format('ERROR', message));
      console.error(error);
    }
  }
}

/**
 * Create a logger instance for a specific context
 */
export function createLogger(context: string): Logger {
  return new Logger(context);
}
