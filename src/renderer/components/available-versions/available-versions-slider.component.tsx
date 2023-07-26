import { useState } from "react";
import { BSVersionManagerService } from "../../services/bs-version-manager.service";
import { AvailableVersionsSlide } from "./available-versions-slide.component";
import { filter, map } from "rxjs/operators";
import { TabNavBar } from "../shared/tab-nav-bar.component";
import { useService } from "renderer/hooks/use-service.hook";
import { useObservable } from "renderer/hooks/use-observable.hook";

export function AvailableVersionsSlider() {
    const versionManagerService = useService(BSVersionManagerService);

    const [yearIndex, setYearIndex] = useState(0);
    const availableYears = useObservable(
        versionManagerService.availableVersions$.pipe(filter(versions => !!versions?.length), map(() => versionManagerService.getAvailableYears())),
        []
    );

    const setSelectedYear = (index: number) => {
        setYearIndex(index);
    };

    return (
        <div className="w-full h-fit max-h-full flex flex-col items-center grow min-h-0 gap-3">
            <TabNavBar tabIndex={yearIndex} tabsText={availableYears} onTabChange={setSelectedYear} />
            <ol className="w-full min-h-0 flex transition-transform duration-300" style={{ transform: `translate(${-(yearIndex * 100)}%, 0)` }}>
                {availableYears.map(year => (
                    <AvailableVersionsSlide key={year} year={year} />
                ))}
            </ol>
        </div>
    );
}
