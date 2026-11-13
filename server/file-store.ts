/**
 * Node key/value driver: a small JSON document on disk.
 *
 * The same Repository runs on Cloudflare D1; this driver only supplies durable
 * storage for the self-hosted Node server. The file is written atomically so a
 * crash cannot leave a half-written store behind.
 */

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { KvDriver } from '../shared/store';

export class FileKv implements KvDriver {
  private data: Record<string, string>;

  constructor(private readonly file: string) {
    mkdirSync(path.dirname(file), { recursive: true });
    this.data = this.read();
  }

  private read(): Record<string, string> {
    if (!existsSync(this.file)) return {};
    try {
      const parsed = JSON.parse(readFileSync(this.file, 'utf8')) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
    } catch {
      // A corrupt file must not take the server down; keep a copy for inspection.
      try {
        renameSync(this.file, `${this.file}.corrupt-${Date.now()}`);
      } catch {
        /* ignore */
      }
      return {};
    }
  }

  private flush(): void {
    const temp = `${this.file}.tmp`;
    writeFileSync(temp, JSON.stringify(this.data), 'utf8');
    renameSync(temp, this.file);
  }

  async get(key: string): Promise<string | null> {
    return Object.prototype.hasOwnProperty.call(this.data, key) ? this.data[key] : null;
  }

  async set(key: string, value: string): Promise<void> {
    this.data[key] = value;
    this.flush();
  }

  async del(key: string): Promise<void> {
    delete this.data[key];
    this.flush();
  }

  async list(prefix: string): Promise<{ key: string; value: string }[]> {
    return Object.keys(this.data)
      .filter((key) => key.startsWith(prefix))
      .map((key) => ({ key, value: this.data[key] }));
  }
}
