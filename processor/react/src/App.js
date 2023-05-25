/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef } from "react";
import { Routes, Route } from "react-router-dom";
import "./styles/App.css";
import "./styles/normal.css";
import Taskflows from "./components/Taskflows";
import IndexedDBViewer from "./components/IndexedDBViewer";
import { useGeolocation } from "./useGeolocation";
import { useGlobalStateContext } from "./contexts/GlobalStateContext";
import { useWebSocketContext } from "./contexts/WebSocketContext";
import { hubUrl } from "./config";
import debug from "debug";
import { v4 as uuidv4 } from 'uuid';
import { openStorage } from "./storage.js";

function App() {
  const [enableGeolocation, setEnableGeolocation] = useState(false);
  const { address } = useGeolocation(enableGeolocation);
  const { globalState, mergeGlobalState, replaceGlobalState } =  useGlobalStateContext();
  const { webSocketEventEmitter } = useWebSocketContext();
  const storageRef = useRef(null);

  useEffect(() => {
    let id = localStorage.getItem('processorId');
    if (!id) {
      id = "react-" + uuidv4();
      localStorage.setItem('processorId', id);
    }
    replaceGlobalState("processorId", id);
  }, []);

  //debug.disable();
  // This gives us a central place to control debug
  // We can enable per component
  //debug.enable(`${appAbbrev}:TaskChat*`);
  //debug.enable(`${appAbbrev}:TaskConversation*`);
  debug.enable(`*`);
  
  useEffect(() => {
    if (globalState?.use_address && !enableGeolocation) {
      setEnableGeolocation(true);
      console.log("Enabling use of address");
    }
  }, [globalState, enableGeolocation]);

  useEffect(() => {
    if (enableGeolocation && address && globalState?.address !== address) {
      replaceGlobalState("address", address);
    }
  }, [address, enableGeolocation]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`${hubUrl}/api/session`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            processorId: globalState.processorId,
          }),
        });
        const data = await response.json();
        const user = data.user;
        mergeGlobalState({ user });
        console.log("Set user: ", user);
        if (!globalState?.sessionId) {
          const sessionId = data.sessionId;
          mergeGlobalState({ sessionId });
          console.log("Set sessionId ", sessionId);
        }
        // Should have a separate API
        if (data?.taskflowsTree) {
          const taskflowsTree = data.taskflowsTree;
          mergeGlobalState({ taskflowsTree });
        }
      } catch (err) {
        console.log(err.message);
      }
    };
    if (globalState?.processorId) {
      fetchSession();
    }
  }, [globalState?.processorId]);

  useEffect(() => {
    const registerProcessor = async () => {
      try {
        const response = await fetch(`${hubUrl}/api/register`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
             processorId: globalState.processorId,
             environments: ["react"]
          }),
        });
        const data = await response.json();
        if (data?.hubId) {
          const hubId = data.hubId;
          mergeGlobalState({ hubId });
        }
      } catch (err) {
        console.log(err.message);
      }
    };
    // Wait for the processorId to be set
    if (globalState?.processorId) {
      registerProcessor();
    }
  }, [globalState?.processorId]);

  useEffect(() => {
    const initializeStorage = async () => {
      const storageInstance = await openStorage();
      storageRef.current = storageInstance;
    };

    initializeStorage();
  }, []);

  const updateTaskDB = async (task) => {
    // We are not using this storage yet
    // We will need to clean it up
    storageRef.current.set(task.instanceId, task);
    //const value = await storageRef.current.get("a1");
    console.log("Storage updated ", task);
  };

  useEffect(() => {
    //console.log("usePartialWebSocket useEffect adding handleMessage instanceId", instanceId);
    webSocketEventEmitter.on("update", updateTaskDB);
    return () => {
      //console.log("usePartialWebSocket useEffect removing handleMessage instanceId", instanceId);
      webSocketEventEmitter.removeListener("update", updateTaskDB);
    };
  }, []);

  return (
    <Routes>
      <Route exact path="/" element={<Taskflows />} />
      <Route exact path="/db" element={<IndexedDBViewer />} />
    </Routes>
  );
}

export default App;
