/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import { createProxyMiddleware, responseInterceptor } from 'http-proxy-middleware';
import { instancesStore_async } from "./storage.mjs";
import newTask_async from "./newTask.mjs";
import { utils } from "./utils.mjs";

// We are not able to see the content of messages using http-proxy-middleware
// So we create a websocket server etc outselves

// Route the Task to task.destination
function dynamicRouter(req) {
  //console.log('dynamicRouter')
  let target = 'http://null';
  if (req.body?.task?.destination) {
    target = req.body.task.destination;
  }
  return target;
}

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
    //console.log('onProxyReq');
    if (!req.body) {
      console.log('onProxyReq: no body');
      return
    }
    // Modify the request here
    let originalBody = req.body;
    let task = originalBody.task;

    let userId = utils.getUserId(req);

    // Process the task
    task.source = req.ip;  // assuming the task object already exists in the body

    if (task.state?.done) {
      console.log("Task done " + task.id);
      task.state.done = false;
      //await instancesStore_async.set(instanceId, task);
      // Fetch from the Task Hub
      //updated_task = await startTask_async(userId, updated_task.nextTask, updated_task);

    }

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

export { proxyHandler };
