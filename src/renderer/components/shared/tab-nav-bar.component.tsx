import { DetailedHTMLProps, Fragment } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type Props = {
    tabIndex: number
    tabsText: string[],
    onTabChange: (index: number) => void,
    className?: string,
    renderTab?: (props: DetailedHTMLProps<React.HTMLAttributes<any>, any>, text: string, index?: number) => JSX.Element
}

export function TabNavBar(props: Props) {

    const currentIndex = props.tabIndex ?? 0;

    const t = useTranslation();
    const secondColor = useThemeColor("second-color");

    const selectTab = (index: number) => {
        props.onTabChange(index);
    }

    return (
        <nav className={`relative h-8 shrink-0 cursor-pointer rounded-md overflow-hidden shadow-md shadow-black bg-light-main-color-2 dark:bg-main-color-2 ${props.className}`}>
            <div className="absolute w-full h-1 bottom-0" style={{color: secondColor}}>  
                <span className="absolute h-full w-full bg-current brightness-50" />
                <span className="absolute h-full block bg-current transition-transform duration-300 shadow-center shadow-current" style={{transform: `translate(${currentIndex * 100}%, 0)`, width: `calc(100% / ${props.tabsText.length})`}}/>
            </div>
            <ul className="grid" style={{gridTemplateColumns: `repeat(${props.tabsText.length}, minmax(0, 1fr))`}}>
                {props.tabsText.map((text, index) => (
                        props.renderTab ? (
                            <Fragment key={text}>
                                {props.renderTab({onClick: () => selectTab(index)}, t(text), index)}
                            </Fragment>
                        ) : (
                            <li className="px-4 h-full text-center text-gray-800 dark:text-gray-200 text-lg font-bold hover:backdrop-brightness-75" key={text} onClick={() => selectTab(index)}>{t(text)}</li>
                        )
                    
                ))}
            </ul>
        </nav>
  )
}
