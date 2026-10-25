import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
// Themes: './index.css' = sketchy, './clay.css' = puffy clay. Swap this one line to switch.
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
