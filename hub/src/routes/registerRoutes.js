/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { activeProcessors } from "../storage.mjs";
import { hubId } from "../../config.mjs";
import { getConfigHash } from "../configdata.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

// We need to authenticate the processorId
// Could just be a shared secret in the body
router.post("/", async (req, res) => {
  console.log("/hub/api/register");
  let processorId = req.body.processorId;
  let environments = req.body.environments;
  let commandsAccepted = req.body?.commandsAccepted;
  let serviceTypes = req.body?.serviceTypes;

  if (commandsAccepted === undefined) {
    commandsAccepted = ["partial", "update", "start", "join", "pong", "register"];
  }

  console.log("processorId " + processorId + " registered with environments " + JSON.stringify(environments));
  console.log("processorId " + processorId + " registered with commandsAccepted " + JSON.stringify(commandsAccepted));
  //console.log("processorId " + processorId + " registered with serviceTypes " + JSON.stringify(serviceTypes));
    
  activeProcessors.set(processorId, {
    environments,
    commandsAccepted,
    serviceTypes,
  })
  
  res.send({
    hubId: hubId,
    configHash: getConfigHash(),
  });

});

// Export the router
export default router;
