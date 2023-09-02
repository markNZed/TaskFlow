/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import { utils } from "../utils.mjs";
import { usersStore_async, groupsStore_async, tasksStore_async } from "../storage.mjs";
import { hubId } from "../../config.mjs";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.post("/", async (req, res) => {
  console.log("/hub/api/interface");
  let userId = utils.getUserId(req);
  if (userId) {
    const user = await usersStore_async.get(userId);
    res.send({
      user: {
        userId: userId,
        interface: user?.interface,
        label: user?.label,
      },
      hubId: hubId,
    });
  } else {
    res.send({ userId: "" });
  }
});

// Export the router
export default router;
