import { AvailableVersionItem } from "./available-version-item.component";
import { BSVersion } from "shared/bs-version.interface";

type Props = {
    versions: BSVersion[]
}

export function AvailableVersionsSlide({ versions }: Props) {

    const getVersions = () => {
        const copy = [...(versions ?? [])];
        const recommendedVersion = copy.find(v => v.recommended);
        if(!recommendedVersion) { return copy; }
        copy.splice(copy.indexOf(recommendedVersion), 1);
        copy.unshift(recommendedVersion);
        return copy;
    }

    return (
        <ol className="w-full flex items-start justify-center gap-6 shrink-0 content-start flex-wrap px-3.5 py-4 overflow-x-hidden overflow-y-scroll scrollbar-default">
            {getVersions().map(version => (
                <AvailableVersionItem key={version.BSManifest} version={version}/>
            ))}
        </ol>
    );
}
