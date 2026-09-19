import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateText(deals, type) {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  const prompt = `
    Ты редактор новостей Steam.
    Данные о скидках: ${JSON.stringify(deals)}
    
    Тип поста: ${type === 'weekly' ? 'Еженедельный дайджест' : 'Алерт по списку желаний'}
    
    Правила:
    1. Верни строго JSON: { "title": "...", "body": "..." }
    2. Title: Короткий, информативный. Например: "Steam Sale: Топ скидок недели" или "Скидки на игры из вашего списка".
    3. Body: Сухо, по делу. Никаких эмодзи, никаких восклицательных знаков, никакой рекламы.
    4. Формат каждой строки в теле поста: "[Название](ссылка) за [Цена] (-[Процент]%)"
    5. Если тип 'weekly', добавь в конце дату окончания акции (если известна) или фразу "Цены могут измениться".
    6. Не придумывай описания игр. Только факты.
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanJson = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (err) {
    console.error("Gemini error", err);
    // Fallback
    const list = deals.map(d => `- ${d.name}: ${d.final_price} (-${d.discount}%)`).join('\n');
    return { title: "Steam Deals", body: list };
  }
}
