/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useContext, useState, useEffect } from "react";
import _, { merge } from "lodash";

const GlobalStateContext = React.createContext();

export function useGlobalStateContext() {
  return useContext(GlobalStateContext);
}

export function GlobalStateProvider({ children }) {
  const globalStatInit = {
    langModel: "gpt-3.5-turbo",
    temperature: 0,
    maxTokens: 4000,
    sessionId: "",
  };

  const [globalState, setGlobalState] = useState(globalStatInit);
  const [prevGlobalState, setPrevGlobalState] = useState(globalStatInit);

  useEffect(() => {
    if (prevGlobalState !== globalState) {
      setPrevGlobalState(globalState);
    }
  }, [globalState]);

  const getObjectDifference = (obj1, obj2) => {
    return _.pickBy(obj1, (value, key) => !_.isEqual(value, obj2[key]));
  };

  useEffect(() => {
    if (prevGlobalState) {
      const diff = getObjectDifference(globalState, prevGlobalState);
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
    setGlobalState((prevState) => ({
      ...prevState,
      [key]: value,
    }));
    //console.log("replaceGlobalState" )
  };

  return (
    <GlobalStateContext.Provider
      value={{ globalState, mergeGlobalState, replaceGlobalState }}
    >
      {children}
    </GlobalStateContext.Provider>
  );
}
