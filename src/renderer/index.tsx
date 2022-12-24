import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import 'tailwindcss/tailwind.css';
import './index.css'

const launcherContainer = document.getElementById('launcher');
const oneclickDownloadMapContainer = document.getElementById('oneclick-download-map');
const oneclickDownloadPlaylistContainer = document.getElementById('oneclick-download-playlist');
const oneclickDownloadModelContainer = document.getElementById('oneclick-download-model');

if(launcherContainer){
    import("./windows/Launcher").then(reactWindow => {
        createRoot(launcherContainer).render(<reactWindow.default/>);
    });
}
else if(oneclickDownloadMapContainer){
    import("./windows/OneClick/OneClickDownloadMap").then(reactWindow => {
        createRoot(oneclickDownloadMapContainer).render(<reactWindow.default/>);
    });
}
else if(oneclickDownloadPlaylistContainer){
    import("./windows/OneClick/OneClickDownloadPlaylist").then(reactWindow => {
        createRoot(oneclickDownloadPlaylistContainer).render(<reactWindow.default/>);
    });
}
else if(oneclickDownloadModelContainer){
    import("./windows/OneClick/OneClickDownloadModel").then(reactWindow => {
        createRoot(oneclickDownloadModelContainer).render(<reactWindow.default/>);
    });
}
else{
    const root = document.getElementById('root');
    import("./windows/App").then(reactWindow => {
        createRoot(root).render(
            <HashRouter>
                <reactWindow.default/>
            </HashRouter>
        );
    });
}