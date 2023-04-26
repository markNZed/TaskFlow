/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import express from 'express';
import { CLIENT_URL } from '../config.mjs';
import { utils } from '../src/utils.mjs';
import * as dotenv from 'dotenv'
dotenv.config()

const router = express.Router();

router.get('/', async (req, res) => {
  let userId = utils.getUserId(req)
  if (userId) {
    res.send(`Hello, ${userId}!`);
  } else {
    res.status(401).send('Unauthorized');
  }
});

// Needed to add this to workaround for Cloudflare Zero Trust
// We need to visit this server from the browser to get cookies etc
router.get('/authenticate', async (req, res) => {
  let authenticated_url = CLIENT_URL + '/authenticated'
  let userId = utils.getUserId(req)
  if (userId) {
    res.redirect(authenticated_url);
  } else {
    res.redirect(authenticated_url);
  }
});

// Export the router
export default router;