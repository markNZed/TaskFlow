// libs
import React, {  useCallback, useState } from 'react';

// contexts
import { useModelChange, useModel } from '../contexts/ModelContext';

// utils
import {AVAILABLE_MODELS} from "../utils/constants"

// components
import SliderBox from "./SliderBox"
import SelectBox from "./SelectBox"
import WorkflowTree from "./WorkflowTree"

// assets

// mui
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';

const SideMenu = (props) => {
  const setModel = useModelChange();
  const [openToast, setOpenToast] = useState(false);
  const model = useModel();
  
  const handleToastClose = useCallback(
    (event, reason) => {
      if (reason === 'clickaway') {
        return;
      }
      setOpenToast(false);
    }, [setOpenToast])

  return (
    <aside>
      
        <div className={`${props.user?.interface === 'simple' ? 'hide' : ''}`}>

          <SelectBox
            value={model.langModel}
            label="Model"
            onSelect={(e)=>{
              setModel({...model, 
                langModel: e.target.value
              });
            }}
            selectItems={AVAILABLE_MODELS} 
          />

          <SliderBox
            toolTipDesc={"Higher value, the more creative of the model"}
            title="Creativity" 
            value={model.temperature}
            min={0}
            max={1}
            step={0.1}
            onChange={(e)=>{
              setModel({...model, 
                temperature: e.target.value
              })
            }}
          />

          <SliderBox
            toolTipDesc={"Maximum number of Words the model can generate"}
            title="Max tokens" 
            value={model.maxTokens}
            onChange={(e)=>{
              setModel({...model, 
                maxTokens: e.target.value
              })
            }}
            min={10}
            /*max={model.langModel === "text-davinci-003" ? 4000 : 8000}*/
            max={4096}
            step={100}
          />

          <Snackbar
          open={openToast}
          autoHideDuration={5000}
          onClose={handleToastClose}
          message={`New name has been added.`}
          action={action(handleToastClose)}
          anchorOrigin={{ horizontal:"right", vertical:"bottom" }}
         />
        
      </div>
      
      <WorkflowTree onSelectworkflow={props.onSelectworkflow}/>

    
    </aside>
    )
  }

  export default React.memo(SideMenu);

  const action = (handleClose) => (
    <React.Fragment>
      <Button size="small" onClick={handleClose}>
        Close
      </Button>
    </React.Fragment>
  );