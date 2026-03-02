/**
 * KV adapter — usa Upstash Redis en producción,
 * cae a archivos JSON locales en desarrollo.
 *
 * Activación: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
 * (se inyectan automáticamente al conectar Upstash Redis en Vercel Integrations)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { Redis } from '@upstash/redis';

let _redis: Redis | null | undefined;

function getRedis(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

export function usingKv(): boolean {
  return getRedis() !== null;
}

/** "kiwy:agents" → "data/agents.json" (fallback local) */
function localPath(key: string): string {
  const name = key.replace(/^kiwy:/, '').replace(/:/g, '-');
  return path.join(process.cwd(), 'data', `${name}.json`);
}

/** True si estamos en el serverless de Vercel */
function onVercel(): boolean {
  return process.env.VERCEL === '1';
}

async function localRead<T>(key: string): Promise<T | null> {
  if (onVercel()) {
    // En Vercel sin KV configurado — devolvemos null (datos vacíos) en lugar de crashear
    console.warn(`[kv] KV no configurado. Configura Upstash Redis en Vercel para persistencia. key=${key}`);
    return null;
  }
  try {
    const raw = await fs.readFile(localPath(key), 'utf8');
    return JSON.parse(raw) as T;
  } catch (err: any) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
}

async function localWrite<T>(key: string, value: T): Promise<void> {
  if (onVercel()) {
    // En Vercel sin KV configurado — avisamos pero no crasheamos
    console.warn(`[kv] Escritura ignorada (sin KV). Configura Upstash Redis en Vercel. key=${key}`);
    return;
  }
  const fp = localPath(key);
  await fs.mkdir(path.dirname(fp), { recursive: true });
  const tmp = `${fp}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2) + '\n', { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, fp);
}

export async function kvRead<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return localRead<T>(key);
  return redis.get<T>(key);
}

export async function kvWrite<T>(key: string, value: T): Promise<void> {
  const redis = getRedis();
  if (!redis) return localWrite<T>(key, value);
  await redis.set(key, value);
}
