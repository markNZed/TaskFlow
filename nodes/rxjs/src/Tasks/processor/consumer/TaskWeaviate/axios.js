import axios from 'axios';
import fs from 'fs';
import FormData from 'form-data';

async function uploadFile(filePath) {
  const url = 'https://api.unstructured.io/general/v0/general';
  
  const headers = {
    'accept': 'application/json',
    'Content-Type': 'multipart/form-data',
    'unstructured-api-key': '<YOUR-API-KEY>'
  };

  // Form data
  const formData = new FormData();
  formData.append('files', fs.createReadStream(filePath));

  try {
    const response = await axios.post(url, formData, { headers: { ...formData.getHeaders(), ...headers } });
    console.log(response.data);
  } catch (error) {
    console.error(`Error: ${error.message}`);
  }
}

uploadFile('/Path/To/File');

