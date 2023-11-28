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
import Loading from "./components/Loading";
import IndexedDBViewer from "./components/IndexedDBViewer";
import { useGeolocation } from "./useGeolocation";
import useGlobalStateContext from "./contexts/GlobalStateContext";
import useRegisterWSFilter from "./hooks/useRegisterWSFilter";
import useLoginWSFilter from "./hooks/useLoginWSFilter";
import useReloadWSFilter from "./hooks/useReloadWSFilter";
import useRegisterTask from "./hooks/useRegisterTask";
import { appAbbrev } from "./config.mjs";
import debug from "debug";
import { v4 as uuidv4 } from 'uuid';
import { openStorage } from "./storage.js";

function App({ activeWorkerCount, workerId }) {

  const [registerTask, setRegisterTask] = useState();
  const { registerTaskError } = useRegisterTask(
    registerTask, 
    setRegisterTask,
  );
  const [nodeId, setNodeId] = useState();
  // Needed to use Ref to pass into registerProcessor as nodeId state does not work
  const nodeIdRef = useRef(null);
  const [enableGeolocation, setEnableGeolocation] = useState(false);
  const { address } = useGeolocation(enableGeolocation);
  const { globalState, mergeGlobalState, setGlobalStateEntry } =  useGlobalStateContext();
  const storageRef = useRef(null);
  // So Taskflows.js can use the withTask pattern
  // Need to provide an empty object not null
  const [task, setTask] = useState({});

  useEffect(() => {
    if (workerId) {
      if (globalState.workerId !== workerId) {
        setGlobalStateEntry("workerId", workerId);
      }
      if (globalState.nodeId === undefined) {
        let id = localStorage.getItem('nodeId' + workerId);
        if (!id) {
          id = appAbbrev + "-react-" + uuidv4();
          localStorage.setItem('nodeId' + workerId, id);
        }
        setNodeId(id);
        nodeIdRef.current = id;
      }
    }
  }, [workerId]);

  //debug.disable();
  // This gives us a central place to control debug
  // We can enable per component
  //debug.enable(`${appAbbrev}:TaskChat*`);
  //debug.enable(`${appAbbrev}:TaskConversation*`);
  //debug.enable(`*`); // Is too general e.g. is can enable messages from libraries
  debug.enable(`${appAbbrev}*`);

  // Register upon request from Hub
  const registerProcessor = async (nodeId) => {
    const language = navigator?.language?.toLowerCase() ?? 'en';
    const node = {
      nodeId: nodeId,
      commandsAccepted: ["partial", "update", "init", "join", "pong", "register", "error", "login", "reload"],
      environment: "react",
      language: language,
      type: "processor",
      role: "consumer",
      processing: "batch",
    }
    setRegisterTask({
      command: "register",
      commandDescription: `Request ${nodeId} to register`,
      node,
    })
    setGlobalStateEntry("node", node);
    // The initial task takes on the nodeId so it can process autostart tasks sent by the hub
    setTask({...task, instanceId: nodeId});
  };

  useLoginWSFilter(
    (loginTask) => {
      // Set the window location to /login.html
      window.location.href = '/login.html';
    }
  )

  useReloadWSFilter(
    (reloadTask) => {
      window.location.reload(true);
    }
  )

  useRegisterWSFilter(
    (registerTask) => {
      console.log("registerTask", registerTask, nodeIdRef.current);
      const appLabel = registerTask.node.commandArgs?.appLabel;
      document.title = appLabel || "Default Title";
      mergeGlobalState({ 
        hubId: registerTask.node.commandArgs.hubId,
        appName: registerTask.node.commandArgs?.appName,
        appLabel: appLabel,
        appAbbrev: registerTask.node.commandArgs?.appAbbrev
      });
      registerProcessor(nodeIdRef.current);
    }
  )
  
  useEffect(() => {
    if (globalState?.useAddress && !enableGeolocation) {
      setEnableGeolocation(true);
      console.log("Enabling use of address");
    }
  }, [globalState, enableGeolocation]);

  useEffect(() => {
    if (enableGeolocation && address && globalState?.address !== address) {
      setGlobalStateEntry("address", address);
    }
  }, [address, enableGeolocation]);

  // This is a workaround for Firefox private browsing mode not supporting IndexedDB
  // There's an about:config workaround by setting dom.indexedDB.privateBrowsing.enabled to true 
  // Of course this will forego the privacy guarantees of private browsing...
  useEffect(() => {
    const initializeStorage = async () => {
      // For now we have each tab as a separate node
      // So we need to have separate storage to avoid conflicts
      // Ultimatley there should be one node per user on the browser
      const storageInstance = await openStorage(nodeId);
      storageRef.current = storageInstance;
      // Set nodeId after storage is seetup because we will use nodeId as an 
      // indication that we can send Tasks and we need both storage + nodeId for this
      mergeGlobalState({ storageRef, nodeId });
    };
    if (nodeId) {
      initializeStorage();
    }
  }, [nodeId]);

  return (
    <Routes>
      <Route exact path="/" element={globalState.hubId ? <Taskflows task={task} setTask={setTask} /> : <Loading />} />
      <Route exact path="/db" element={<IndexedDBViewer workerId={workerId} nodeId={nodeId}/>} />
      <Route exact path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
