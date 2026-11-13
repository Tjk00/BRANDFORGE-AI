/**
 * Structured logging shared by every host: the Node server, Cloudflare Pages
 * Functions and the standalone Worker.
 *
 * One JSON line per event keeps logs greppable and shippable without adding a
 * logging dependency, and credential-looking fields are redacted so an API key
 * or session cookie can never reach the log stream.
 */

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogFields {
  [key: string]: unknown;
}

const SECRET_FIELD = /(api[_-]?key|authorization|cookie|password|secret|token|hash)/i;

function redact(fields: LogFields): LogFields {
  const safe: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_FIELD.test(key)) {
      safe[key] = value ? '[redacted]' : value;
      continue;
    }
    if (value instanceof Error) {
      safe[key] = value.message;
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

export function logEvent(level: LogLevel, message: string, fields: LogFields = {}): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...redact(fields),
  });
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}
