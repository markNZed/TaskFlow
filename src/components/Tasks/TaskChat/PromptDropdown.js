import React, { useState } from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import { styled } from '@mui/material/styles';

const PromptDropdown = ({ prompts, onSelect }) => {
  const [selectedPrompt, setSelectedPrompt] = useState('');

  const handleChange = (event) => {
    const value = event.target.value;
    onSelect(value);
  };

  const StyledFormControl = styled(FormControl)(({ theme }) => ({
    marginBottom: theme.spacing(2),
    backgroundColor: 'white',
  }));

return (
    <StyledFormControl 
        fullWidth 
        variant="outlined"
    >
      <InputLabel htmlFor="custom-select">Choisissez un prompt</InputLabel>
      <Select
        labelId="prompt-select-label"
        value={selectedPrompt}
        onChange={handleChange}
        label="Select a Prompt"
      >
        {prompts.map((prompt, index) => (
          <MenuItem key={index} value={prompt}>
            {prompt}
          </MenuItem>
        ))}
      </Select>
    </StyledFormControl>
  );
};

export default PromptDropdown;