/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React from 'react';
import { utils } from "../utils/utils.mjs";

export default function Loading({containerStyle, message}) {
  
  let defaultContainerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    textAlign: 'center',
    fontSize: '20px'
  };

  if (containerStyle) {
    containerStyle = utils.deepMerge(defaultContainerStyle, containerStyle);
  } else {
    containerStyle = defaultContainerStyle;
  }

  if (!message) {
    message = 'Loading...';
  }

  const spinnerStyle = {
    border: '4px solid rgba(0, 0, 0, 0.1)',
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    borderLeftColor: '#09f',
    animation: 'spin 1s ease infinite'
  };

  return (
    <>
      <style>
        {`
          @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
          }
        `}
      </style>
      <div style={containerStyle}>
        <div style={spinnerStyle}></div>
        <p>{message}</p>
      </div>
    </>
  );
}
