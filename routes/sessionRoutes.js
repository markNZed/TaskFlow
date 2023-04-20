import express from 'express';
import { v4 as uuidv4 } from 'uuid'
import { utils } from '../utils.mjs';

const router = express.Router();

// Globals:
// DEFAULT_USER,
// workflows,
// groups,
// sessionsStore_async,

router.get('/', async (req, res) => {
    console.log("/api/session")
    let userId = DEFAULT_USER
    if (process.env.AUTHENTICATION === "cloudflare") {
      userId = req.headers['cf-access-authenticated-user-email'];
    }
    const sessionId = uuidv4();
    let authorised_workflows = {}
    for (const key in workflows) {
      if (utils.authenticatedTask(workflows[key], userId, groups)) {
        authorised_workflows[key] = workflows[key]
      }
    }
    //console.log("authorised_workflows ", authorised_workflows)
    let workflowsTree = {}
    for (const key in authorised_workflows) {
      let wf = authorised_workflows[key]
      workflowsTree[key] = utils.extract_client_info(wf, workflows[wf.id].filter_for_client)
    }
    //console.log("workflowsTree ", workflowsTree)
    if (userId) {
      console.log("Creating session for ", userId);
      sessionsStore_async.set(sessionId + 'userId', userId);
      res.send({
        user: {
          userId: userId,
          interface: users[userId]?.interface,
        },
        sessionId: sessionId,
        workflowsTree: workflowsTree,
      });
    } else {
      res.send({userId: ''});
    }
  });

// Export the router
export default router;