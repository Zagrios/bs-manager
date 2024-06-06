import { useState } from "react";
import { BSVersionManagerService } from "../../services/bs-version-manager.service";
import { AvailableVersionsSlide } from "./available-versions-slide.component";
import { TabNavBar } from "../shared/tab-nav-bar.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { BeatModsService } from "renderer/services/thrird-partys/beat-mods.service";

export function AvailableVersionsSlider() {
    const versionManagerService = useService(BSVersionManagerService);
    const beatMods = useService(BeatModsService);

    const versionModAliases = useObservable(() => beatMods.getVersionAliases(), undefined);
    const availableVersions = useObservable(() => versionManagerService.availableVersions$);
    const [yearIndex, setYearIndex] = useState(0);

    const availableYears = (() => {
        if(!availableVersions?.length) { return []; }
        return [...new Set(availableVersions.map(v => v.year))].sort((a, b) => b.localeCompare(a))
    })();

    const setSelectedYear = (index: number) => {
        setYearIndex(index);
    };

    const getVersionOfYear = (year: string) => {
        return availableVersions.filter(v => v.year === year).sort((a, b) => +b.ReleaseDate - +a.ReleaseDate);
    };

    return (
        <div className="w-full h-fit max-h-full flex flex-col items-center grow min-h-0 gap-3">
            <TabNavBar tabIndex={yearIndex} tabsText={availableYears} onTabChange={setSelectedYear} />
            <ol className="w-full min-h-0 flex transition-transform duration-300" style={{ transform: `translate(${-(yearIndex * 100)}%, 0)` }}>
                {availableYears.map(year => (
                    <AvailableVersionsSlide key={year} versions={getVersionOfYear(year)} versionModAliases={versionModAliases} />
                ))}
            </ol>
        </div>
    );
}
