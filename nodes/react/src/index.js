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
import { EventSourceProvider } from './contexts/EventSourceContext';
import { hubSocketUrl, appLabel } from "./config.mjs";
import { BrowserRouter as Router } from "react-router-dom";

document.title = appLabel || "Default Title";

function Root() {
  const [workerCount, setWorkerCount] = useState();
  const [workerId, setWorkerId] = useState();

  useEffect(() => {
    // Generate a unique ID for this tab/window
    const uid = window.taskflowUID;

    //console.log("BroadcastChannel root", uid);
  
    let channel = new BroadcastChannel('sharedChannel');
  
    setTimeout(function() {
      //console.log(`BroadcastChannel ${uid} sent workerCount`);
      channel.postMessage({ type: "workerCount", uid});
    }, 100);
  
    channel.onmessage = (e) => {
  
      if (e.data.type === "ping" && e.data.uid === uid) {
        //console.log(`BroadcastChannel ${uid} received ping from ${e.data.uid}`);
        channel.postMessage({ type: "pong", uid});
        //console.log(`BroadcastChannel ${uid} sent pong`);
      } else if (e.data.type && e.data.type.startsWith("setWorkerCount")) {
        //console.log(`BroadcastChannel ${uid} received workerCount from ${e.data.uid}`);
        let workerCount = e.data.workerCount;
        setWorkerCount(workerCount);
        console.log('BroadcastChannel setWorkerCount(workerCount)', workerCount);
      } else if (e.data.type && e.data.type.startsWith("setWorkerId") && e.data.uid === uid) {
        //console.log(`BroadcastChannel ${uid} received id from ${e.data.uid}`);
        let workerId = e.data.workerId;
        setWorkerId(workerId);
        console.log('BroadcastChannel setWorkerId(workerId)', workerId);
      } else {
        //console.log('Received data from BroadcastChannel:', e.data);
      }
    };
  
    return () => {
      channel.close();
    };
  }, []);

  if (!workerCount) {
    // Render a loading state or placeholder while waiting for the workerCount
    return <div>Loading...</div>;
  }

  return (
    <GlobalStateProvider>
      <WebSocketProvider socketUrl={hubSocketUrl}>
        <EventSourceProvider>
          <Router>
            <App workerCount={workerCount} workerId={workerId} />
          </Router>
        </EventSourceProvider>
      </WebSocketProvider>
    </GlobalStateProvider>
  );
}

const rootElement = document.getElementById("root");
ReactDOM.createRoot(rootElement).render(<Root />);
