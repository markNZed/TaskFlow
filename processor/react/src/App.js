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
import { hubUrl } from "./config";
import debug from "debug";
import { v4 as uuidv4 } from 'uuid';
import { openStorage } from "./storage.js";

function App({ activeWorkerCount, workerId }) {
  const [enableGeolocation, setEnableGeolocation] = useState(false);
  const { address } = useGeolocation(enableGeolocation);
  const { globalState, mergeGlobalState, replaceGlobalState } =  useGlobalStateContext();
  const storageRef = useRef(null);

  useEffect(() => {
    let id = localStorage.getItem('processorId' + workerId);
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
      console.log("Registering processor");
      let hubId = "unknown";
      mergeGlobalState({ hubId });
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
          hubId = data.hubId;
          mergeGlobalState({ hubId });
        }
      } catch (err) {
        console.log(err.message);
      }
    };
    // Wait for the processorId to be set
    if (globalState?.processorId && !globalState?.hubId) {
      registerProcessor();
    }
  }, [globalState]);

  // This is a workaround for Firefox private browsing mode not supporting IndexedDB
  // There's an about:config workaround by setting dom.indexedDB.privateBrowsing.enabled to true 
  // Of course this will forego the privacy guarantees of private browsing...
  useEffect(() => {
    const initializeStorage = async () => {
      const storageInstance = await openStorage();
      storageRef.current = storageInstance;
      mergeGlobalState({ storageRef });
    };

    initializeStorage();
  }, []);

  return (
    <Routes>
      <Route exact path="/" element={<Taskflows />} />
      <Route exact path="/db" element={<IndexedDBViewer />} />
    </Routes>
  );
}

export default App;
