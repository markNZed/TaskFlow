/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect } from "react";
import _, { merge } from "lodash";
import { utils } from "../utils/utils";

const GlobalStateContext = React.createContext();

export default function useGlobalStateContext() {
  return useContext(GlobalStateContext);
}

export function GlobalStateProvider({ children }) {

  console.log("--------- GlobalStateProvider ---------");

  const globalStateInit = {
    langModel: "gpt-3.5-turbo",
    temperature: 0,
    maxTokens: 4000,
    maxWidth: "100%",
    maxWidthDefault: "100%",
  };

  const [globalState, setGlobalState] = useState(globalStateInit);
  const [prevGlobalState, setPrevGlobalState] = useState(globalStateInit);

  useEffect(() => {
    if (prevGlobalState !== globalState) {
      setPrevGlobalState(globalState);
    }
  }, [globalState]);

  useEffect(() => {
    if (prevGlobalState) {
      const diff = utils.getObjectDifference(prevGlobalState, globalState) || {};
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
