import { forwardRef, LegacyRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { BsmIconType, BsmIcon } from "../svgs/bsm-icon.component";
import { BsmButton, BsmButtonType } from "./bsm-button.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { AnimatePresence } from "framer-motion";
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";
import { cn } from "renderer/helpers/css-class.helpers";

export interface DropDownItem {
    text: string;
    icon?: BsmIconType;
    onClick?: () => void;
}

type ClassNames = {
    mainContainer?: string;
    button?: string;
    itemsContainer?: string;
    iconClassName?: string;
}

type Props = {
    className?: string;
    classNames?: ClassNames;
    buttonColor?: BsmButtonType;
    items?: DropDownItem[];
    align?: "left" | "right" | "center";
    withBar?: boolean;
    icon?: BsmIconType;
    buttonClassName?: string;
    menuTranslationY?: string | number;
    children?: JSX.Element;
    text?: string;
    textClassName?: string;
    maxVisibleItems?: number;
};

export const BsmDropdownButton = forwardRef(({ className, classNames, buttonColor, items, align, withBar = true, icon = "settings", buttonClassName, menuTranslationY, children, text, textClassName, maxVisibleItems }: Props, fowardRed) => {
    const [expanded, setExpanded] = useState(false);
    const t = useTranslation();
    const ref = useRef(fowardRed);
    useClickOutside(ref, () => setExpanded(false));

    const itemRef = useRef<HTMLDivElement>(null);

    const [itemHeight, setItemHeight] = useState<number>();
    const maxHeight = itemHeight && maxVisibleItems ? itemHeight * maxVisibleItems + 8 : undefined;
    useEffect(() => {
        if (itemRef.current) {
            setItemHeight(itemRef.current.offsetHeight);
        }
    }, [items]);

    useImperativeHandle(
        fowardRed,
        () => ({
            close() {
                setExpanded(() => false);
            },
            open() {
                setExpanded(() => true);
            },
        }),
        []
    );

    const defaultButtonClassName = "relative z-[1] p-1 rounded-md text-inherit w-full h-full shadow-md shadow-black";

    const handleClickOutside = () => {
        if (children) {
            return;
        }
        setExpanded(false);
    };

    const alignClass = (() => {
        if (align === "center") {
            return "right-1/2 origin-top-right translate-x-[50%]";
        }
        if (align === "left") {
            return "left-0 origin-top-left";
        }
        return "right-0 origin-top-right";
    })();

    return (
        <div ref={ref as unknown as LegacyRef<HTMLDivElement>} className={cn(className, classNames?.mainContainer)} >
            <BsmButton onClick={() => setExpanded(!expanded)} className={cn(buttonClassName ?? defaultButtonClassName, classNames?.button)} icon={icon} active={expanded} textClassName={textClassName} onClickOutside={handleClickOutside} withBar={withBar} text={text} typeColor={buttonColor} iconClassName={classNames?.iconClassName}/>
            <div className={cn(`py-1 w-fit absolute cursor-pointer top-[calc(100%-4px)] rounded-md bg-inherit text-sm text-gray-800 dark:text-gray-200 shadow-md shadow-black transition-[scale] duration-150 ease-in-out ${alignClass} overflow-y-auto scrollbar-thin `, classNames?.itemsContainer)} style={{ scale: expanded ? "1" : "0", translate: `0 ${menuTranslationY}`, maxHeight}}>
                {items?.map(
                    (i, index) =>
                        i && (
                            <div ref={index === 0 ? itemRef : undefined} key={crypto.randomUUID()} onClick={() => { setExpanded(() => false); i.onClick?.()}} className="flex w-full px-3 py-2 hover:backdrop-brightness-150">
                                {i.icon && <BsmIcon icon={i.icon} className="h-5 w-5 mr-1 text-inherit" />}
                                <span className="w-max">{t(i.text)}</span>
                            </div>
                        )
                )}
            </div>
            {!!children && <AnimatePresence>{expanded && children}</AnimatePresence>}
        </div>
    );
});
