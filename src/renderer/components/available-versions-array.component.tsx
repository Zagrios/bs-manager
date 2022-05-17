import { BSVersion } from "../../main/services/bs-version-manager.service"
import { useEffect, useState } from "react"

export function AvailableVersionsArray({versions, setSelectedVersion}: {versions: BSVersion[], setSelectedVersion: Function}) {

  const [versionsMap, setVersionsMap] = useState(new Map<string, BSVersion[]>())

  console.log(setSelectedVersion);

  useEffect(() => {
    organiseVersions()
  }, [])
  

  const organiseVersions = () => {
    const newMap = new Map<string, BSVersion[]>();
    versions.forEach(v => {
      newMap.set(v.year, [...(newMap.has(v.year) ? newMap.get(v.year)  : []), v]);
    })

    setVersionsMap(newMap);
  }

  console.log(versionsMap);

  return (
    <div>
      { versions.map((v, index) => <button onClick={() => setSelectedVersion(v)} key={index} className="bg-gray-200 m-2">{v.BSVersion}</button>) }
    </div>
  )
}
