import React from "react"

// mui
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import TextField from '@mui/material/TextField';

const SelectBox = ({
  value, 
  label, 
  onSelect, 
  selectItems, 
  textFieldValue,
  textFieldLabel,
  textFieldOnChange,
  textFieldOnKeyPress,
  textFieldRef,
}) => {



  return (
        <FormControl fullWidth id="selector-form">
          <InputLabel id="selector-label">{label}</InputLabel>

          <Select
          labelId=""
          id="model-selector"
          value={value}
          label={label}
          onChange={onSelect}
          sx={{
            textAlign:"left",
          }}
        >
          {selectItems.map((item, index) => (
                <MenuItem value={item} key={item}>
                  {item}
                </MenuItem>
                )
              ) 
          }
          </Select>

          {textFieldLabel && <TextField 
                              label={textFieldLabel}
                              variant="standard" 
                              value = {textFieldValue}
                              onChange={textFieldOnChange}
                              sx={{ 
                                marginTop:"5px",
                                input: { color: 'lightgrey' },
                                label: { 
                                  color: 'lightgrey',
                                  marginLeft:"12px",
                                  fontSize:"0.95rem",
                               }
                             }}
                              onKeyPress={textFieldOnKeyPress}
                              ref={textFieldRef}
                              
                              
            />}

          

        </FormControl>
          
     

    )
  }

  export default React.memo(SelectBox);