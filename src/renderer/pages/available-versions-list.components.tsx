import { BSVersion } from "../../main/services/bs-version-manager.service";
import { useSelector } from "react-redux";
import { AvailableVersionsArray } from "renderer/components/available-versions-array.component";

export function AvailableVersionsList() {

  const { availableVersions }: {availableVersions: BSVersion[]} = useSelector((state: any) => state.availableBsReducer);

  console.log(availableVersions);

  return (
    <div>
      <h1 className="w-full text-center font-bold text-gray-200 text-3xl mt-6 tracking-wider text-sh">CHOOSE BS VERSION</h1>
      {availableVersions && <AvailableVersionsArray versions={availableVersions}/>}
    </div>
  )
}
