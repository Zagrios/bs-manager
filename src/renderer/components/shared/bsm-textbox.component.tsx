import { useTranslation } from "renderer/hooks/use-translation.hook";


type Props = Readonly<{
    className?: string;
    value?: string;
    tabIndex?: number;
    label?: string;
    labelClassName?: string;
    description?: string;
    descriptionClassName?: string;
    inputClassName?: string;
    onChange?: (val: string) => void;
}>;


export function BsmTextbox({
    className, value,
    tabIndex,
    label, labelClassName,
    description, descriptionClassName,
    inputClassName,
    onChange,
}: Props) {

    const t = useTranslation();

    return (
        <div className={className || "mb-3"}>
            {label &&
                <h1 className={labelClassName || "mb-1 text-2xl font-bold tracking-wide"}>
                    {t(label)}
                </h1>
            }

            {description &&
                <h1 className={descriptionClassName || "mb-1 font-bold tracking-wide text-gray-600 dark:text-gray-300"}>
                    {t(description)}
                </h1>
            }

            <input
                type="text"
                className={inputClassName || "h-full w-full rounded-full px-2 py-1 bg-light-main-color-1 dark:bg-main-color-1"}
                value={value}
                onChange={e => {
                    if (!onChange) {
                        return;
                    }

                    e.preventDefault();
                    onChange(e.target.value)
                }}
                tabIndex={tabIndex}
            />
        </div>
    )
}
