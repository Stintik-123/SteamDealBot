import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const MEMORY_PATH = path.join(ROOT, 'data', 'memory.json');
const MEMES_DIR = path.join(ROOT, 'assets', 'memes');

export function ensureDataDir() {
  const dir = path.dirname(MEMORY_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export function getRandomMeme() {
  if (!fs.existsSync(MEMES_DIR)) return null;
  const files = fs.readdirSync(MEMES_DIR).filter((f) => /\.(jpg|jpeg|png|gif|webp)$/i.test(f));
  if (files.length === 0) return null;
  const randomFile = files[Math.floor(Math.random() * files.length)];
  return path.join(MEMES_DIR, randomFile);
}

export function loadMemory() {
  ensureDataDir();
  try {
    if (!fs.existsSync(MEMORY_PATH)) return [];
    const raw = fs.readFileSync(MEMORY_PATH, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('Memory load error', e.message);
    return [];
  }
}

export function saveMemory(memoryArray) {
  ensureDataDir();
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memoryArray, null, 2));
}

export function isGameBlocked(memory, appId, currentDiscount, ttlDays) {
  const entry = memory.find((m) => Number(m.appid) === Number(appId));
  if (!entry) return false;

  const daysSincePost =
    (Date.now() - new Date(entry.last_posted_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePost > ttlDays) return false;

  // Та же скидка ±10% — не постить снова
  if (Math.abs(Number(currentDiscount) - Number(entry.discount_percent)) < 10) {
    return true;
  }
  return false;
}

export function addToMemory(memory, deal) {
  const next = memory.filter((m) => Number(m.appid) !== Number(deal.appid));
  next.push({
    appid: Number(deal.appid),
    name: deal.name,
    discount_percent: Number(deal.discount),
    last_posted_at: new Date().toISOString()
  });

  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return next.filter((m) => new Date(m.last_posted_at).getTime() > cutoff);
}

export function loadJson(relativePath, fallback) {
  const full = path.join(ROOT, relativePath);
  try {
    return JSON.parse(fs.readFileSync(full, 'utf8'));
  } catch {
    return fallback;
  }
}
