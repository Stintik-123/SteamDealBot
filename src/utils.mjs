import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- MEMES LOGIC ---
export function getRandomMeme() {
  const memesDir = path.join(__dirname, '../assets/memes');
  
  // Если папки нет или она пустая - возвращаем null (бот постит без картинки или падает, решим позже)
  if (!fs.existsSync(memesDir)) return null;

  const files = fs.readdirSync(memesDir).filter(f => /\.(jpg|jpeg|png)$/i.test(f));
  if (files.length === 0) return null;

  const randomFile = files[Math.floor(Math.random() * files.length)];
  const fullPath = path.join(memesDir, randomFile);
  
  // Возвращаем абсолютный путь к файлу для чтения буфера
  return fullPath;
}

// --- MEMORY LOGIC ---
const MEMORY_PATH = path.join(__dirname, '../data/memory.json');

export function loadMemory() {
  try {
    if (!fs.existsSync(MEMORY_PATH)) return [];
    return JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf8'));
  } catch (e) {
    console.error('Memory load error', e);
    return [];
  }
}

export function saveMemory(memoryArray) {
  fs.writeFileSync(MEMORY_PATH, JSON.stringify(memoryArray, null, 2));
}

export function isGameBlocked(memory, appId, currentDiscount, ttlDays) {
  const entry = memory.find(m => m.appid === appId);
  if (!entry) return false;

  // Проверяем срок давности записи
  const daysSincePost = (Date.now() - new Date(entry.last_posted_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSincePost > ttlDays) return false; // Старая запись, можно постить снова

  // Проверяем, изменилась ли скидка существенно (>10%)
  if (Math.abs(currentDiscount - entry.discount_percent) < 10) {
    return true; // Скидка та же или почти та же, блокируем
  }

  return false; // Скидка сильно выросла, разрешаем пост
}

export function addToMemory(memory, deal) {
  memory.push({
    appid: deal.appid,
    name: deal.name,
    discount_percent: deal.discount,
    last_posted_at: new Date().toISOString()
  });
  // Удаляем старые записи старше TTL, чтобы файл не рос бесконечно
  const cutoff = Date.now() - (30 * 24 * 60 * 60 * 1000); // Жестко 30 дней очистки
  return memory.filter(m => new Date(m.last_posted_at).getTime() > cutoff);
}
