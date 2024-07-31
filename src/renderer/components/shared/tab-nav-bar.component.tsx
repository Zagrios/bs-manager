import { DetailedHTMLProps, Fragment, HTMLAttributes } from "react";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { LaserSlider } from "./laser-slider.component";

type Props = {
    tabIndex: number;
    tabsText: string[];
    onTabChange: (index: number) => void;
    className?: string;
    renderTab?: (props: DetailedHTMLProps<HTMLAttributes<any>, any>, text: string, index?: number) => JSX.Element;
};

export function TabNavBar(props: Props) {
    const currentIndex = props.tabIndex ?? 0;

    const t = useTranslation();
    const secondColor = useThemeColor("second-color");

    const selectTab = (index: number) => {
        props.onTabChange(index);
    };

    return (
        <nav className={`relative h-8 shrink-0 cursor-pointer rounded-md overflow-hidden shadow-md shadow-black bg-light-main-color-2 dark:bg-main-color-2 ${props.className}`}>
            <LaserSlider className="absolute w-full h-1 bottom-0" mode="horizontal" color={secondColor} nbSteps={props.tabsText.length} step={currentIndex} />
            <ul className="grid" style={{ gridTemplateColumns: `repeat(${props.tabsText.length}, minmax(0, 1fr))` }}>
                {props.tabsText.map((text, index) =>
                    props.renderTab ? (
                        <Fragment key={text}>{props.renderTab({ onClick: () => selectTab(index) }, t(text), index)}</Fragment>
                    ) : (
                        <li className="px-4 h-full text-center text-gray-800 dark:text-gray-200 text-lg font-bold hover:backdrop-brightness-75" key={text} onClick={() => selectTab(index)}>
                            {t(text)}
                        </li>
                    )
                )}
            </ul>
        </nav>
    );
}
