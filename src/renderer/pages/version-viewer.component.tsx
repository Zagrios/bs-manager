import React from 'react'
import { useLocation } from 'react-router-dom'

export default function VersionViewer() {

  const {state} = useLocation();
  console.log(state);

  const launchBs = () => {
    window.electron.ipcRenderer.sendMessage('bs-launch.steam'); //Temporary
  }

  return (
    <div>
      <button onClick={launchBs}>Launch</button>
    </div>
  )
}
