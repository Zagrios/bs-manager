import { useEffect, useRef, useState } from "react";

export function TabNavBar(props: {tabsText: string[], onTabChange: Function, className?: string}) {

    const [currentTabIndex, setCurrentTabIndex] = useState(0);
    const tabsWrapper = useRef(null);
    const [tabsWidth, setTabsWidth] = useState(0);

    const selectYear = (tab: string) => {
        const newIndex = props.tabsText.indexOf(tab);
        setCurrentTabIndex(newIndex);
        props.onTabChange(newIndex);
    }

    useEffect(() => {
        setTimeout(() => { if(tabsWrapper?.current?.children?.length){ setTabsWidth(tabsWrapper.current.children[0].clientWidth);} }, 20) //Ugly but only that works well ¯\_(ツ)_/¯ 
    }, [props.tabsText])
    

  return (
    <div className={`relative h-8 shrink-0 cursor-pointer rounded-md overflow-hidden mb-3 shadow-md shadow-black ${props.className}`}>
        <div className="absolute w-full h-1 bottom-0">  
          <span className="absolute h-full w-full bg-red-500 brightness-50"></span>
          <span className="absolute h-full block bg-red-500 transition-transform duration-300 shadow-lg shadow-red-500" style={{transform: `translate(${currentTabIndex * 100}%, 0)`, width: `${tabsWidth}px`}}></span>
          <span className="fixed h-1 block shadow-center bg-transparent shadow-red-500 transition-transform duration-300" style={{transform: `translate(${currentTabIndex * 100}%, 0)`, width: `${tabsWidth}px`}}></span>
        </div>
        <div ref={tabsWrapper} className="grid" style={{gridTemplateColumns: `repeat(${props.tabsText.length}, minmax(0, 1fr))`}}>
            { props.tabsText.map((y, index) => 
                <span className="pr-4 pl-4 h-full inline-block bg-main-color-2 text-gray-200 text-lg font-bold text-center hover:bg-main-color-1" key={index} onClick={() => selectYear(y)}>{y}</span>
            )}
        </div>
        
      </div>
  )
}
