import axios from 'axios';

const UA = 'SteamDealBot/1.1 (github.com/Stintik-123/SteamDealBot)';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function storeUrl(appid) {
  return `https://store.steampowered.com/app/${appid}/`;
}

/** Витрина скидок Steam (specials). */
export async function getSteamDeals(cc = 'ru') {
  const url = `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`;
  const res = await axios.get(url, {
    headers: { 'User-Agent': UA },
    timeout: 30000
  });

  const items = res.data?.specials?.items || [];
  return items
    .map((item) => ({
      appid: Number(item.id ?? item.appid),
      name: item.name,
      discount: Number(item.discount_percent || 0),
      final_price: item.final_formatted || null,
      initial_price: item.initial_formatted || null,
      url: storeUrl(item.id ?? item.appid),
      header_image: item.header_image || null,
      end_date: item.discount_expiration
        ? new Date(item.discount_expiration * 1000)
        : null
    }))
    .filter((i) => i.appid && i.discount > 0);
}

/** Цены одной игры по нескольким cc (ru/kz/ua/us). */
export async function getAppPrices(appid, ccs = ['ru', 'kz', 'ua', 'us']) {
  const prices = {};
  let meta = null;

  for (const cc of ccs) {
    try {
      const url = `https://store.steampowered.com/api/appdetails?appids=${appid}&cc=${cc}&filters=price_overview`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': UA },
        timeout: 20000
      });
      const entry = res.data?.[String(appid)];
      if (!entry?.success) continue;

      const data = entry.data || {};
      if (!meta) {
        meta = {
          name: data.name,
          url: storeUrl(appid),
          header_image: data.header_image || null
        };
      }

      const po = data.price_overview;
      if (po) {
        prices[cc] = {
          currency: po.currency,
          final_formatted: po.final_formatted,
          initial_formatted: po.initial_formatted,
          discount: Number(po.discount_percent || 0)
        };
      }
    } catch (e) {
      console.warn(`price ${appid} cc=${cc}:`, e.message);
    }
    await sleep(250);
  }

  return { meta, prices };
}

/** Обогатить сделки ценами по регионам. */
export async function enrichDealsWithCurrencies(deals, ccs) {
  const out = [];
  for (const deal of deals) {
    const { meta, prices } = await getAppPrices(deal.appid, ccs);
    const discount =
      prices.ru?.discount ||
      prices.us?.discount ||
      deal.discount ||
      0;

    out.push({
      ...deal,
      name: meta?.name || deal.name,
      url: storeUrl(deal.appid),
      discount,
      final_price: prices.ru?.final_formatted || deal.final_price,
      initial_price: prices.ru?.initial_formatted || deal.initial_price,
      prices
    });
  }
  return out;
}

/** Скидки по списку appid (для watchlist / popular). */
export async function getDealsForAppids(appids, ccs, minDiscount = 20) {
  const deals = [];
  for (const appid of appids) {
    const { meta, prices } = await getAppPrices(appid, ccs);
    const discount =
      prices.ru?.discount ||
      prices.us?.discount ||
      0;
    if (discount < minDiscount) continue;
    if (!meta?.name && !prices.ru && !prices.us) continue;

    deals.push({
      appid: Number(appid),
      name: meta?.name || `App ${appid}`,
      discount,
      final_price: prices.ru?.final_formatted || prices.us?.final_formatted || null,
      initial_price: prices.ru?.initial_formatted || null,
      url: storeUrl(appid),
      header_image: meta?.header_image || null,
      end_date: null,
      prices
    });
    await sleep(200);
  }
  return deals;
}

export function formatPriceLine(deal) {
  const p = deal.prices || {};
  const parts = [];
  if (p.ru?.final_formatted) parts.push(p.ru.final_formatted);
  if (p.kz?.final_formatted) parts.push(p.kz.final_formatted);
  if (p.ua?.final_formatted) parts.push(p.ua.final_formatted);
  if (p.us?.final_formatted) parts.push(p.us.final_formatted);
  const priceStr = parts.length ? parts.join(' / ') : deal.final_price || '?';
  return `[${deal.name}](${deal.url}) — ${priceStr} (−${deal.discount}%)`;
}
