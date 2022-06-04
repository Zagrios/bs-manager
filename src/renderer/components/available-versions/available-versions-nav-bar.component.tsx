
export function AvailableVersionsNavBar(props: {years: string[], setSelectedYear: Function}) {
  return (
    <div className="w-full h-fit flex justify-center items-center">
      { props.years.map((y, index) => <span key={index} onClick={() => props.setSelectedYear(y)}>{y}</span>) }
    </div>
  )
}
