import App from "./App";
import "./index.css";

// Vite injects standard react mount point here in standard setups
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);