// libs
import React, {  useCallback, useState } from 'react';

// contexts
import { useModelChange, useModel } from '../contexts/ModelContext';

// utils
import {AVAILABLE_MODELS, IMPERSONATE_LIST} from "../utils/constants"

// components
import SliderBox from "./SliderBox"
import SelectBox from "./SelectBox"

// assets


// mui
import Button from '@mui/material/Button';
import Snackbar from '@mui/material/Snackbar';





const SideMenu = () => {
  const setModel = useModelChange();
  const [openToast, setOpenToast] = useState(false);
  const model = useModel();
  const [impersonateList, setImpersonateList] = useState(IMPERSONATE_LIST);

  const handleToastClick = useCallback(
    ()=> setOpenToast(true), [setOpenToast]); 
  
  const handleToastClose = useCallback(
    (event, reason) => {
      if (reason === 'clickaway') {
        return;
      }
      setOpenToast(false);
    }, [setOpenToast])


  return (
    <aside className='sidemenu'>
          {/* <div className='side-menu-button'>
            <span>+</span>
            New chat
          </div> */}

          <SelectBox
            value={model.langModel}
            label="Language model"
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
            title="Max words" 
            value={model.maxTokens}
            onChange={(e)=>{
              setModel({...model, 
                maxTokens: e.target.value
              })
            }}
            min={10}
            max={model.langModel === "text-davinci-003" ? 4000 : 8000}
            step={100}
          />


          <SelectBox
            value={model.impersonation}
            label="Impersonate"
            onSelect={(e)=>{
              const selectedName = e.target.value === "(None)"? "" : e.target.value;
              setModel({...model, 
                impersonation: selectedName
              });
            }}
            selectItems={impersonateList} 
            textFieldLabel={"Add impersonation"}
            // textFieldRef = {nameFieldRef}
            textFieldOnKeyPress={(ev) => {
              if (ev.key === 'Enter') {
                ev.preventDefault();
                if (ev.target.value){
                  setImpersonateList(prevList =>[...prevList, ev.target.value]);
                  setModel({...model, 
                    impersonation: ev.target.value
                  });
                  ev.target.value = "";
                  handleToastClick();
                }
                
              }
            }}
          />

         

          <Snackbar
          open={openToast}
          autoHideDuration={5000}
          onClose={handleToastClose}
          message={`New name has been added.`}
          action={action(handleToastClose)}
          anchorOrigin={{ horizontal:"right", vertical:"bottom" }}
         />
            
    
     
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