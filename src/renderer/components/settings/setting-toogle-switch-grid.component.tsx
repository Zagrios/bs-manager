import { ToogleSwitch } from "../shared/toogle-switch.component";

type Item = {
    text: string;
    desc?: string;
    checked?: boolean;
    onChange?: (isChecked: boolean) => void|Promise<void>;
};

type Props = {
    items: Item[];
};

export function SettingToogleSwitchGrid({ items }: Readonly<Props>) {

    const handleItemChange = (item: Item, state: boolean) => {
        item.onChange?.(state);
    };

    return (
        <div className="flex flex-col gap-1.5">
            {items.map((item) => (
                <div key={item.text} className="flex justify-between items-center bg-theme-1 py-2 px-3 rounded-md gap-5">
                    <div className="flex flex-col justify-center gap-px grow">
                        <h2 className="font-bold">{item.text}</h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
                    </div>
                    <ToogleSwitch checked={item.checked} className="shrink-0 h-7 w-12" onChange={checked => handleItemChange(item, checked)}/>
                </div>
            ))}
        </div>
    )
}
