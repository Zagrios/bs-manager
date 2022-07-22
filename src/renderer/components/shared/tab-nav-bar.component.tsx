import { useEffect, useRef, useState } from "react";
import { DefaultConfigKey } from "renderer/config/default-configuration.config";
import { useObservable } from "renderer/hooks/use-observable.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { ConfigurationService } from "renderer/services/configuration.service";

export function TabNavBar(props: {tabsText: string[], onTabChange: Function, className?: string}) {

    const configService = ConfigurationService.getInstance();

    const [currentTabIndex, setCurrentTabIndex] = useState(0);
    const tabsWrapper = useRef(null);
    const [tabsWidth, setTabsWidth] = useState(0);
    const t = useTranslation();
    const secondColor = useObservable(configService.watch("second-color" as DefaultConfigKey));

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
        <div className="absolute w-full h-1 bottom-0" style={{color: secondColor}}>  
          <span className="absolute h-full w-full bg-current brightness-50" />
          <span className="absolute h-full block bg-current transition-transform duration-300" style={{transform: `translate(${currentTabIndex * 100}%, 0)`, width: `${tabsWidth}px`}}/>
          <span className="fixed h-1 block shadow-center bg-transparent shadow-current transition-transform duration-300" style={{transform: `translate(${currentTabIndex * 100}%, 0)`, width: `${tabsWidth}px`}}></span>
        </div>
        <div ref={tabsWrapper} className="grid" style={{gridTemplateColumns: `repeat(${props.tabsText.length}, minmax(0, 1fr))`}}>
            { props.tabsText.map((y, index) => 
                <span className="pr-4 pl-4 h-full inline-block bg-light-main-color-2 text-gray-800 dark:bg-main-color-2 dark:text-gray-200 text-lg font-bold text-center hover:bg-light-main-color-1 dark:hover:bg-main-color-1" key={index} onClick={() => selectYear(y)}>{t(y)}</span>
            )}
        </div>
        
      </div>
  )
}
