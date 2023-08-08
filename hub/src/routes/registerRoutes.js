/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { activeProcessors, activeCoProcessors } from "../storage.mjs";
import { hubId, setHaveCoProcessor } from "../../config.mjs";
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
  let messagesStyle = req.body?.messagesStyle;
  let serviceTypes = req.body?.serviceTypes;
  let language = req.body?.language;
  let coProcessor = req.body?.coProcessor;

  if (commandsAccepted === undefined) {
    commandsAccepted = ["partial", "update", "start", "join", "pong", "register", "error"];
  }
  // Not used yet but could e usful for interfacing with a third party service
  if (messagesStyle === undefined) {
    messagesStyle = {
      wsOutputDiff: false,
      wsInputDiff: true,
      httpOutputDiff: false,
      httpInputDiff: false, // Not used by Hub yet
    };
  }
  if (language === undefined) {
    language = "EN";
  }
  if (coProcessor === undefined) {
    coProcessor = false;
  }

  console.log("processorId " + processorId + " registered with commandsAccepted " + JSON.stringify(commandsAccepted));
  //console.log("processorId " + processorId + " registered with serviceTypes " + JSON.stringify(serviceTypes));
  //console.log("processorId " + processorId + " registered with messagesStyle " + JSON.stringify(messagesStyle));
  console.log("processorId " + processorId + " registered with environments " + JSON.stringify(environments) + " language " + language + " coProcessor " + coProcessor);
    
  if (coProcessor) {
    setHaveCoProcessor(true);
    activeCoProcessors.set(processorId, {
      environments,
      commandsAccepted,
      serviceTypes,
      messagesStyle,
      language,
      isCoProcessor: true,
    })
  } else {  
    activeProcessors.set(processorId, {
      environments,
      commandsAccepted,
      serviceTypes,
      messagesStyle,
      language,
    })
  }
  
  res.send({
    hubId: hubId,
    configHash: getConfigHash(),
  });

});

// Export the router
export default router;
