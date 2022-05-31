import { BSVersion } from "../../main/services/bs-version-manager.service"
import { useEffect, useState } from "react"
import { BSVersionManagerService } from "../services/bs-version-manager.service";
import { BsDownloaderService } from "../services/bs-downloader.service";
import { filter, take } from "rxjs";
import { useNavigate } from 'react-router-dom'

export function AvailableVersionsArray({setSelectedVersion}: {setSelectedVersion: Function}) {

  const [versionsMap, setVersionsMap] = useState(new Map<string, BSVersion[]>());
  const [versions, setVersions] = useState([] as BSVersion[]);

  const navigate = useNavigate();

  const versionManagerService = BSVersionManagerService.getInstance();
  const downloaderService = BsDownloaderService.getInstance();

  useEffect(() => {
    versionManagerService.availableVersions$.subscribe(versions => {
      organiseVersions(versions);
      setVersions(versions);
    });

    downloaderService.currentBsVersionDownload$.pipe(filter(v => !!v), take(1)).subscribe(version => {
      navigate(`/bs-version/${version.BSVersion}`, {state: version});
    });
  }, [])


  const organiseVersions = (versions: BSVersion[]) => {
    const newMap = new Map<string, BSVersion[]>();
    versions.forEach(v => {
      newMap.set(v.year, [...(newMap.has(v.year) ? newMap.get(v.year)  : []), v]);
    })

    setVersionsMap(newMap);
  }

  return (
    <div>
      { versions.map((v, index) => <button onClick={() => setSelectedVersion(v)} key={index} className="bg-gray-200 m-2">{v.BSVersion}</button>) }
    </div>
  )
}
