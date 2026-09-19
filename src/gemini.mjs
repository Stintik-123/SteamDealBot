import { GoogleGenerativeAI } from '@google/generative-ai';
import { formatPriceLine } from './steam.mjs';

function buildFallback(deals, type) {
  const title =
    type === 'weekly'
      ? 'Steam: топ скидок недели'
      : type === 'hot'
        ? 'Steam: крупные скидки'
        : 'Steam: скидки из списка отслеживания';

  const lines = deals.map((d) => `- ${formatPriceLine(d)}`);
  const body = [
    type === 'weekly' ? 'Подборка заметных скидок в Steam.' : 'Появились скидки на отслеживаемые / популярные игры.',
    '',
    ...lines,
    '',
    '_Цены ориентировочные, могут измениться. Регионы: RU / KZ / UA / US._'
  ].join('\n');

  return { title, body };
}

export async function generateText(deals, type) {
  const listForPrompt = deals.map((d) => ({
    name: d.name,
    appid: d.appid,
    discount: d.discount,
    url: d.url,
    prices: d.prices || {},
    line: formatPriceLine(d)
  }));

  // Без ключа — сразу шаблон
  if (!process.env.GEMINI_API_KEY) {
    return buildFallback(deals, type);
  }

  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const prompt = `
Ты редактор коротких постов про скидки Steam для русскоязычного Reddit.
Данные (уже готовые строки с ценами — используй их как есть, не выдумывай цены):
${JSON.stringify(listForPrompt, null, 2)}

Тип: ${type} (weekly | alert | hot)

Верни СТРОГО JSON без markdown-обёртки:
{"title":"...","body":"..."}

Правила:
1. title — до 120 символов, по делу, без кликбейта и без капса.
2. body — markdown Reddit: список игр. Каждая игра = готовое поле "line" из данных.
3. Без эмодзи, без восклицательных знаков, без рекламы сторонних магазинов.
4. В конце одна строка: цены ориентировочные, регионы RU/KZ/UA/US.
5. Не придумывай названия, цены и ссылки.
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    if (!parsed?.title || !parsed?.body) throw new Error('bad json shape');

    // Страховка: если ИИ выкинул список — подставляем свой
    if (!parsed.body.includes('store.steampowered.com')) {
      const fb = buildFallback(deals, type);
      return { title: parsed.title || fb.title, body: fb.body };
    }
    return parsed;
  } catch (err) {
    console.error('Gemini error, using fallback:', err.message);
    return buildFallback(deals, type);
  }
}
