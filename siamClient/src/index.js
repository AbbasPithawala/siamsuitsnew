import React from 'react';
import ReactDOM from 'react-dom/client';
import "./fonts/THSarabunNewRegular.ttf"
import './index.css';
import App from './App';
import { ContextProvider } from './context/Context';

const root = ReactDOM.createRoot(document.getElementById('root'))
root.render(
  <React.StrictMode thirdParty={false}>
    <ContextProvider>
        <App />
    </ContextProvider>
  </React.StrictMode>
)

