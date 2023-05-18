import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

// Route the Task to task.destination
function dynamicRouter(req) {
  let target = 'http://null'; // Default target
  if (req.body?.task?.destination) {
    target = req.body.task.destination;
    //console.log('dynamicRouter: ', target)
  }
  return target;
}

const proxyHandler = createProxyMiddleware('/hub/processor/*', {
  target: 'http://null',
  changeOrigin: true,
  ws: true,
  pathRewrite: {
    '^/hub/processor/.*': ''
  },
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
  },
  // Rccord the IP of the processor making the request in task.source
  onProxyReq: (proxyReq, req, res) => {
    //console.log('onProxyReq: ', req.body);
    if (!req.body) {
      console.log('onProxyReq: no body');
      return
    }
    // Modify the request here
    let originalBody = req.body;
    originalBody.task.source = req.ip;  // assuming the task object already exists in the body
    let modifiedBody = JSON.stringify(originalBody);

    proxyReq.setHeader('Content-Type', 'application/json');
    proxyReq.setHeader('Content-Length', Buffer.byteLength(modifiedBody));
    proxyReq.write(modifiedBody);
  },
  // res.end() will be called internally by responseInterceptor()
  // If end is sent automatically responseInterceptor cannot update the response
  selfHandleResponse: true, 
  onProxyRes: responseInterceptor(async (responseBuffer, proxyRes, req, res) => {
    const response = responseBuffer.toString('utf8');
    let data = JSON.parse(response);
    let task = data.task;
    //task.label = "testing it"
    //console.log('task: ', task);
    return JSON.stringify(data);
  }),
});

export default proxyHandler;
