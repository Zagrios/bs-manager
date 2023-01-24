import { useEffect, useState } from "react"
import { BSVersionManagerService } from "../../services/bs-version-manager.service";
import { AvailableVersionsSlide } from "./available-versions-slide.component";
import { filter} from "rxjs/operators";
import { TabNavBar } from "../shared/tab-nav-bar.component";

export function AvailableVersionsSlider() {

    const versionManagerService = BSVersionManagerService.getInstance();

    const [availableYears, setAvailableYears] = useState([]);
    const [yearIndex, setYearIndex] = useState(0);

    const setSelectedYear = (index: number) => {
        setYearIndex(index);
    }

    useEffect(() => {
        versionManagerService.availableVersions$.pipe(filter(versions => !!versions?.length)).subscribe(() => {
            setAvailableYears(versionManagerService.getAvailableYears());
        });
    }, [])

    return (
        <div className="w-full h-fit max-h-full flex flex-col items-center grow min-h-0 gap-3">
            <TabNavBar tabIndex={yearIndex} tabsText={availableYears} onTabChange={setSelectedYear}/>
            <ol className="w-full min-h-0 flex transition-transform duration-300" style={{transform: `translate(${-(yearIndex * 100)}%, 0)`}}>
                { availableYears.map(year =>
                    <AvailableVersionsSlide key={year} year={year}/>
                )}
            </ol>
        </div>
    )
}
