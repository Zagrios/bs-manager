import { BSVersionManagerService } from "renderer/services/bs-version-manager.service";
import { filter, map } from "rxjs/operators";
import { AvailableVersionItem } from "./available-version-item.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";

export function AvailableVersionsSlide(props: { year: string }) {
    
    const versionsService = useService(BSVersionManagerService);
    
    const availableVersions = useObservable(
        versionsService.availableVersions$.pipe(filter(versions => !!versions?.length), map(() => versionsService.getAvaibleVersionsOfYear(props.year))),
        []
    );

    return (
        <ol className="w-full flex items-start justify-center gap-6 shrink-0 content-start flex-wrap p-4 overflow-x-hidden overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
            {availableVersions.map(version => (
                <AvailableVersionItem key={version.BSManifest} version={version} />
            ))}
        </ol>
    );
}
