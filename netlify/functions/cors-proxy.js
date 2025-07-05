// netlify/functions/cors-proxy.js

// 使用 require 引入 node-fetch 库
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return {
      statusCode: 400,
      body: '错误：缺少目标 URL 参数。',
    };
  }

  // 创建一个新的 headers 对象，只转发必要的头信息
  // 浏览器发送的 Authorization 头会包含在 event.headers 中
  const forwardedHeaders = {
    'Accept': 'application/json',
    'Content-Type': event.headers['content-type'] || 'application/json',
  };

  // 如果存在 Authorization 头，则转发它
  if (event.headers.authorization) {
    forwardedHeaders['Authorization'] = event.headers.authorization;
  }

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: forwardedHeaders,
      // 仅在非 GET/HEAD 请求中传递 body
      body: event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD' ? event.body : undefined,
      redirect: 'follow',
    });

    const data = await response.text();

    // 从目标响应复制相关的头信息到客户端响应
    const responseHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Content-Type': response.headers.get('Content-Type') || 'application/json',
    };

    return {
      statusCode: response.status,
      body: data,
      headers: responseHeaders,
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `代理请求失败: ${error.message}`,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
    };
  }
};
