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

  const [selectedOptions, setSelectedOptions] = useState();
  const [debouncedOptions, setDebouncedOptions] = useState();
  const [debouncedValue, setDebouncedValue] = useState(null);
  const debounceTimeout = useRef(null);


  props.onDidMount();

  useEffect(() => {
    task.state.current = "start";
    task.state.done = false;
  }, []);

  useEffect(() => {
    console.log("selectedOptions: ", selectedOptions, task);
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
          const init = task.config.local.fields.map((f) => []);
          setSelectedOptions(init);
        }
        nextState = "select";
        break;
      case "select":
        if (!task.config?.local?.submit || task.input.submit) {
          console.log("deepEqual:", debouncedOptions, task.output.selected); 
          if (!utils.deepEqual(debouncedOptions, task.output.selected)) {
            console.log("Updating debouncedOptions: ", debouncedOptions, task.output.selected);
            modifyTask({ 
              "command": "update", 
              "input.submit": false,
              "output.selected": debouncedOptions,
              "commandDescription": "Set output.selected",
            });
          }
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
      console.log("fieldIndex", fieldIndex, "field:", field, "value:", value);
      let result;
      const singleValue = field.options.length === 1 || field.singleSelection;
      if (singleValue) {
        if (prevSelectedOption.includes(value)) {
          console.log("prevSelectedOption.includes(value)", singleValue, prevState);
          result = {
            ...prevState,
            [fieldIndex]: ["unselected"]
          };
        } else {
          console.log("!prevSelectedOption.includes(value)", singleValue, prevState);
          result = {
            ...prevState,
            [fieldIndex]: [value],
          };
        }
      } else {
        if (prevSelectedOption.includes(value)) {
          console.log("prevSelectedOption.includes(value)", singleValue, prevState);
          const newValue = prevSelectedOption.map(option => option === value ? "unselected" : option)
          console.log("prevSelectedOption, newValue: ", prevSelectedOption, newValue);
          result = {
            ...prevState,
            [fieldIndex]: newValue
          };
        } else {
          console.log("!prevSelectedOption.includes(value)", singleValue, prevState);
          result = {
            ...prevState,
            [fieldIndex]: [...prevSelectedOption, singleValue, value],
          };
        }
      }
      console.log("result", result);
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

  const renderOptions = () => {
    const { fields } = task.config.local;

    if (!selectedOptions) {return;}

    return fields.map((field, fieldIndex) => {
      switch (field.type) {

        case 'dropdown':
          return (
            <Select
              key={fieldIndex}
              value={selectedOptions[fieldIndex][0] || ''}
              onChange={(event) => handleOptionChange(fieldIndex, event.target.value)}
            >
              {field.options.map((option, index) => (
                <MenuItem key={fieldIndex + "-" + index} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          );

        case 'autocomplete':
          field.singleSelection = true;
          return (
            <Autocomplete
              key={fieldIndex}
              options={field.options}
              getOptionLabel={(option) => option.label}
              renderInput={(params) => <TextField {...params} label="Select options" />}
              onChange={(event, option) => handleOptionChange(fieldIndex, option.value)}
            />
          );
          
        case 'slider':
          field.singleSelection = true;
          return (
              <Slider
              key={fieldIndex}
              value={selectedOptions[fieldIndex][0] || 0} // default value is 0 if there's no selected value
              onChange={(event, newValue) => handleOptionChange(fieldIndex, newValue)}
              min={field.min}
              max={field.max}
              valueLabelDisplay="auto"
              />
          );

        case 'switch':
            return field.options.map((option, index) => (
              <FormControlLabel
                key={fieldIndex + "-" + index}
                control={<Switch />}
                value={option.value}
                label={option.label}
                onChange={() => handleOptionChange(fieldIndex, option.value)} // onChange does not receive a value in Switch
              />
            ));
          
        case 'buttons':
            return field.options.map((option, index) => (
              <Button 
                key={fieldIndex + "-" + index} 
                variant={selectedOptions[fieldIndex].includes(option.value) ? "contained" : "outlined"} 
                onClick={() => handleOptionChange(fieldIndex, option.value)}
              >
                {option.label}
              </Button>
            ));
          
        case 'chips':
            return (
              <Stack direction="row" spacing={1} key={fieldIndex + "-chips"}>
                {field.options.map((option, index) => (
                  <Chip
                    key={fieldIndex + "-" + index}
                    label={option.label}
                    onClick={() => handleOptionChange(fieldIndex, option.value)}
                    color={selectedOptions[fieldIndex].includes(option.value) ? "primary" : "default"}
                  />
                ))}
              </Stack>
            );
        
        case 'checkboxes':
            return field.options.map((option, index) => (
              <FormControlLabel
                key={fieldIndex + "-" + index}
                control={<Checkbox 
                  checked={selectedOptions[fieldIndex].includes(option.value)}
                  onChange={() => handleOptionChange(fieldIndex, option.value)}
                />}
                value={option.value}
                label={option.label}
              />
            ));

        default:
          console.log("ERROR: Unknown select UI - " + field.type);
      }
    });
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