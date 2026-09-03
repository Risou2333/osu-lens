/*
 * js/config.js
 *
 * osu!lens 修复版配置：所有 osu! 官方请求统一通过同源 Netlify Function 转发，
 * 避免浏览器 CORS 导致 API / .osu 文件获取失败。
 */

export const OSU_API_BASE_URL = 'https://osu.ppy.sh/api/v2';
export const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
export const CORS_PROXY_URL = '/.netlify/functions/cors-proxy?url=';

export const DOWNLOAD_SOURCE_INFO = {
    nerinyan: { name: 'Nerinyan', url: 'https://api.nerinyan.moe/d/' },
    osudirect: { name: 'Osu!direct', url: 'https://osu.direct/api/d/' }
};

export const MODS_ENUM = {
    'HD': 8, 'HR': 16, 'DT': 64, 'NC': 576, 'EZ': 2, 'HT': 256, 'FL': 1024,
    'NF': 1, 'SO': 4096, 'TD': 4194304
};
