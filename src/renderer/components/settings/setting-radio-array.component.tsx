import { motion } from "framer-motion";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { CSSProperties } from "react"

type Props<T> = {
    id?: HTMLDivElement["id"];
    items: RadioItem<T>[];
    selectedItemId?: number;
    selectedItemValue?: T;
    direction?: CSSProperties["flexDirection"],
    onItemSelected?: (item: RadioItem<T>) => void
};

export function SettingRadioArray<T>({ id, items, selectedItemId, selectedItemValue, onItemSelected, direction = "column" }: Props<T>) {
    const t = useTranslation();

    const isSelected = (item: RadioItem<T>) => {
        return item.id === selectedItemId || item.value === selectedItemValue;
    }

    const half = Math.ceil(items.length / 2);
    const firstHalf = items.slice(0, half);
    const secondHalf = items.slice(half);

    const renderItem = (i: RadioItem<T>) => {
        return (
            <div onClick={() => onItemSelected(i)} key={i.id} className={`py-3 w-full flex cursor-pointer justify-between items-center rounded-md px-2 transition-colors duration-300 ${isSelected(i) ? "bg-light-main-color-3 dark:bg-main-color-3" : "bg-light-main-color-1 dark:bg-main-color-1"} ${i.className}`}>
                <div className="flex items-center">
                    <div className="h-5 rounded-full aspect-square border-2 border-gray-800 dark:border-white p-[3px] mr-2">
                        <motion.span initial={{ scale: 0 }} animate={{ scale: isSelected(i) ? 1 : 0 }} className="h-full w-full block bg-gray-800 dark:bg-white rounded-full" />
                    </div>
                    <h2 className="font-extrabold text-nowrap">{t(i.text)}</h2>
                </div>
                {i.icon && (
                    <div className="flex items-center text-right">
                        {i.textIcon && <span className="text-xs">{t(i.textIcon)}</span>}
                        {i.icon}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div id={id} className="w-full flex gap-1.5">
            <div className="w-full flex flex-col gap-1.5">
                {firstHalf.map(renderItem)}
            </div>
            <div className="w-full flex flex-col gap-1.5">
                {secondHalf.map(renderItem)}
            </div>
        </div>
    );
}

export interface RadioItem<T> {
    id: number;
    text: string;
    icon?: JSX.Element;
    textIcon?: string;
    className?: string;
    value?: T;
}
