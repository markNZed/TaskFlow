import React, { createContext, useContext, useEffect } from 'react';
import { useMachine } from '@xstate/react';

// Create a new Context
export const FsmContext = createContext();

// Create a Provider component
export const FsmProvider = ({ fsmState, fsmSend, fsmService, children }) => {
  /*  
  const [fsmState, fsmSend, fsmService] = useMachine(fsmMachine, {
    actions,
    guards,
    devTools,
  });
  */

  // Bundle the FSM variables into a value object
  const value = { fsmState, fsmSend, fsmService };
  //const value = { e:"e", f:"f", g:"g" };

  return <FsmContext.Provider value={value}>{children}</FsmContext.Provider>;
};

// Custom hook to use the FSM variables
export const useFsm = () => {
  const context = useContext(FsmContext);
  if (!context) {
    throw new Error('useFsm must be used within a FsmProvider');
  }
  return context;
};
