# SteamDealBot

Бот скидок Steam → пост на Reddit (self-post).

- **Понедельник** — недельный дайджест (specials ∩ popular, либо specials если popular пустой)
- **Остальные дни** — алерты по `watchlist` и крупные скидки (≥ hot) по popular
- Цены **RU / KZ / UA / US**
- Память в `data/memory.json` (чтобы не дублировать те же скидки)
- Текст: Gemini (если есть ключ) или шаблон без ИИ

Тестовый саб сейчас: `Ru_Steam` (`config/settings.json`).

## Secrets (GitHub → Settings → Secrets)

| Secret | Обязательно | Зачем |
|--------|-------------|--------|
| `REDDIT_CLIENT_ID` | да | Reddit app (type **script**) |
| `REDDIT_CLIENT_SECRET` | да | |
| `REDDIT_USERNAME` | да | Аккаунт, от которого постить |
| `REDDIT_PASSWORD` | да | Пароль (или app password если 2FA) |
| `REDDIT_USER_AGENT` | да | Вид: `linux:steam-deal-bot:v1.1 (by /u/Ник)` |
| `GEMINI_API_KEY` | нет | Без ключа — шаблонный текст |
| `IMGUR_CLIENT_ID` | нет | Мемы из `assets/memes` |

### Reddit app

1. https://www.reddit.com/prefs/apps → create app → **script**
2. redirect uri: `http://localhost:8080`
3. Client ID — под названием, Secret — рядом

`client_credentials` **нельзя** — посты от юзера не уйдут. Нужен password grant (как в коде).

## Конфиг

- `config/settings.json` — саб, пороги скидок, день дайджеста, валюты
- `config/watchlist.json` — appid для ежедневных алертов
- `config/popular.json` — popular appid для дайджеста/hot (можно расширять руками)

## Локально

```bash
cp .env.example .env
# заполни .env
npm install
node src/index.mjs
```

Или Actions → **Run Steam Bot** → Run workflow.

## Мемы

Кинь `jpg/png` в `assets/memes/`. Без `IMGUR_CLIENT_ID` пост всё равно уйдёт текстом.
