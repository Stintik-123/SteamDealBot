import {
  getSteamDeals,
  enrichDealsWithCurrencies,
  getDealsForAppids
} from './steam.mjs';
import { generateText } from './gemini.mjs';
import { publishPost } from './publisher.mjs';
import {
  getRandomMeme,
  loadMemory,
  saveMemory,
  isGameBlocked,
  addToMemory,
  loadJson,
  ensureDataDir
} from './utils.mjs';

const settings = loadJson('config/settings.json', {});
const watchlistConfig = loadJson('config/watchlist.json', { tracked_appids: [] });
const popularConfig = loadJson('config/popular.json', { appids: [] });

const currencyCcs = settings.currency_ccs || ['ru', 'kz', 'ua', 'us'];
const weeklyDay = Number(settings.weekly_day ?? 1); // 1 = Monday

function uniqueByAppid(deals) {
  const map = new Map();
  for (const d of deals) {
    const id = Number(d.appid);
    if (!map.has(id) || map.get(id).discount < d.discount) map.set(id, d);
  }
  return [...map.values()];
}

async function main() {
  console.log('Bot started...');
  ensureDataDir();

  const now = new Date();
  const dayOfWeek = now.getDay();
  const isWeeklyDay = dayOfWeek === weeklyDay;

  const memory = loadMemory();
  const popularSet = new Set((popularConfig.appids || []).map(Number));
  const trackedIds = (watchlistConfig.tracked_appids || []).map(Number);

  let dealsToProcess = [];
  let postType = '';

  // 1) Данные с витрины
  let specials = [];
  try {
    specials = await getSteamDeals(settings.region_cc || 'ru');
    console.log(`Specials loaded: ${specials.length}`);
  } catch (e) {
    console.error('Steam specials failed:', e.message);
  }

  if (isWeeklyDay) {
    postType = 'weekly';
    let pool = specials.filter(
      (d) => d.discount >= (settings.min_discount_weekly ?? 20)
    );

    // Если popular задан — режем по нему; иначе берём specials как есть
    if (popularSet.size > 0) {
      const fromSpecials = pool.filter((d) => popularSet.has(Number(d.appid)));
      // Добираем цены по popular, которых нет в specials
      const missing = [...popularSet].filter(
        (id) => !fromSpecials.some((d) => Number(d.appid) === id)
      );
      let extra = [];
      if (missing.length) {
        extra = await getDealsForAppids(
          missing.slice(0, 40),
          currencyCcs,
          settings.min_discount_weekly ?? 20
        );
      }
      pool = uniqueByAppid([...fromSpecials, ...extra]);
    }

    pool = pool.filter(
      (d) =>
        !isGameBlocked(
          memory,
          d.appid,
          d.discount,
          settings.memory_ttl_days ?? 30
        )
    );
    pool.sort((a, b) => b.discount - a.discount);
    dealsToProcess = pool.slice(0, settings.weekly_digest_limit ?? 15);
  } else {
    // 2) Алерты по watchlist
    const alertMin = settings.min_discount_alert ?? 20;
    let alerts = await getDealsForAppids(trackedIds, currencyCcs, alertMin);
    alerts = alerts.filter(
      (d) =>
        !isGameBlocked(
          memory,
          d.appid,
          d.discount,
          settings.memory_ttl_days ?? 30
        )
    );

    // 3) Hot: крупная скидка на popular вне watchlist
    const hotMin = settings.min_discount_hot ?? 70;
    let hot = specials.filter(
      (d) =>
        d.discount >= hotMin &&
        (popularSet.size === 0 || popularSet.has(Number(d.appid))) &&
        !trackedIds.includes(Number(d.appid)) &&
        !isGameBlocked(
          memory,
          d.appid,
          d.discount,
          settings.memory_ttl_days ?? 30
        )
    );

    if (alerts.length) {
      dealsToProcess = alerts;
      postType = 'alert';
    } else if (hot.length) {
      hot.sort((a, b) => b.discount - a.discount);
      dealsToProcess = hot.slice(0, 8);
      postType = 'hot';
    }
  }

  if (!dealsToProcess.length) {
    console.log('No new deals to post. Exiting.');
    return;
  }

  // Мультивалюта (если ещё не обогащены)
  const needEnrich = dealsToProcess.some((d) => !d.prices);
  if (needEnrich) {
    console.log('Enriching with multi-currency prices...');
    dealsToProcess = await enrichDealsWithCurrencies(dealsToProcess, currencyCcs);
  }

  // Ещё раз отфильтровать после уточнения discount
  dealsToProcess = dealsToProcess.filter((d) => d.discount > 0);
  if (!dealsToProcess.length) {
    console.log('No deals after enrich. Exiting.');
    return;
  }

  console.log(`Found ${dealsToProcess.length} deals for ${postType} post.`);

  const content = await generateText(dealsToProcess, postType);
  const memePath = getRandomMeme();

  const success = await publishPost(
    settings.subreddit,
    content.title,
    content.body,
    memePath,
    {
      flair_id: settings.flair_id || undefined,
      flair_text: settings.flair_text || undefined
    }
  );

  if (success) {
    let updated = [...memory];
    for (const deal of dealsToProcess) {
      updated = addToMemory(updated, deal);
    }
    saveMemory(updated);
    console.log('Memory saved.');
  } else {
    console.error('Publication failed — memory not updated.');
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
