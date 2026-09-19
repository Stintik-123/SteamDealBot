import axios from 'axios';

export async function getSteamDeals(cc = 'ru') {
  const url = `https://store.steampowered.com/api/featuredcategories/?cc=${cc}&l=english`;
  try {
    const res = await axios.get(url);
    const items = res.data.specials?.items || [];
    
    return items.map(item => ({
      appid: Number(item.appid),
      name: item.name,
      discount: Number(item.discount_percent || 0),
      final_price: item.final_formatted,
      initial_price: item.initial_formatted,
      url: item.url,
      header_image: item.header_image,
      end_date: item.end_date ? new Date(item.end_date * 1000) : null
    })).filter(i => i.discount > 0);
  } catch (err) {
    throw new Error(`Steam API failed: ${err.message}`);
  }
}
