exports.handler = async (event, context) => {
  // 从查询参数中获取目标 URL
  const targetUrl = event.queryStringParameters.url;

  if (!targetUrl) {
    return {
      statusCode: 400,
      body: '错误：缺少目标 URL 参数。',
    };
  }

  // 设置允许访问的源，'*" 表示允许所有
  const allowedOrigin = '*';

  try {
    const response = await fetch(targetUrl, {
      method: event.httpMethod,
      headers: {
        ...event.headers,
        // Netlify 会自动处理 host，无需手动设置
      },
      body: event.body,
      redirect: 'follow', // 遵循重定向
    });

    const data = await response.text();

    return {
      statusCode: response.status,
      body: data,
      headers: {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Content-Type': response.headers.get('Content-Type'),
      },
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: `代理请求失败: ${error.message}`,
    };
  }
};
