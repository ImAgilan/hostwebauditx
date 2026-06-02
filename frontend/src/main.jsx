import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css'; // your global reset/base styles if any

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);