// js/api.js

/**
 * 封装所有与 osu! API v2 的交互
 */

import { CORS_PROXY_URL, OSU_API_BASE_URL, OSU_TOKEN_URL } from './config.js';
import { dom } from './dom.js';
import { accessToken, tokenExpiry, setAccessToken } from './state.js';
import { showKeySetupUI } from './ui.js';
import { displayError } from './ui-helpers.js';

/**
 * 获取或刷新 API Access Token
 * @param {string} id - Client ID
 * @param {string} secret - Client Secret
 * @param {boolean} isSilent - 如果为 true，则在失败时不显示 UI 错误
 * @returns {Promise<string|null>} Access Token 或 null
 */
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
        
        const response = await fetch(CORS_PROXY_URL + OSU_TOKEN_URL, {
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

/**
 * 封装对 osu! API v2 的通用 fetch 请求
 * @param {string} endpoint - API 的端点 (e.g., 'users/2/osu')
 * @returns {Promise<object|null>} API 返回的 JSON 数据或 null
 */
export async function fetchV2Api(endpoint) {
    const token = await getAccessToken(dom.clientIdInput.value, dom.clientSecretInput.value);
    if (!token) return null;

    const response = await fetch(CORS_PROXY_URL + `${OSU_API_BASE_URL}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API 请求失败 (${response.status}): ${errorData.message || '未知错误'}`);
    }
    return await response.json();
}

