/*
 * js/config.js
 *
 * 存放不会改变的常量和全局配置，例如 API 端点和下载源信息。
 */

export const OSU_API_BASE_URL = '/osu-api/api/v2';
export const OSU_TOKEN_URL = '/osu-token';
export const CORS_PROXY_URL = ''; // 使用 Netlify 代理，设为空字符串

export const DOWNLOAD_SOURCE_INFO = {
    nerinyan: { name: 'Nerinyan', url: 'https://api.nerinyan.moe/d/' },
    osudirect: { name: 'Osu!direct', url: 'https://osu.direct/api/d/' }
};

export const MODS_ENUM = {
    'HD': 8, 'HR': 16, 'DT': 64, 'NC': 576, 'EZ': 2, 'HT': 256, 'FL': 1024,
    'NF': 1, 'SO': 4096, 'TD': 4194304
};
