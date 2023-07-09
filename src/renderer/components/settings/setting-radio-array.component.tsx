import { motion } from "framer-motion";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component";

export function SettingRadioArray({ items, selectedItem = items[0].id, onItemSelected }: { items: RadioItem[]; selectedItem?: number; onItemSelected?: (id: number) => void }) {
    const t = useTranslation();

    return (
        <div className="w-full">
            {items.map(i => (
                <div onClick={() => onItemSelected(i.id)} key={i.id} className={`py-3 my-[6px] w-full flex cursor-pointer justify-between items-center rounded-md px-2 transition-colors duration-200 ${i.id === selectedItem ? "bg-light-main-color-3 dark:bg-main-color-3" : "bg-light-main-color-1 dark:bg-main-color-1"}`}>
                    <div className="flex items-center">
                        <div className="h-5 rounded-full aspect-square border-2 border-gray-800 dark:border-white p-[3px] mr-2">
                            <motion.span initial={{ scale: 0 }} animate={{ scale: i.id === selectedItem ? 1 : 0 }} className="h-full w-full block bg-gray-800 dark:bg-white rounded-full" />
                        </div>
                        <h2 className="font-extrabold">{t(i.text)}</h2>
                    </div>
                    {i.icon && (
                        <div className="flex items-center">
                            {i.textIcon && <span className="text-sm">{t(i.textIcon)}</span>}
                            <BsmIcon icon={i.icon} className="max-h-5 w-fit ml-2" />
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}

export interface RadioItem {
    id: number;
    text: string;
    icon?: BsmIconType;
    textIcon?: string;
    value?: any;
}
