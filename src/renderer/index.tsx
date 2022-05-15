import { createRoot } from 'react-dom/client';
import { InitDownloadInfoInterface } from '../main/ipcs/bs-download-ipcs';
import { HashRouter } from 'react-router-dom';
import App from './App';
import 'tailwindcss/tailwind.css';
import './index.css'
import { Provider } from 'react-redux';
import store from './store/store'

const container = document.getElementById('root')!;
const root = createRoot(container);

root.render(
  <Provider store={store}>
    <HashRouter>
      <App />
    </HashRouter>
  </Provider>
);

// setTimeout(() => {
//   window.electron.ipcRenderer.sendMessage('bs-download.start', {app: '620980', depot: '620981', manifest: '6222769774084748916', stay: true, username: 'lekilleur618', folder: 'test2', cwd: 'C:\\test'} as InitDownloadInfoInterface);
// }, 5000);

// window.electron.ipcRenderer.on('bs-download.ask-password', () => console.log('omg popup password'));

setTimeout(() => {
  //window.electron.ipcRenderer.sendMessage('test-launch', null);
  //window.electron.ipcRenderer.sendMessage('bs-version.request-versions', null);
}, 5000);

//window.electron.ipcRenderer.on('bs-version.request-versions', (v) => console.log(v));
