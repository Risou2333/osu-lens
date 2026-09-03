// netlify/functions/cors-proxy.js
// 仅代理 osu! 官方域名中 osu!lens 实际需要的路径，避免成为任意 URL 开放代理。
const fetch = require('node-fetch');

const ALLOWED_METHODS = new Set(['GET', 'POST', 'OPTIONS']);

function corsHeaders(contentType = 'text/plain; charset=utf-8') {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    'Content-Type': contentType,
    'Vary': 'Origin',
  };
}

function isAllowedTarget(url) {
  if (url.protocol !== 'https:' || url.hostname !== 'osu.ppy.sh') return false;

  return (
    url.pathname === '/oauth/token' ||
    url.pathname.startsWith('/api/v2/') ||
    /^\/osu\/\d+$/.test(url.pathname)
  );
}

exports.handler = async (event) => {
  const method = String(event.httpMethod || 'GET').toUpperCase();

  if (!ALLOWED_METHODS.has(method)) {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: 'Method Not Allowed',
    };
  }

  if (method === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: corsHeaders(),
      body: '',
    };
  }

  const rawTarget = event.queryStringParameters && event.queryStringParameters.url;
  if (!rawTarget) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: '缺少目标 URL 参数。',
    };
  }

  let target;
  try {
    target = new URL(rawTarget);
  } catch (_) {
    return {
      statusCode: 400,
      headers: corsHeaders(),
      body: '目标 URL 无效。',
    };
  }

  if (!isAllowedTarget(target)) {
    return {
      statusCode: 403,
      headers: corsHeaders(),
      body: '不允许代理该目标。',
    };
  }

  const isRawBeatmap = /^\/osu\/\d+$/.test(target.pathname);
  const forwardedHeaders = {
    'Accept': isRawBeatmap ? 'text/plain,*/*;q=0.8' : 'application/json',
  };

  const contentType = event.headers && (event.headers['content-type'] || event.headers['Content-Type']);
  if (contentType) forwardedHeaders['Content-Type'] = contentType;

  const authorization = event.headers && (event.headers.authorization || event.headers.Authorization);
  if (authorization) forwardedHeaders.Authorization = authorization;

  try {
    const response = await fetch(target.toString(), {
      method,
      headers: forwardedHeaders,
      body: method === 'POST' ? event.body : undefined,
      redirect: 'follow',
    });

    const body = await response.text();
    const upstreamType = response.headers.get('content-type') ||
      (isRawBeatmap ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8');

    const headers = corsHeaders(upstreamType);
    headers['Cache-Control'] = isRawBeatmap
      ? 'public, max-age=86400, s-maxage=86400'
      : 'no-store';

    return {
      statusCode: response.status,
      headers,
      body,
    };
  } catch (error) {
    console.error('osu! proxy failed:', error);
    return {
      statusCode: 502,
      headers: corsHeaders(),
      body: `代理请求失败: ${error.message}`,
    };
  }
};
