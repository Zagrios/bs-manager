import { BSVersion } from "main/services/bs-version-lib.service";
import { useEffect, useState } from "react"
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { filter, take } from "rxjs";
import { AvailableVersionItem } from "./available-version-item.component";

export function AvailableVersionsSlide(props: {year: string}) {

  const [availableVersions, setAvailableVersions] = useState([] as BSVersion[]);

  const versionsService = BSVersionManagerService.getInstance();

  console.log("*** AVAILABLE VERISON");
  console.log(availableVersions);

  useEffect(() => {
    versionsService.availableVersions$.pipe(filter(versions => !!versions?.length), take(1)).subscribe(() => {
      setAvailableVersions(versionsService.getAvaibleVersionsOfYear(props.year));
    });
  }, [])


  return (
    <div className="w-full max-w-full max-h-full shrink-0 flex items-start justify-center overflow-x-hidden overflow-y-scroll content-start scrollbar-thin hover:scrollbar-thumb-neutral-900">
      <div className="relative left-[2px] flex justify-center items-start content-start flex-wrap max-w-6xl pb-4">
        {availableVersions.map((version, index) =>
          <AvailableVersionItem key={index} version={version}></AvailableVersionItem>
        )}
      </div>
    </div>
  )
}
