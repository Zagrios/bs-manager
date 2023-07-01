import equal from "fast-deep-equal";
import { ComponentProps } from "react"
import { useTranslation } from "renderer/hooks/use-translation.hook"

type Props<T> = Omit<ComponentProps<"select">, "onChange"> & {
    options?: BsmSelectOption<T>[],
    selected?: T,
    onChange?: (value: T) => void,
}

export function BsmSelect<T = unknown>(props: Props<T>) {

    const t = useTranslation();

    const handleChange: ComponentProps<"select">["onChange"] = (e) => {
        e.preventDefault();
        props.onChange?.(props.options?.[parseInt(e.target.value)]?.value);
    }

    return (
        <select {...props} onChange={handleChange} defaultValue={props.options?.findIndex(opt => equal(opt.value, props.selected))}>
            {props.options?.map((option, index) => (
                <option key={JSON.stringify(option)} value={index}>{t(option.text)}</option>
            ))}
        </select>
  )
}

export interface BsmSelectOption<T>{
    text: string,
    value: T
}
