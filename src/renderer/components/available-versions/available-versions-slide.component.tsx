import { BSVersion } from "main/services/bs-version-manager.service";
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
    <div className="w-full max-w-full h-fit shrink-0 flex items-center justify-center content-center">
      <div className="flex justify-center items-center content-center flex-wrap max-w-6xl">
        {availableVersions.map((version, index) =>
          <AvailableVersionItem key={index} version={version}></AvailableVersionItem>
        )}
      </div>
    </div>
  )
}
