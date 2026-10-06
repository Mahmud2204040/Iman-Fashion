import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class L5DiskCache {
  private cacheDir: string;
  private enabled: boolean;
  
  constructor() {
    this.cacheDir = path.join(process.cwd(), '.cache', 'l5');
    this.enabled = process.env.API_DISK_CACHE_ENABLED === 'true';
    if (this.enabled) {
      // Ensure directory exists asynchronously (fire and forget)
      fs.mkdir(this.cacheDir, { recursive: true }).catch(() => {});
    }
  }

  private getFilePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex');
    return path.join(this.cacheDir, `${hash}.json`);
  }

  async get(key: string): Promise<any | undefined> {
    if (!this.enabled) return undefined;
    
    const filePath = this.getFilePath(key);
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);
      
      if (Date.now() > parsed.expiresAt) {
        // Expired
        this.delete(key).catch(() => {});
        return undefined;
      }
      
      return parsed;
    } catch {
      // Missing, unparseable, or permission error -> treat as cache miss
      return undefined;
    }
  }

  async set(key: string, data: any): Promise<void> {
    if (!this.enabled) return;
    
    // Safety check on disk space is complex in Node natively without shell outs.
    // For this milestone, we use atomic temp file swap to prevent corruption.
    const filePath = this.getFilePath(key);
    const tempPath = `${filePath}.${Date.now()}.tmp`;
    
    try {
      await fs.writeFile(tempPath, JSON.stringify(data), 'utf-8');
      await fs.rename(tempPath, filePath);
    } catch {
      // Fallback clean up if rename fails
      try {
        await fs.unlink(tempPath);
      } catch {}
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.enabled) return;
    try {
      await fs.unlink(this.getFilePath(key));
    } catch {}
  }
}

export const l5Cache = new L5DiskCache();
