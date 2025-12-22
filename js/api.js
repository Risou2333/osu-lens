/*
 * js/api.js
 *
 * 封装所有与 osu! API v2 的交互，包括获取访问令牌和发送 API 请求。
 */

import { CORS_PROXY_URL, OSU_API_BASE_URL, OSU_TOKEN_URL } from './config.js';
import { dom } from './dom.js';
import { accessToken, tokenExpiry, setAccessToken } from './state.js';
import { showKeySetupUI } from './ui.js';
import { displayError } from './ui-helpers.js';

export async function getAccessToken(id, secret, isSilent = false) {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    if (!id || !secret) {
        if (!isSilent) {
            showKeySetupUI(true);
            throw new Error("API 密钥缺失。请输入您的客户端ID和密钥。");
        }
        return null;
    }

    try {
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', id);
        body.append('client_secret', secret);
        body.append('scope', 'public');

        const targetUrl = OSU_TOKEN_URL;
        const fetchUrl = CORS_PROXY_URL ? CORS_PROXY_URL + encodeURIComponent(targetUrl) : targetUrl;

        const response = await fetch(fetchUrl, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = errorData.error || errorData.message || errorData.error_description || response.statusText;
            if (errorData.error === 'invalid_client') {
                errorMessage = "客户端身份验证失败。请仔细检查您的客户端ID和客户端密钥是否正确。";
            }
            if (!isSilent) {
                localStorage.removeItem('osuClientId');
                localStorage.removeItem('osuClientSecret');
                showKeySetupUI(true);
                throw new Error(`获取Token失败: ${errorMessage}`);
            }
            return null;
        }

        const data = await response.json();
        setAccessToken(data.access_token, Date.now() + (data.expires_in - 60) * 1000);

        return accessToken;
    } catch (error) {
        if (!isSilent) {
            console.error('获取 Access Token 时出错:', error);
            displayError(error.message);
        }
        return null;
    }
}

export async function fetchV2Api(endpoint) {
    const token = await getAccessToken(dom.clientIdInput.value, dom.clientSecretInput.value);
    if (!token) return null;

    const targetUrl = `${OSU_API_BASE_URL}/${endpoint}`;
    const fetchUrl = CORS_PROXY_URL ? CORS_PROXY_URL + encodeURIComponent(targetUrl) : targetUrl;

    const response = await fetch(fetchUrl, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API 请求失败 (${response.status}): ${errorData.message || '未知错误'}`);
    }
    return await response.json();
}

export async function searchBeatmapsets(searchQuery) {
    const params = new URLSearchParams();

    // --- 核心修改：定义参数映射 ---
    // 这个映射告诉函数如何将我们代码中的名字 (如 'categories') 转换成 API 需要的名字 (如 's')
    const paramMapping = {
        keywords: 'q',
        categories: 's', // 's' 是 osu! API v2 中代表谱面状态的参数
        mode: 'm',
        cursor_string: 'cursor_string'
    };

    // 遍历传入的 searchQuery 对象的所有属性
    for (const key in searchQuery) {
        if (searchQuery.hasOwnProperty(key)) {
            const apiParam = paramMapping[key] || key;
            const value = searchQuery[key];

            // 确保值不是空的或未定义的，然后再添加到请求中
            if (value !== undefined && value !== null && value !== '') {
                params.append(apiParam, value);
            }
        }
    }

    // 为了保持空关键词搜索时的默认行为，如果外部没有提供排序方式，则默认使用'last_updated_desc'
    if (!params.has('sort')) {
        params.append('sort', 'last_updated_desc');
    }

    // 构建最终的API端点
    const endpoint = `beatmapsets/search?${params.toString()}`;

    // 发送API请求
    return await fetchV2Api(endpoint);
}
