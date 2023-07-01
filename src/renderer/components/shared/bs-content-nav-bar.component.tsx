import { DetailedHTMLProps, Fragment } from "react";
import { BsmIconType } from "../svgs/bsm-icon.component";

type Props<T> = {
    className?: string;
    tabIndex: number;
    tabs: BsContentNavBarTab<T>[];
    renderTab: (props: DetailedHTMLProps<React.HTMLAttributes<any>, any>, tab?: BsContentNavBarTab<T>, activeTab?: BsContentNavBarTab<T>) => JSX.Element;
    onTabChange?: (index: number, tab?: BsContentNavBarTab<T>) => void;
};

export type BsContentNavBarTab<T = unknown> = {
    text: string;
    icon?: BsmIconType;
    extra?: T;
};

export function BsContentNavBar<T>({ className, tabIndex, tabs, renderTab, onTabChange }: Props<T>) {
    const handleTabClick = (index: number) => {
        onTabChange?.(index, tabs[index]);
    };

    return (
        <nav className={`h-full grid grid-flow-row ${className ?? ""}`}>
            {tabs.map((tab, i) => (
                <Fragment key={JSON.stringify(tab)}>{renderTab({ onClick: () => handleTabClick(i) }, tab, tabs[tabIndex])}</Fragment>
            ))}
        </nav>
    );
}
