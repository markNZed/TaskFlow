/*
This Source Code Form is subject to the terms of the Mozilla Public
License, v. 2.0. If a copy of the MPL was not distributed with this
file, You can obtain one at https://mozilla.org/MPL/2.0/.
*/

import React from "react";

import Tooltip from "@mui/material/Tooltip";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import { Box } from "@mui/system";

const SliderBox = ({ toolTipDesc, title, value, onChange, min, max, step }) => {
  return (
    <Box className="slider-box">
      <Tooltip title={toolTipDesc} placement="right-start">
        <Typography
          gutterBottom
          sx={{
            textAlign: "left",
            marginLeft: "8px",
            fontSize: "0.85rem",
          }}
        >
          {title}
        </Typography>
      </Tooltip>

      <Slider
        aria-label={title}
        value={value}
        valueLabelDisplay="auto"
        step={step}
        min={min}
        max={max}
        onChange={onChange}
        sx={{ color: "lightgrey" }}
      />
    </Box>
  );
};

export default React.memo(SliderBox);
