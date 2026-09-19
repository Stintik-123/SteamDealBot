import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getSteamDeals } from './steam.mjs';
import { generateText } from './gemini.mjs';
import { publishPost } from './publisher.mjs';
import { getRandomMeme, loadMemory, saveMemory, isGameBlocked, addToMemory } from './utils.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settings = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/settings.json'), 'utf8'));
const watchlistConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '../config/watchlist.json'), 'utf8'));

async function main() {
  console.log('Bot started...');
  
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...
  const isWeeklyDay = dayOfWeek === 1; // Понедельник

  // 1. Get Data
  let allDeals = [];
  try {
    allDeals = await getSteamDeals(settings.region_cc);
  } catch (e) {
    console.error(e);
    return;
  }

  const memory = loadMemory();
  let dealsToProcess = [];
  let postType = '';

  if (isWeeklyDay) {
    // WEEKLY DIGEST
    // Filter out blocked games
    const freshDeals = allDeals.filter(d => !isGameBlocked(memory, d.appid, d.discount, settings.memory_ttl_days));
    // Sort by discount desc and take top N
    freshDeals.sort((a, b) => b.discount - a.discount);
    dealsToProcess = freshDeals.slice(0, settings.weekly_digest_limit);
    postType = 'weekly';
  } else {
    // ALERTS
    const trackedIds = new Set(watchlistConfig.tracked_appids.map(Number));
    const alertCandidates = allDeals.filter(d => 
      trackedIds.has(d.appid) && 
      d.discount >= settings.min_discount_alert &&
      !isGameBlocked(memory, d.appid, d.discount, settings.memory_ttl_days)
    );
    
    if (alertCandidates.length > 0) {
      dealsToProcess = alertCandidates;
      postType = 'alert';
    }
  }

  if (dealsToProcess.length === 0) {
    console.log('No new deals to post. Exiting.');
    return;
  }

  console.log(`Found ${dealsToProcess.length} deals for ${postType} post.`);

  // 2. Generate Text
  const content = await generateText(dealsToProcess, postType);
  
  // 3. Pick Meme
  const memePath = getRandomMeme();
  
  // 4. Publish
  const success = await publishPost(
    settings.subreddit,
    content.title,
    content.body,
    memePath
  );

  if (success) {
    // 5. Update Memory
    let updatedMemory = [...memory];
    for (const deal of dealsToProcess) {
      updatedMemory = addToMemory(updatedMemory, deal);
    }
    saveMemory(updatedMemory);
    console.log('Memory saved.');
  } else {
    console.error('Publication failed.');
  }
}

main().catch(console.error);
