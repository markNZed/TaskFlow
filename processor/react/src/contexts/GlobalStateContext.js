/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect } from "react";
import _, { merge } from "lodash";
import { getObjectDifference } from "../utils/utils";

const GlobalStateContext = React.createContext();

export default function useGlobalStateContext() {
  return useContext(GlobalStateContext);
}

export function GlobalStateProvider({ children }) {

  console.log("--------- GlobalStateProvider ---------");

  const globalStatInit = {
    langModel: "gpt-3.5-turbo",
    temperature: 0,
    maxTokens: 4000,
  };

  const [globalState, setGlobalState] = useState(globalStatInit);
  const [prevGlobalState, setPrevGlobalState] = useState(globalStatInit);

  useEffect(() => {
    if (prevGlobalState !== globalState) {
      setPrevGlobalState(globalState);
    }
  }, [globalState]);

  useEffect(() => {
    if (prevGlobalState) {
      const diff = getObjectDifference(prevGlobalState, globalState,);
      if (Object.keys(diff).length > 0) {
        console.log("globalState changes:", diff);
      }
    }
  }, [globalState]);

  const mergeGlobalState = (newState) => {
    setGlobalState((prevState) => merge({}, prevState, newState));
    //console.log("mergeGlobalState" )
  };

  const replaceGlobalState = (key, value) => {
    if (value === undefined) {
      console.warning("replaceGlobalState: value is undefined");
    }
    setGlobalState((prevState) => ({
      ...prevState,
      [key]: value,
    }));
    //console.log("replaceGlobalState ", key, value )
  };

  return (
    <GlobalStateContext.Provider
      value={{ globalState, mergeGlobalState, replaceGlobalState }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
}
