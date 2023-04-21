import React from 'react';

// mui
import Tooltip from '@mui/material/Tooltip';
import Slider from '@mui/material/Slider';
import Typography from '@mui/material/Typography';
import { Box } from '@mui/system';

const SliderBox = ({toolTipDesc, title, value, onChange, min, max, step}) => {

return (          
        <Box className="slider-box">
          <Tooltip 
          title={toolTipDesc}
          placement="right-start"
          >
            <Typography gutterBottom sx={{ 
              textAlign: "left",
              marginLeft: "8px",
              fontSize: "0.85rem",}}>
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
            sx={{color:"lightgrey"}}
          />
        </Box>
  )
}

export default React.memo(SliderBox);