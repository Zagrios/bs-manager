import { useContext } from "react";
import { AvailableVersionItem } from "./available-version-item.component";
import { BSVersion } from "shared/bs-version.interface";
import { AvailableVersionsContext } from "renderer/pages/available-versions-list.components";
import equal from "fast-deep-equal";
import { swapElements } from "shared/helpers/array.helpers";

type Props = {
    versions: BSVersion[]
}

export function AvailableVersionsSlide({ versions }: Props) {

    const context = useContext(AvailableVersionsContext);

    const setSelectedVersion = (version: BSVersion) => {
        if(equal(version, context.selectedVersion)){
            return context.setSelectedVersion(null);
        }
        context.setSelectedVersion(version);
    }

    const getVersions = () => {
        if(!versions?.length) { return []; }
        const recommendedIndex = versions.findIndex(v => v.recommended);
        if(recommendedIndex === -1) { return versions; }
        return swapElements(recommendedIndex, 0, [...versions]);
    }

    return (
        <ol className="w-full flex items-start justify-center gap-6 shrink-0 content-start flex-wrap px-3.5 pt-4 overflow-x-hidden overflow-y-scroll scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-neutral-900">
            {getVersions().map(version => (
                <AvailableVersionItem key={version.BSManifest} version={version} selected={equal(version, context.selectedVersion)} onClick={() => setSelectedVersion(version)}/>
            ))}
        </ol>
    );
}
