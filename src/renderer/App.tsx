import { NavBar } from "./components/nav-bar/nav-bar.component";
import TitleBar from "./components/title-bar/title-bar.component";
import { Routes, Route } from "react-router-dom";
import { AvailableVersionsList } from "./pages/available-versions-list.components";
import { useDispatch, useSelector } from "react-redux";
import { useEffect } from "react";
import { VersionViewer } from "./pages/version-viewer.component";
import { Modal } from "./components/modal/modal.component";

export default function App() {

  const dispatch = useDispatch()

  useEffect(() => {
    initIpcsListener();
    window.electron.ipcRenderer.sendMessage('bs-version.installed-versions');
    window.electron.ipcRenderer.sendMessage('bs-version.request-versions');
  }, [])

  const initIpcsListener= () => {
    window.electron.ipcRenderer.on('bs-version.installed-versions', versions => dispatch({type: 'INSTALLED_BS_ADD_ALL', payload: versions}));
    window.electron.ipcRenderer.on('bs-version.request-versions', versions => dispatch({type: 'AVAILABLE_BS_INIT', payload: versions}));
  }
  
  

  return (
    <div className="relative w-screen h-screen overflow-hidden flex dark:bg-main-color-1 z-0">
      <Modal/>
      <NavBar/>
      <div className="flex flex-col grow">
        <TitleBar/>
        <div className="bg-main-color-2 relative rounded-tl-lg grow overflow-hidden">
          <Routes>
            <Route path={"/bs-version/:versionNumber"} element={<VersionViewer/>}/>
            <Route path="*" element={<AvailableVersionsList/>}/>
          </Routes>
        </div>
      </div>
    </div>
  );
}
