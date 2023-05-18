// proxyHandler.js
import { createProxyMiddleware } from 'http-proxy-middleware';

// We also need to modify the message to add the task.source

// Create a custom router to dynamically change the target
function dynamicRouter(req) {
  let target = 'http://default-target.com'; // Default target
  let j = JSON.parse(req.body);
  if (j?.task?.destination) {
    target = j.task.destination;
  }
  return target;
}

// The hub needs to intercept both requests and responses
// For requests it copies the IP of the request into the task.source
// For responses it copies the IP of the response into the task.source
const proxyHandler = createProxyMiddleware('/processor', {
  target: 'http://default-target.com', // this is a placeholder, will be overridden
  changeOrigin: true,
  ws: true,
  router: dynamicRouter,
  onError: (err, req, res) => {
    if (err.code !== 'ECONNRESET') {
      console.error('proxy error', err);
    }
    if (!res.headersSent) {
      res.writeHead(500, { 'content-type': 'application/json' });
    }
    const json = { error: 'proxy_error', reason: err.message };
    res.end(JSON.stringify(json));
  }
});

export default proxyHandler;
