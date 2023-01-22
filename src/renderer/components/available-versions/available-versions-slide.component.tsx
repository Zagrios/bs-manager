import { BSVersion } from 'shared/bs-version.interface';
import { useEffect, useState } from "react"
import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { filter } from "rxjs/operators";
import { AvailableVersionItem } from "./available-version-item.component";

export function AvailableVersionsSlide(props: {year: string}) {

  const [availableVersions, setAvailableVersions] = useState([] as BSVersion[]);

  const versionsService = BSVersionManagerService.getInstance();

  useEffect(() => {
    versionsService.availableVersions$.pipe(filter(versions => !!versions?.length)).subscribe(() => {
      setAvailableVersions(versionsService.getAvaibleVersionsOfYear(props.year));
    });
  }, [])

    return (
        <ol className="w-full flex items-start justify-center gap-6 shrink-0 content-start flex-wrap p-4 overflow-x-hidden overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
            {availableVersions.map((version, index) =>
                <AvailableVersionItem key={index} version={version}></AvailableVersionItem>
            )}
        </ol>
  )
}
