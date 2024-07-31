import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { LaserSlider } from "../laser-slider.component";
import { BsContentTabItem, BsContentTabItemProps } from "./bs-content-tab-item.component";

type Props<T = unknown> = Readonly<{
    className?: string;
    tabs: BsContentTabItemProps<T>[];
    tabIndex: number;
    onTabChange: (index: number, tab: BsContentTabItemProps<T>) => void;
    children: JSX.Element;
}>;

export function BsContentTabPanel({className, tabIndex, tabs, onTabChange, children}: Props) {

    const sliderColor = useThemeColor("second-color");

    return (
        <div className={className ?? "w-full h-full flex flex-row bg-light-main-color-1 dark:bg-main-color-1 rounded-md shadow-black shadow-md overflow-hidden"}>
            <nav className="h-full grid grid-flow-row !rounded-none shadow-sm flex-shrink-0">
                {tabs.map((tab, i) => (
                    <BsContentTabItem
                        key={`${tab.text}${tab.icon}`}
                        {...tab}
                        active={tab.active ?? tabIndex === i}
                        onClick={value => {onTabChange(i, tab); tab.onClick(value);}}
                    />
                ))}
            </nav>
            <LaserSlider className="h-full w-1 relative shrink-0" mode="vertical" color={sliderColor} nbSteps={tabs.length} step={tabIndex}/>
            <div className="flex-grow h-full flex flex-col transition-all duration-300" style={{ translate: `0 ${0 - tabIndex * 100}%` }}>
                {children}
            </div>
        </div>
  )
}
