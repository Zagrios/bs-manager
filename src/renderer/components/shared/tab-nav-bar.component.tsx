import { useState } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function TabNavBar(props: {tabsText: string[], onTabChange: Function, className?: string}) {

    const [currentTabIndex, setCurrentTabIndex] = useState(0);
    const t = useTranslation();
    const secondColor = useThemeColor("second-color");

    const selectYear = (tab: string) => {
        const newIndex = props.tabsText.indexOf(tab);
        setCurrentTabIndex(newIndex);
        props.onTabChange(newIndex);
    }

    return (
        <div className={`relative h-8 shrink-0 cursor-pointer rounded-md overflow-hidden mb-3 shadow-md shadow-black ${props.className}`}>
            <div className="absolute w-full h-1 bottom-0" style={{color: secondColor}}>  
                <span className="absolute h-full w-full bg-current brightness-50" />
                <span className="absolute h-full block bg-current transition-transform duration-300 shadow-center shadow-current" style={{transform: `translate(${currentTabIndex * 100}%, 0)`, width: `calc(100% / ${props.tabsText.length})`}}/>
            </div>
            <div className="grid" style={{gridTemplateColumns: `repeat(${props.tabsText.length}, minmax(0, 1fr))`}}>
                { props.tabsText.map((y, index) => 
                    <span  className="pr-4 pl-4 h-full inline-block bg-light-main-color-2 text-gray-800 dark:bg-main-color-2 dark:text-gray-200 text-lg font-bold text-center hover:bg-light-main-color-1 dark:hover:bg-main-color-1" key={index} onClick={() => selectYear(y)}>{t(y)}</span>
                )}
            </div>
        </div>
  )
}
