import { useEffect, useState } from "react"
import { BSVersionManagerService } from "../../services/bs-version-manager.service";
import { useNavigate } from 'react-router-dom'
import { AvailableVersionsSlide } from "./available-versions-slide.component";
import { AvailableVersionsNavBar } from "./available-versions-nav-bar.component";
import { filter, take } from "rxjs";

export function AvailableVersionsSlider({setSelectedVersion}: {setSelectedVersion: Function}) {

  const navigate = useNavigate();
  const [availableYears, setAvailableYears] = useState([]);
  const [yearIndex, setYearIndex] = useState(0);

  const versionManagerService = BSVersionManagerService.getInstance();

  const setSelectedYear = (year: string) => {
    setYearIndex(availableYears.indexOf(year));
  }

  useEffect(() => {
    versionManagerService.availableVersions$.pipe(filter(versions => !!versions?.length), take(1)).subscribe(() => {
      console.log("ouiiii");
      setAvailableYears(versionManagerService.getAvailableYears());
    });
  }, [])

  return (
    <div className="w-full h-fit relative flex flex-col">
      <AvailableVersionsNavBar years={availableYears} setSelectedYear={setSelectedYear}></AvailableVersionsNavBar>
      <div className="w-full h-fit flex transition-transform duration-700" style={{transform: `translate(${-(yearIndex * 100)}%, 0)`}}>
        { availableYears.map((year, index) =>
          <AvailableVersionsSlide key={index} year={year}></AvailableVersionsSlide>
        )}
      </div>
    </div>
  )
}
