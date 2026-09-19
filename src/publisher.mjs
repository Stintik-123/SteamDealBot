import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import qs from 'querystring';

let accessToken = null;
let tokenExpiry = 0;

function userAgent() {
  return (
    process.env.REDDIT_USER_AGENT ||
    'linux:steam-deal-bot:v1.1 (by /u/unknown)'
  );
}

/**
 * User token for script-type Reddit apps.
 * Needs: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 * client_credentials cannot submit posts.
 */
async function getToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;

  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;

  if (!clientId || !clientSecret || !username || !password) {
    throw new Error(
      'Missing Reddit secrets. Need REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD'
    );
  }

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const body = qs.stringify({
    grant_type: 'password',
    username,
    password
  });

  const response = await axios.post(
    'https://www.reddit.com/api/v1/access_token',
    body,
    {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent()
      },
      timeout: 30000
    }
  );

  if (!response.data?.access_token) {
    throw new Error(`Reddit auth failed: ${JSON.stringify(response.data)}`);
  }

  accessToken = response.data.access_token;
  const expiresIn = Number(response.data.expires_in || 3600);
  tokenExpiry = Date.now() + expiresIn * 1000 - 60_000;
  return accessToken;
}

async function uploadToImgur(filePath) {
  if (!process.env.IMGUR_CLIENT_ID) return null;
  if (!filePath || !fs.existsSync(filePath)) return null;

  const form = new FormData();
  form.append('image', fs.createReadStream(filePath));
  form.append('type', 'file');

  try {
    const res = await axios.post('https://api.imgur.com/3/image', form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Client-ID ${process.env.IMGUR_CLIENT_ID}`
      },
      timeout: 60000
    });
    return res.data?.data?.link || null;
  } catch (err) {
    console.error('Imgur upload failed:', err.response?.data || err.message);
    return null;
  }
}

/**
 * Публикует self-пост (текст). Картинку при наличии добавляет ссылкой в конец body.
 */
export async function publishPost(subreddit, title, bodyMarkdown, imagePath, options = {}) {
  const token = await getToken();

  let body = bodyMarkdown;
  if (imagePath) {
    const imgurLink = await uploadToImgur(imagePath);
    if (imgurLink) {
      body = `${body}\n\n[Картинка](${imgurLink})`;
    }
  }

  const form = new URLSearchParams();
  form.set('api_type', 'json');
  form.set('kind', 'self');
  form.set('sr', subreddit);
  form.set('title', title.slice(0, 300));
  form.set('text', body);
  form.set('resubmit', 'true');

  if (options.flair_id) form.set('flair_id', options.flair_id);
  if (options.flair_text) form.set('flair_text', options.flair_text);

  try {
    const response = await axios.post(
      'https://oauth.reddit.com/api/submit',
      form.toString(),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': userAgent(),
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        timeout: 30000
      }
    );

    const json = response.data?.json;
    if (json?.errors?.length) {
      console.error('Reddit submit errors:', json.errors);
      return false;
    }

    const id = json?.data?.id || json?.data?.name;
    console.log('Posted successfully:', id || JSON.stringify(response.data));
    return true;
  } catch (err) {
    console.error('Reddit Publish Error:', err.response?.data || err.message);
    return false;
  }
}
