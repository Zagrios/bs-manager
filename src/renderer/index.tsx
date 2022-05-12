import { createRoot } from 'react-dom/client';
import App from './App';
import { InitDownloadInfoInterface } from 'main/ipcs/bs-download-ipcs';

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(<App />);

setTimeout(() => {
  window.electron.ipcRenderer.sendMessage('bs-download.start', {app: '620980', depot: '620981', manifest: '6222769774084748916', stay: true, username: 'lekilleur618', folder: 'test2', cwd: 'C:\\test'} as InitDownloadInfoInterface);
}, 5000);

window.electron.ipcRenderer.on('bs-download.ask-password', () => console.log('omg popup password'));
