/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React, { useCallback, useState, useEffect } from "react";
import { useGlobalStateContext } from "../../contexts/GlobalStateContext";
import { AVAILABLE_MODELS } from "../../utils/constants";
import SliderBox from "./SliderBox";
import SelectBox from "./SelectBox";
import WorkflowTree from "./WorkflowTree";

import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";

const SideMenu = ({ onClose }) => {
  const [openToast, setOpenToast] = useState(false);
  const { globalState, mergeGlobalState } = useGlobalStateContext();

  const action = (handleClose) => (
    <React.Fragment>
      <Button size="small" onClick={handleClose}>
        Close
      </Button>
    </React.Fragment>
  );

  const handleToastClose = useCallback(
    (event, reason) => {
      if (reason === "clickaway") {
        return;
      }
      setOpenToast(false);
    },
    [setOpenToast]
  );

  return (
    <aside>
      <div
        className={`${globalState.user?.interface === "full" ? "" : "hide"}`}
      >
        <SelectBox
          value={globalState.langModel}
          label="Model"
          onSelect={(e) => {
            mergeGlobalState({
              langModel: e.target.value,
            });
          }}
          selectItems={AVAILABLE_MODELS}
        />

        <SliderBox
          toolTipDesc={"Higher value, the more creative of the model"}
          title="Creativity"
          value={globalState.temperature}
          min={0}
          max={1}
          step={0.1}
          onChange={(e) => {
            mergeGlobalState({
              temperature: e.target.value,
            });
          }}
        />

        <SliderBox
          toolTipDesc={"Maximum number of Words the model can generate"}
          title="Max tokens"
          value={globalState.maxTokens}
          onChange={(e) => {
            mergeGlobalState({
              maxTokens: e.target.value,
            });
          }}
          min={10}
          /*max={globalState.langModel === "text-davinci-003" ? 4000 : 8000}*/
          max={4096}
          step={100}
        />

        <Snackbar
          open={openToast}
          autoHideDuration={5000}
          onClose={handleToastClose}
          message={`New name has been added.`}
          action={action(handleToastClose)}
          anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        />
      </div>

      <WorkflowTree onClose={onClose}/>
    </aside>
  );
};

export default React.memo(SideMenu);
