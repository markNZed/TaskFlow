import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));

// <React.StrictMode> was causing issues with double loading
root.render(
    <App/>
);


