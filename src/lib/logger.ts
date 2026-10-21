import RequestContext from "./request-context";

type LogMeta = Record<string, unknown>;

function write(level: string, payload: LogMeta) {
  const correlationId = RequestContext.correlationId();
  const line = JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...(correlationId ? { correlationId } : {}),
    ...payload,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

class Logger {
  public static info(message: string, meta: LogMeta = {}): void {
    write("info", { message, ...meta });
  }

  public static warn(message: string, meta: LogMeta = {}): void {
    write("warn", { message, ...meta });
  }

  public static error(error: Error, meta: LogMeta = {}): void {
    write("error", { message: error.message, stack: error.stack, ...meta });
  }
}

export default Logger;
