import React, {useState, useEffect} from 'react';
import { Routes, Route } from 'react-router-dom';
import './styles/App.css';
import './styles/normal.css';
import Workflows from "./components/Workflow/Workflows"

function App() {

  return (
    <Routes>
      <Route exact path="/" element={<Workflows/>} />
      <Route path="/authenticated" element={<Workflows/>} />
    </Routes>
  );
}

export default App;
