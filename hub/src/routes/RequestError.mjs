/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

export default class RequestError extends Error {
    constructor(message, code, error = null) {
      super(message);
      this.code = code;
      this.origError = error;
      this.name = this.constructor.name;
      Error.captureStackTrace(this, this.constructor);
    }
}