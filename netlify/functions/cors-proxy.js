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
      body: JSON.stringify({ error: 'Missing url parameter' }),
    };
  }

  try {
    const response = await fetch(targetUrl);
    const contentType = response.headers.get('content-type') || 'text/plain';
    let bodyContent;

    // 尝试将响应体解析为 JSON，如果失败或不是 JSON 类型，则解析为文本。
    if (contentType.includes('application/json')) {
      try {
        bodyContent = await response.json();
      } catch (e) {
        // 如果解析 JSON 失败，回退到文本
        bodyContent = await response.text();
      }
    } else {
      bodyContent = await response.text();
    }

    // 代理始终返回一个 JSON 对象，其中包含原始响应的详细信息
    return {
      statusCode: 200, // 代理本身成功，返回 200 OK
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json', // 代理的响应始终是 JSON 格式
      },
      body: JSON.stringify({
        status: response.status,       // 原始 HTTP 状态码
        statusText: response.statusText, // 原始 HTTP 状态文本
        headers: Object.fromEntries(response.headers.entries()), // 原始响应头
        body: bodyContent,             // 原始响应体内容
        contentType: contentType       // 原始 Content-Type
      }),
    };
  } catch (error) {
    console.error('Proxy fetch error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: 'Proxy could not fetch target URL: ' + error.message }),
    };
  }
};
