/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Routes, Route } from "react-router-dom";
import "./styles/App.css";
import "./styles/normal.css";
import Taskflows from "./components/Taskflows";
import NotFound from "./components/NotFound";
import IndexedDBViewer from "./components/IndexedDBViewer";
import { useGeolocation } from "./useGeolocation";
import useGlobalStateContext from "./contexts/GlobalStateContext";
import useRegisterWSFilter from "./hooks/useRegisterWSFilter";
import { hubUrl } from "./config.mjs";
import debug from "debug";
import { v4 as uuidv4 } from 'uuid';
import { openStorage } from "./storage.js";

function App({ activeWorkerCount, workerId }) {
  const [processorId, setProcessorId] = useState();
  const [enableGeolocation, setEnableGeolocation] = useState(false);
  const [configHash, setConfigHash] = useState();
  const [registering, setRegistering] = useState(false);
  const { address } = useGeolocation(enableGeolocation);
  const { globalState, mergeGlobalState, replaceGlobalState } =  useGlobalStateContext();
  const storageRef = useRef(null);
  // So Taskflows.js can use the withTask pattern
  // Need to provide an empty object not null
  const [task, setTask] = useState({});

  useEffect(() => {
    if (workerId) {
      if (globalState.workerId !== workerId) {
        replaceGlobalState("workerId", workerId);
      }
      if (globalState.processorId === undefined) {
        let id = localStorage.getItem('processorId' + workerId);
        if (!id) {
          id = "react-" + uuidv4();
          localStorage.setItem('processorId' + workerId, id);
        }
        replaceGlobalState("processorId", id);
      }
    }
  }, [workerId]);

  //debug.disable();
  // This gives us a central place to control debug
  // We can enable per component
  //debug.enable(`${appAbbrev}:TaskChat*`);
  //debug.enable(`${appAbbrev}:TaskConversation*`);
  debug.enable(`*`);

  useRegisterWSFilter(
    (registerTask) => {
      console.log("registerTask", registerTask);
      replaceGlobalState("hubId", null);
    }
  )
  
  useEffect(() => {
    if (globalState?.useAddress && !enableGeolocation) {
      setEnableGeolocation(true);
      console.log("Enabling use of address");
    }
  }, [globalState, enableGeolocation]);

  useEffect(() => {
    if (globalState?.configHash) {
      if (configHash) {
        if (globalState.configHash !== configHash) {
          //reload window
          window.location.reload();
        }
      } else {
        setConfigHash(globalState.configHash);
        console.log("setConfigHash", globalState.configHash);
      }
    }
  }, [globalState]);

  useEffect(() => {
    if (enableGeolocation && address && globalState?.address !== address) {
      replaceGlobalState("address", address);
    }
  }, [address, enableGeolocation]);

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`${hubUrl}/api/interface`, {
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
      } catch (err) {
        console.log(err.message);
      }
    };
    if (globalState?.processorId) {
      setProcessorId(globalState.processorId);
      fetchSession();
    }
  }, [globalState?.processorId]);

  // For reasons I don't understand, React hot update keeps the old globalState upon page reload
  useEffect(() => {
    const registerProcessor = async () => {
      setRegistering(true);
      try {
        const messagesStyle = {
          wsOutputDiff: false,
          wsInputDiff: true,
          httpOutputDiff: false,
          httpInputDiff: false, // Not used by Hub yet
        };      
        const language = navigator?.language?.toLowerCase() ?? 'en';
        const response = await fetch(`${hubUrl}/api/register`, {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
             processorId: globalState.processorId,
             commandsAccepted: ["partial", "update", "init", "join", "pong", "register", "error"],
             environments: ["react"],
             language: language,
             messagesStyle,
          }),
        });
        const data = await response.json();
        console.log("Registered processor: ", data);
        if (data?.hubId) {
          replaceGlobalState("hubId", data.hubId);
        }
        if (data?.configHash) {
          replaceGlobalState("configHash", data.configHash);
        }
      } catch (err) {
        console.log("Registered processor error ");
        console.log(err.message);
      }
      setRegistering(false);
    };
    // Wait for the processorId to be set
    if (!registering && globalState?.processorId && !globalState?.hubId) {
      registerProcessor();
    }
  }, [globalState]);

  // This is a workaround for Firefox private browsing mode not supporting IndexedDB
  // There's an about:config workaround by setting dom.indexedDB.privateBrowsing.enabled to true 
  // Of course this will forego the privacy guarantees of private browsing...
  useEffect(() => {
    const initializeStorage = async () => {
      // For now we have each tab as a separate processor
      // So we need to have separate storage to avoid conflicts
      // Ultimatley there should be one processor per user on the browser
      const storageInstance = await openStorage(globalState.processorId);
      storageRef.current = storageInstance;
      mergeGlobalState({ storageRef });
    };
    if (globalState?.processorId) {
      initializeStorage();
    }
  }, [globalState?.processorId]);

  return (
    <Routes>
      <Route exact path="/" element={<Taskflows task={task} setTask={setTask} />} />
      <Route exact path="/db" element={<IndexedDBViewer workerId={workerId} processorId={processorId}/>} />
      <Route exact path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
