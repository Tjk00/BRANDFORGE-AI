import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './app-shell.css';
import './premium.css';
import './shell.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
