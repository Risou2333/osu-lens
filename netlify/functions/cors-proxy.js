const fetch = require('node-fetch');

exports.handler = async function(event) {
  const targetUrl = event.queryStringParameters.url;
  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json', // 始终以 JSON 格式返回代理错误
      },
      body: JSON.stringify({ message: 'Missing url parameter' }),
    };
  }

  try {
    const response = await fetch(targetUrl);
    // 读取响应体为文本，无论是 JSON 还是纯文本文件（如 .osu 文件）都适用。
    // 客户端代码会根据 Content-Type 决定如何解析（例如 JSON.parse）。
    const responseBody = await response.text();
    const contentType = response.headers.get('content-type') || 'text/plain';

    return {
      statusCode: response.status, // 保留原始状态码
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': contentType, // 转发原始的 Content-Type
      },
      body: responseBody, // 转发实际的字符串内容
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json', // 确保错误响应也是 JSON 格式
      },
      body: JSON.stringify({ message: 'Proxy error: ' + error.message }),
    };
  }
};
