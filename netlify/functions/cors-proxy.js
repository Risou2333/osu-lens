// netlify/functions/cors-proxy.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
  const targetUrl = event.queryStringParameters.url;
  if (!targetUrl) {
    return { statusCode: 400, body: 'Missing url parameter' };
  }

  try {
    const response = await fetch(targetUrl);
    const body = await response.text();
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': response.headers.get('content-type') || 'text/plain',
      },
      body,
    };
  } catch (error) {
    return { statusCode: 500, body: 'Proxy error: ' + error.message };
  }
};
