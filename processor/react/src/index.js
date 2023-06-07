/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles/index.css";
import App from "./App";
import { WebSocketProvider } from "./contexts/WebSocketContext";
import { GlobalStateProvider } from "./contexts/GlobalStateContext";
import { hubSocketUrl } from "./config";
import { BrowserRouter as Router } from "react-router-dom";

// service-worker.js is in the public folder
// it needed to be added to index.html as well
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./serviceWorker.js')
      .then(registration => {
        console.log('Service Worker registered:', registration);
      })
      .catch(error => {
        console.log('Service Worker registration failed:', error);
        throw error;
      });
  });
}

/*
const mySharedWorker = new SharedWorker('./sharedWorker.js');
const port = mySharedWorker.port;
// Sends a message to the shard worker that is echoed back
port.postMessage('Test message to worker.');
port.onmessage = (e) => {
  console.log('Receive data from shared worker:', e.data);
};
*/

let mySharedWorker;
let activeWorkerCount;

function Root() {
  const [workerCount, setWorkerCount] = useState();
  const [workerId, setWorkerId] = useState();

  useEffect(() => {
    // Connect to the shared worker initially
    let mySharedWorker = new SharedWorker('./sharedWorker.js');
    const port = mySharedWorker.port;

    setTimeout(function() {
      port.postMessage("activeWorkerCount");
    }, 500);

    port.onmessage = (e) => {
      //console.log("e.data", e.data);
      if (e.data === "ping") {
        port.postMessage("pong");
      } else if (e.data.startsWith("activeWorkerCount:")) {
        let activeWorkerCount = e.data.split(":")[1];
        console.log("activeWorkerCount:", activeWorkerCount);
        // Update the state with the activeWorkerCount
        setWorkerCount(activeWorkerCount);
      } else if (e.data.startsWith("id:")) {
        let workerId = e.data.split(":")[1];
        console.log("workerId:", workerId);
        // Update the state with the activeWorkerCount
        setWorkerId(workerId);
      } else {
        console.log('Received data from shared worker:', e.data);
      }
    };

    port.onmessageerror = (e) => {
      console.log('Received message error from shared worker:', e);
    }

    // Clean up the shared worker connection when the component unmounts
    return () => {
      mySharedWorker.port.postMessage('shutdown');
    };
  }, []);

  if (!workerCount) {
    // Render a loading state or placeholder while waiting for the activeWorkerCount
    return <div>Loading...</div>;
  }

  return (
    <GlobalStateProvider>
      <WebSocketProvider socketUrl={hubSocketUrl}>
        <Router>
          <App activeWorkerCount={workerCount} workerId={workerId} />
        </Router>
      </WebSocketProvider>
    </GlobalStateProvider>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.createRoot(rootElement).render(<Root />);
