import { BSVersion } from "../../main/services/bs-version-manager.service";
import { useSelector } from "react-redux";
import { AvailableVersionsArray } from "renderer/components/available-versions-array.component";
import { useState } from "react";

export function AvailableVersionsList() {

  const { availableVersions }: {availableVersions: BSVersion[]} = useSelector((state: any) => state.availableBsReducer);

  const [versionSelected, setVersionSelected] = useState(null as BSVersion);
  const [needIds, setNeedIds] = useState(false);
  const [stay, setStay] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const selectedVersionCallback = (v: BSVersion) => {
    setVersionSelected(v);
  }

  const startInstall = (username = localStorage.getItem("username")) => {
    if(!username){ setNeedIds(true); return; }
    localStorage.setItem("username", username);
  }

  console.log(availableVersions);

  return (
    <div>
      <h1 className="w-full text-center font-bold text-gray-200 text-3xl mt-6 tracking-wider text-sh mb-5">CHOOSE BS VERSION</h1>
      {availableVersions && <AvailableVersionsArray versions={availableVersions} setSelectedVersion={selectedVersionCallback}/>}
      { versionSelected && (
        <>
          <h1 className="w-full text-2xl text-gray-200 font-bold text-center mt-5">SELECTED : {versionSelected.BSVersion}</h1>
          <div className="w-full flex flex-col justify-center items-center content-center">
            <button onClick={() => startInstall()} className="m-4 bg-white text-xl font-bold p-3">INSTALL</button>
            <button className="m-4 bg-white text-xl font-bold p-3">VERSION NOTES</button>
          </div>
          { needIds && <input onChange={(e) => setUsername(e.target.value)} value={username} type="text" name="" id="" placeholder="username"/> }
          { needIds && <input onChange={(e) => setPassword(e.target.value)} value={password} type="password" name="" id="" placeholder="password"/> }
          { needIds && (<> <label htmlFor="stay">STAY</label> <input onChange={(e) => setStay(e.target.checked)} checked={stay} id="stay" type="checkbox"/>  </>) }
          { needIds && <button onClick={() => startInstall(username)}>SUBMIT</button> }
        </>
      )}
    </div>
  )
}
