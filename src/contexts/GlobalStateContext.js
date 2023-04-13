import React, { useContext, useState } from 'react' 

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
      impersonation: "",
    }
  )

  function changeGlobalState(m) { 
    setGlobalState(m) 
  }

  return ( 
    <GlobalStateContext.Provider  value={{ globalState, changeGlobalState }}>
      {children} 
    </GlobalStateContext.Provider> 
  )
  
} 
