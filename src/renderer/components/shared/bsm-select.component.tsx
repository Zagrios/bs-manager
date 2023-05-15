import { ComponentProps } from "react"
import { useTranslation } from "renderer/hooks/use-translation.hook"

type Props<T> = Omit<ComponentProps<"select">, "onChange"> & {
    options?: BsmSelectOption<T>[],
    onChange?: (value: T) => void,
}

export function BsmSelect<T = unknown>({className, style, options, onChange}: Props<T>) {

    const t = useTranslation();

    const handleChange: ComponentProps<"select">["onChange"] = (e) => {
        e.preventDefault();
        onChange?.(options?.[parseInt(e.target.value)]?.value);
    }

    return (
        <select className={className} style={style} onChange={handleChange}>
            {options && options.map((option, index) => (
                <option key={index} value={index}>{t(option.text)}</option>
            ))}
        </select>
  )
}

export interface BsmSelectOption<T>{
    text: string,
    value: T
}
