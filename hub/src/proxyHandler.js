import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';

// Route the Task to task.destination
function dynamicRouter(req) {
  console.log('dynamicRouter')
  let target = 'http://null';
  if (req.body?.task?.destination) {
    target = req.body.task.destination;
  }
  return target;
}

// Maybe we should proxy the ws connection to localhost:5000

const proxyHandler = createProxyMiddleware('/hub/processor/*', {
  target: 'http://null',
  //logLevel : 'debug',
  changeOrigin: true,
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
    console.log('onProxyReq');
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

const proxyHandlerWs = createProxyMiddleware('/hub/ws', {
  target: 'ws://localhost:5000/nodejs/ws',
  pathRewrite: {
    '^/hub/ws': ''
  },
  logLevel : 'debug',
  changeOrigin: true,
  ws: true,
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
  // The event provides an http.ClientRequest object, which is the outgoing request being made to the target of the proxy.
  // If we want to inject information then it would need a middleman appraoch with a custom websocket server
  // Do we want/need this? Maybe we leave websocket as peer to peer?
  onProxyReqWs: (proxyReqWs, req, socket, options, head) => {
    // We are not able to see the content of messages using http-proxy-middleware
    // add custom header
    //proxyReqWs.setHeader('X-Special-Proxy-Header', 'foobar');
    //console.log('req', req)
    //console.log('socket', socket)
    //console.log('options', options) // the createProxyMiddleware options
    //console.log(head.toString('hex')); // part of the websocket handshake
  },
});

export { proxyHandler, proxyHandlerWs };
