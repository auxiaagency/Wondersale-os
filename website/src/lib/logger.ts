type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  message: string;
  context?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
  };
}

class Logger {
  private formatLog(level: LogLevel, payload: LogPayload) {
    const timestamp = new Date().toISOString();
    return JSON.stringify({
      timestamp,
      level,
      message: payload.message,
      ...(payload.context && { context: payload.context }),
      ...(payload.error && {
        error: {
          name: payload.error.name,
          message: payload.error.message,
          ...(process.env.NODE_ENV !== "production" && { stack: payload.error.stack }),
        },
      }),
    });
  }

  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== "production") {
      console.debug(this.formatLog("debug", { message, context }));
    }
  }

  info(message: string, context?: Record<string, unknown>) {
    console.info(this.formatLog("info", { message, context }));
  }

  warn(message: string, context?: Record<string, unknown>) {
    console.warn(this.formatLog("warn", { message, context }));
  }

  error(message: string, error?: unknown, context?: Record<string, unknown>) {
    let errObj: { name?: string; message?: string; stack?: string } | undefined;
    if (error instanceof Error) {
      errObj = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (typeof error === "string") {
      errObj = { message: error };
    }

    console.error(this.formatLog("error", { message, error: errObj, context }));
  }
}

export const logger = new Logger();
