import { useState } from "react"

export function AvailableVersionsNavBar(props: {years: string[], setSelectedYear: Function}) {

  const [selectedYearIndex, setSelectedYearIndex] = useState(0);

  const selectYear = (year: string) => {
    setSelectedYearIndex(props.years.indexOf(year));
    props.setSelectedYear(year);
  }

  return (
      <div className="relative h-8 shrink-0 cursor-pointer rounded-md overflow-hidden mb-3 shadow-md shadow-gray-800">
        <div className="absolute w-full h-1 bottom-0">  
          <span className="absolute h-full w-full bg-red-500 brightness-50"></span>
          <span className="absolute h-full block w-20 bg-red-500 transition-transform duration-500 shadow-lg shadow-red-500" style={{transform: `translate(${selectedYearIndex * 100}%, 0)`}}></span>
          <span className="fixed h-1 block w-20 shadow-center bg-transparent shadow-red-500 transition-transform duration-500" style={{transform: `translate(${selectedYearIndex * 100}%, 0)`}}></span>
        </div>
        { props.years.map((y, index) => 
          <span className="w-20 h-full inline-block bg-main-color-2 text-gray-200 text-lg font-bold text-center hover:bg-main-color-1" key={index} onClick={() => selectYear(y)}>{y}</span>
        )}
      </div>
  )
}
