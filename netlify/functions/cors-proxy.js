const fetch = require('node-fetch'); // 假设 Netlify 函数环境已支持 node-fetch

exports.handler = async function(event) {
  const targetUrl = event.queryStringParameters.url;

  // 处理代理请求中缺少 URL 参数的情况
  if (!targetUrl) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json', // 代理自身的错误响应使用 JSON 格式
      },
      body: JSON.stringify({ message: 'Error: Missing url parameter in proxy request' }),
    };
  }

  try {
    const response = await fetch(targetUrl); // 从目标 URL 获取内容

    // 将响应体读取为文本。这对于 JSON、HTML 和纯文本文件（如 .osu 文件）都适用。
    const responseBody = await response.text();

    // 创建一个新的头部对象，以添加 CORS 头并保留原始头部
    const headers = {};
    response.headers.forEach((value, name) => {
      headers[name] = value;
    });
    headers['Access-Control-Allow-Origin'] = '*'; // 添加 CORS 头部

    // 透明地返回获取到的内容，包括原始状态码和头部
    return {
      statusCode: response.status,
      headers: headers, // 转发原始头部并包含 CORS 头部
      body: responseBody, // 转发实际的响应体内容
    };
  } catch (error) {
    // 捕获代理在执行 fetch 操作时发生的内部错误
    console.error('Proxy internal fetch error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json', // 代理自身的内部错误响应使用 JSON 格式
      },
      body: JSON.stringify({ message: 'Proxy internal error: Could not reach target URL. ' + error.message }),
    };
  }
};
