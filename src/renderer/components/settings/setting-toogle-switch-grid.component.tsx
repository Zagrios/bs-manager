import { useId } from "react";
import { ToogleSwitch } from "../shared/toogle-switch.component";

export type Item = {
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
                <SettingToggleSwitchItem key={item.text} item={item} onChange={checked => handleItemChange(item, checked)}/>
            ))}
        </div>
    )
}

function SettingToggleSwitchItem({ item, onChange }: Readonly<{ item: Item; onChange: (checked: boolean) => void }>) {
    const id = useId();
    const titleId = `${id}-title`;
    const descriptionId = `${id}-description`;

    return (
        <div className="flex justify-between items-center bg-theme-1 py-2 px-3 rounded-md gap-5">
            <div className="flex flex-col justify-center gap-px grow">
                <h2 id={titleId} className="font-bold">{item.text}</h2>
                <p id={descriptionId} className="text-sm text-gray-600 dark:text-gray-400">{item.desc}</p>
            </div>
            <ToogleSwitch ariaLabelledBy={titleId} ariaDescribedBy={descriptionId} checked={item.checked} className="shrink-0 h-7 w-12" onChange={onChange}/>
        </div>
    );
}
