import React, { useEffect, useState, useRef, useCallback } from "react";
import { Checkbox, Radio, FormGroup, FormControlLabel, Button, Select, MenuItem, Autocomplete, TextField, Switch, Slider, Chip } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import Stack from '@mui/material/Stack';
import { utils } from "../../shared/utils.mjs";

const TaskSelect = (props) => {
  const {
    log,
    task,
    modifyTask,
    transition,
  } = props;

  const [selectedOptions, setSelectedOptions] = useState({});
  const [debouncedOptions, setDebouncedOptions] = useState({});
  const debounceTimeout = useRef();
  const [sentOptions, setSentOptions] = useState();

  props.onDidMount();

  useEffect(() => {
    task.state.current = "start";
    task.state.done = false;
  }, []);

  useEffect(() => {
    console.log("selectedOptions: ", selectedOptions);
  }, [selectedOptions]);

  useEffect(() => {
    if (!props.checkIfStateReady()) {
      return;
    }

    let nextState;
    if (transition()) {
      log("TaskSelect State Machine State: " + task.state.current);
    }

    switch (task.state.current) {
      case "start":
        if (Object.keys(task.output.selected).length > 0) {
          setSelectedOptions(task.output.selected);
        } else {
          // Create and empty array for each entry
          const init = Object.fromEntries(
            Object.keys(task.config.local.fields).map(key => [key, task.config.local.initValue])
          );        
          setSelectedOptions(init);
        }
        nextState = "select";
        break;
      case "select":
        if (!task.config?.local?.submit || task.input.submit) {
          //console.log("deepEqual:", debouncedOptions, sentOptions);
          // There is a risk the dbouncing changes things so we take a copy
          const copyDebouncedOptions = utils.deepClone(debouncedOptions);
          if (!utils.deepEqual(copyDebouncedOptions, sentOptions)) {
            console.log("Updating debouncedOptions: ", copyDebouncedOptions);
            setSentOptions(copyDebouncedOptions);
            modifyTask({ 
              "command": "update", 
              "input.submit": false,
              "output.selected": copyDebouncedOptions,
              "commandDescription": "Set output.selected",
            });
          }
        } else {
          console.log("Not yet submitting debouncedOptions: ", debouncedOptions);
        }
        break;
      default:
        console.log("ERROR: Unknown state - " + task.state.current);
    }

    props.modifyState(nextState);
  }, [task, debouncedOptions]);

  const handleOptionChange = (fieldIndex, value) => {
    setSelectedOptions(prevState => {
      const field = task.config.local.fields[fieldIndex];
      const prevSelectedOption = prevState[fieldIndex];
      //console.log("handleOptionChange fieldIndex", fieldIndex, "field:", field, "value:", value, "prevSelectedOption", prevSelectedOption);
      let result;
      const singleValue = field.options.length === 1 || field.singleSelection;
      if (singleValue) {
        //console.log("handleOptionChange single newValue: ", value);
        result = {
          ...prevState,
          [fieldIndex]: value,
        };
      } else {
        if (prevSelectedOption && prevSelectedOption.includes(value)) {
          const newValueArray = prevSelectedOption.map(option => option === value ? '' : option)
          //console.log("handleOptionChange multiple prevSelectedOption, newValue: ", newValueArray);
          result = {
            ...prevState,
            [fieldIndex]: newValueArray,
          };
        } else {
          //console.log("handleOptionChange multiple !prevSelectedOption", prevState);
          result = {
            ...prevState,
            [fieldIndex]: [value],
          };
        }
      }
      console.log("handleOptionChange result", result);
      return result;
    });
  };

  const handleSubmit = () => {
    modifyTask({ "input.submit": true });
  };

  useEffect(() => {
    // Clear any existing timeout
    clearTimeout(debounceTimeout.current);
    // Set a new timeout
    debounceTimeout.current = setTimeout(() => {
      // This code will run after 200ms unless a new value comes in and clears the timeout
      setDebouncedOptions(selectedOptions);
    }, 200);
  }, [selectedOptions]);

  // Needs testing but allows for task to set inputs
  useEffect(() => {
    if (task?.input?.selectedOptions) {
      setSelectedOptions(prevState => { return {...prevState, ...task.input.selectedOptions} });
    }
  }, [task?.input?.selectedOptions]);

  function substituteString(message, task) {
    const pattern = /%([\w.]+)%/g;
    return message.replace(pattern, (_, key) => {
      const value = key.split('.').reduce((acc, curr) => acc && acc[curr], task);
      return value || '';
    });
  }

  const renderOptions = () => {
    const { fields } = task.config.local;

    if (!selectedOptions) {return}

    let result = [];
    let i = 0;
    for (const [fieldIndex, field] of Object.entries(fields)) {
      const index = field.position || i; // ideally position should be set
      //console.log("Rendering fieldIndex", fieldIndex, "field:", field, "options", field.options, "length", field.options?.length);
      if (!field.options || field.options.length  === 0 || field.hide === true) {
        result[index] = '';
        continue;
      }
      switch (field.type) {

        case 'dropdown': {
          field.singleSelection = true;
          let value;
          if (selectedOptions[fieldIndex] === undefined) {
            value = field.initValue || '';
          } else {
            value = selectedOptions[fieldIndex]
          }
          //console.log("renderOptions dropdown", value);
          result[index] =  (
            <Select
              key={fieldIndex}
              value={value}
              onChange={(event) => handleOptionChange(fieldIndex, event.target.value)}
            >
              {field.options.map((option, optionIndex) => (
                <MenuItem key={fieldIndex + "-" + optionIndex} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          );
          break;
        }
        case 'autocomplete': {
          field.singleSelection = true;
          result[index] =  (
            <Autocomplete
              key={fieldIndex}
              options={field.options}
              getOptionLabel={(option) => option.label}
              renderInput={(params) => <TextField {...params} label="Select options" />}
              onChange={(event, option) => handleOptionChange(fieldIndex, option.value)}
            />
          );
          break;
        }
        case 'slider': {
          field.singleSelection = true;
          let value;
          if (selectedOptions[fieldIndex] === undefined) {
            value = field.initValue || 0;
          } else {
            value = selectedOptions[fieldIndex];
          }
          //console.log("renderOptions slider", value);
          result[index] =  (
              <Slider
              key={fieldIndex}
              value={value} // default value is 0 if there's no selected value
              onChange={(event, newValue) => handleOptionChange(fieldIndex, newValue)}
              min={field.min}
              max={field.max}
              valueLabelDisplay="auto"
              />
          );
          break;
        }
        case 'switch': {
          result[index] =  field.options.map((option, optionIndex) => (
              <FormControlLabel
                key={fieldIndex + "-" + optionIndex}
                control={<Switch />}
                value={option.value}
                label={option.label}
                onChange={() => handleOptionChange(fieldIndex, option.value)} // onChange does not receive a value in Switch
              />
            ));
            break;
        }
        case 'buttons': {
          field.singleSelection = true;
          result[index] =  field.options.map((option, optionIndex) => {
            let variant = "outlined";
            if (selectedOptions[fieldIndex]) {
              variant = selectedOptions[fieldIndex].includes(option.value) ? "contained" : "outlined";
            }
            return (
              <Button 
                key={fieldIndex + "-" + optionIndex} 
                variant={variant} 
                onClick={() => handleOptionChange(fieldIndex, option.value)}
              >
                {option.label}
              </Button>
            )
          });
          break;
        } 
        case 'chips': {
          result[index] =  (
              <Stack direction="row" spacing={1} key={fieldIndex + "-chips"}> {
                field.options.map((option, optionIndex) => {
                  let color = "default";
                  if (selectedOptions[fieldIndex]) {
                    color = selectedOptions[fieldIndex].includes(option.value) ? "primary" : "default";
                  }
                  return (
                    <Chip
                      key={fieldIndex + "-" + optionIndex}
                      label={option.label}
                      onClick={() => handleOptionChange(fieldIndex, option.value)}
                      color={color}
                    />
                  )
                })
              };
              </Stack>
            );
            break;
        }
        case 'checkboxes': {
          result[index] =  field.options.map((option, optionIndex) => {
            let checked = false;
            if (selectedOptions[fieldIndex]) {
              checked = selectedOptions[fieldIndex].includes(option.value);
            }
            return (
              <FormControlLabel
                key={fieldIndex + "-" + optionIndex}
                control={<Checkbox 
                  checked={checked}
                  onChange={() => handleOptionChange(fieldIndex, option.value)}
                />}
                value={option.value}
                label={option.label}
              />
            );
          });
          break;
        }
        default:
          console.log("ERROR: Unknown select UI - " + field.type);
      }
      //console.log("Rendering result", result);
      if (field.preMessage || field.postMessage) {
        const substitutedPreMessage = substituteString(field.preMessage || '', task);
        const substitutedPostMessage = substituteString(field.postMessage || '', task);
        result[index] = (
          <div key={fieldIndex + "prepostMessage"} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {substitutedPreMessage && <span>{substitutedPreMessage}</span>}
            {result[index]}
            {substitutedPostMessage && <span>{substitutedPostMessage}</span>}
          </div>
        );
      }
      i++;      
    }
    return result;
  };

  //console.log("renderOptions()", renderOptions());

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Paper elevation={3} style={{ overflow: "auto", textAlign: "justify", padding: "16px" }}>
        <FormGroup>{renderOptions()}</FormGroup>
      </Paper>
      {task.config.local.submit && (
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Submit
        </Button>
      )}
    </div>
  );
};

export default withTask(TaskSelect);