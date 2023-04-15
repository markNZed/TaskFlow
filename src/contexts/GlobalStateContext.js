import React, { useContext, useState } from 'react' 
import { merge } from 'lodash';

const GlobalStateContext = React.createContext() 

export function useGlobalStateContext(){
  return useContext(GlobalStateContext)
}

export function GlobalStateProvider({ children }) {
  
  const [globalState, setGlobalState] = useState(
    {
      langModel:"gpt-3.5-turbo",
      temperature: 0,
      maxTokens: 4000,
      sessionId: '',
    }
  )

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
    <GlobalStateContext.Provider  value={{ globalState, mergeGlobalState, replaceGlobalState }}>
      {children} 
    </GlobalStateContext.Provider> 
  )
  
} 
