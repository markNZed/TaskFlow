/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from "express";
import * as dotenv from "dotenv";
dotenv.config();

const router = express.Router();

router.get("*", function (req, res) {
  console.log("*")
  res.status(404).send("Unknown end-point");
});

// Export the router
export default router;
