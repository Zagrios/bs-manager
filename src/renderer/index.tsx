//@ts-ignore
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App';
import Launcher from './Launcher';
import 'tailwindcss/tailwind.css';
import './index.css'

const launcherContainer = document.getElementById('launcher');

if(!!launcherContainer){
    createRoot(launcherContainer).render(<Launcher/>)
}
else{
    const root = document.getElementById('root');
    createRoot(root).render(
        <HashRouter>
            <App />
        </HashRouter>
    );
}