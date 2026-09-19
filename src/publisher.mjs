import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

let accessToken = null;
let tokenExpiry = 0;

async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const auth = Buffer.from(`${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`).toString('base64');
  
  const response = await axios.post('https://www.reddit.com/api/v1/access_token', 
    'grant_type=client_credentials', 
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      baseURL: 'https://oauth.reddit.com'
    }
  );

  accessToken = response.data.access_token;
  tokenExpiry = Date.now() + (response.data.expires_in * 1000) - 60000; // Refresh 1 min before expiry
  return accessToken;
}

export async function publishPost(subreddit, title, bodyMarkdown, imagePath) {
  const token = await getToken();
  
  let mediaUrl = null;
  
  // Если есть картинка, грузим её на Imgur (так как Reddit API любит ссылки)
  // Или используем direct upload если поддерживается, но Imgur надежнее для стабильности
  if (imagePath && fs.existsSync(imagePath)) {
     // TODO: Реализовать загрузку на Imgur здесь, если нужен Image Post
     // Пока сделаем Link Post со ссылкой на картинку, если она доступна онлайн
     // Но у нас локальный файл. 
     // Решение: Для начала будем делать TEXT POST (selfpost), а картинку прикреплять нельзя напрямую в selfpost без хостинга.
     
     // ВАЖНОЕ УТОЧНЕНИЕ: Чтобы сделать пост С КАРТИНКОЙ (Image Post) через API, нужно либо base64, либо ссылка.
     // Так как мы хотим простоты: Будем делать LINK POST, где url = ссылка на картинку (Imgur), а selftext = описание.
     
     // Но пока у нас нет автозагрузки на Imgur в этом коде (чтобы не усложнять), 
     // давай сделаем так: Бот будет искать картинку в assets, но публиковать как TEXT POST, 
     // А картинку пользователь увидит только если мы реализуем Imgur uploader.
     
     // Давай я включу простой Imgur uploader прямо сюда, чтобы всё работало сразу.
     const imgurLink = await uploadToImgur(imagePath);
     if (imgurLink) mediaUrl = imgurLink;
  }

  const formData = new FormData();
  formData.append('api_type', 'json');
  formData.append('subreddit', subreddit);
  formData.append('title', title);
  
  if (mediaUrl) {
    // Это Link Post (картинка сверху, текст снизу)
    formData.append('kind', 'link');
    formData.append('url', mediaUrl);
    formData.append('selftext', bodyMarkdown);
  } else {
    // Это Text Post (только текст)
    formData.append('kind', 'self');
    formData.append('selftext', bodyMarkdown);
  }

  try {
    const response = await axios.post('https://oauth.reddit.com/api/submit', formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`,
        'User-Agent': process.env.REDDIT_USER_AGENT || 'linux:steam.bot:v1.0'
      }
    });
    
    console.log('Posted successfully:', response.data.json.data.id);
    return true;
  } catch (err) {
    console.error('Reddit Publish Error:', err.response?.data || err.message);
    return false;
  }
}

// Простой загрузчик на Imgur
async function uploadToImgur(filePath) {
  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  form.append('type', 'file');

  try {
    const res = await axios.post('https://api.imgur.com/3/image', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Client-ID ${process.env.IMGUR_CLIENT_ID}`
      }
    });
    return res.data.data.link;
  } catch (err) {
    console.error("Imgur upload failed", err);
    return null;
  }
                                 }
