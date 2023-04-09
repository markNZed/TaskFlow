import React, { useContext, useState } from 'react' 

const ModelContext = React.createContext() 
const ModelChangeContext = React.createContext() 

export function useModel(){
  return useContext(ModelContext)
}

export function useModelChange(){
  return useContext(ModelChangeContext)
}

export function ModelProvider({ children }) {
  
  const [model, setModel] = useState(
    {
      langModel:"gpt-3.5-turbo",
      temperature: 0,
      maxTokens: 4000,
      impersonation: "",
    }
  )

  function changeModel(m) { 
    setModel(m) 
  }

  return ( 
    <ModelContext.Provider value={model}>
      <ModelChangeContext.Provider value={changeModel}>
        {children} 
      </ModelChangeContext.Provider>  
    </ModelContext.Provider> 
  )
} 
