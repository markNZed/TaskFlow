/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { activeProcessorsStore_async } from "../storage.mjs";
import { hubId } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// We need to authenticate the processorId
// Could just be a shared secret in the body
router.post("/", async (req, res) => {
  console.log("/hub/api/register");
  let processorId = req.body.processorId;
  let environments = req.body.environments;

  console.log("processorId " + processorId + " registered with environments " + JSON.stringify(environments));
    
  activeProcessorsStore_async.set(processorId, {environments: environments})
  
  res.send({
    hubId: hubId,
  });

});

// Export the router
export default router;
