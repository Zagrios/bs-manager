//@ts-ignore
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './windows/App';
import Launcher from './windows/Launcher';
import 'tailwindcss/tailwind.css';
import './index.css'
import OneClickDownloadMap from './windows/OneClick/OneClickDownloadMap';

const launcherContainer = document.getElementById('launcher');
const oneclickDownloadMapContainer = document.getElementById('oneclick-download-map');

if(!!launcherContainer){
    createRoot(launcherContainer).render(<Launcher/>)
}
else if(!!oneclickDownloadMapContainer){
    createRoot(oneclickDownloadMapContainer).render(<OneClickDownloadMap/>)
}
else{
    const root = document.getElementById('root');
    createRoot(root).render(
        <HashRouter>
            <App />
        </HashRouter>
    );
}