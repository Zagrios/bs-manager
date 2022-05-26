import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import 'tailwindcss/tailwind.css';
import './index.css'

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <HashRouter>
    <App />
  </HashRouter>
);
