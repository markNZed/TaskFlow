import React, { useEffect, useState } from "react";
import { Checkbox, Radio, FormGroup, FormControlLabel, Button, Select, MenuItem, Autocomplete, TextField, Switch, Slider, Chip } from "@mui/material";
import Paper from "@mui/material/Paper";
import withTask from "../../hoc/withTask";
import Stack from '@mui/material/Stack';

const TaskSelect = (props) => {
  const {
    log,
    task,
    modifyTask,
    transition,
    onDidMount,
  } = props;

  const [selectedOptions, setSelectedOptions] = useState();

  onDidMount();

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
            const init = task.config.fields.map(() => []);
            setSelectedOptions(init);
        }
        break;
      case "exit":
        if (transition()) {
          modifyTask({ "command": "update", "output.selected": selectedOptions });
        }
        nextState = "start";
        break;
      default:
        console.log("ERROR: Unknown state - " + task.state.current);
    }

    props.modifyState(nextState);
  }, [task]);

  const handleOptionChange = (fieldIndex, value) => {
    setSelectedOptions(prevState => {
        const prevSelectedOption = prevState[fieldIndex];
        if (prevSelectedOption.includes(value)) {
          return {
            ...prevState,
            [fieldIndex]: prevSelectedOption.filter(option => option !== value),
          };
        } else if (task.config.fields[fieldIndex].options.length === 1 || task.config.fields[fieldIndex].singleSelection) {
          return {
            ...prevState,
            [fieldIndex]: [value],
          };
        } else {
          return {
            ...prevState,
            [fieldIndex]: [...prevSelectedOption, value],
          };
        }
    });
  };
  

  const handleSubmit = () => {
    modifyTask({ "state.current": "exit" });
  };

  const renderOptions = () => {
    const { fields } = task.config;

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
            return (
                <Slider
                key={fieldIndex}
                value={selectedOptions[fieldIndex][0] || 0} // default value is 0 if there's no selected value
                onChange={(event, newValue) => handleOptionChange(fieldIndex, newValue)}
                min={field.options[0].value}
                max={field.options[field.options.length - 1].value}
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

  console.log("renderOptions()", renderOptions());

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <Paper elevation={3} style={{ overflow: "auto", textAlign: "justify", padding: "16px" }}>
        <FormGroup>{renderOptions()}</FormGroup>
      </Paper>
      <Button variant="contained" color="primary" onClick={handleSubmit}>
        Submit
      </Button>
    </div>
  );
};

export default withTask(TaskSelect);