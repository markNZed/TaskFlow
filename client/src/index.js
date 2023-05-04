/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { GlobalStateProvider } from "./contexts/GlobalStateContext";
import { socketUrl } from "./config";
import { BrowserRouter as Router } from "react-router-dom";

function Root() {
  // <React.StrictMode> was causing issues with double loading
  return (
    <GlobalStateProvider>
      <WebSocketProvider socketUrl={socketUrl}>
        <Router>
          <App />
        </Router>
      </WebSocketProvider>
    </GlobalStateProvider>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.createRoot(rootElement).render(<Root />);
