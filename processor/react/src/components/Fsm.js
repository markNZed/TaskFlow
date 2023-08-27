import { useEffect } from "react";
import { useMachine } from '@xstate/react';

function Fsm(props) {
  const {
    log,
    task,
    modifyTask,
    actions,
    guards,
  } = props;

  const { setFsmState, setFsmSend, setFsmService } = props.useShareFsm();

  // Helper function to synchronize individual state variables.
  const useSynchronizeVariable = (setSharedVariable, variable) => {
    useEffect(() => {
      setSharedVariable(variable);
    }, [setSharedVariable, variable]);
  };

  // Helper function to synchronize individual state variables.
  // React treats functions provided to set as an updater for need to wrap with object
  const useSynchronizeFunction = (setSharedVariable, func) => {
    useEffect(() => {
      setSharedVariable({func: func});
    }, [setSharedVariable, func]);
  };

  const devTools = task.config?.fsm?.devTools ? true : false;
  // We don't move useMachine into HoC because we want to wait on the creation of fsmMachine
  const [fsmState, fsmSend, fsmService] = useMachine(props.fsmMachine, { actions, guards, devTools });

  // Provide fsmState, fsmSend, fsmService to the HoC through useShareFsm context
  useSynchronizeVariable(setFsmState, fsmState);
  useSynchronizeFunction(setFsmSend, fsmSend);
  useSynchronizeVariable(setFsmService, fsmService);

  useEffect(() => {
    if (fsmService) {
      //console.log("Creating service", fsmService);
      const subscription = fsmService.subscribe((state) => {
        log(`FSM State ${state.value} Event ${state.event.type}`, state.event, state); // For debug messages
      });
      return () => {
        subscription.unsubscribe();
      };
    }
  }, [fsmService]);

  // Ff the machine is in the init state then it should jump to task.state.current

  // Synchronise XState FSM with task.state
  useEffect(() => {
    if (fsmState && fsmState.value !== task?.state?.current) {
      modifyTask({ "state.current": fsmState.value });
    }
  }, [fsmState]);

  // Synchronise task.state with FSM
  useEffect(() => {
    if (task?.state?.current) {
      if (fsmSend) {
        if (task?.state?.current && fsmState && task.state.current !== fsmState.value) {
          fsmSend(task.state.current);
        }
      } else {
        console.error("Missed event task.state.current", task.state.current)
      }
    }
  }, [task?.state?.current]);

  return null;

}

export default Fsm;