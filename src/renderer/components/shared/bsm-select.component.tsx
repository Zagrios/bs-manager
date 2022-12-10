import { ChangeEvent, CSSProperties } from "react"
import { useTranslation } from "renderer/hooks/use-translation.hook"

type Props = {
    className?: string,
    style?: CSSProperties,
    options?: BsmSelectOption[],
    onChange?: (value: string) => void
}

export function BsmSelect({className, style, options, onChange}: Props) {

    const t = useTranslation();

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        onChange?.(event.target.value);
    }

    return (
        <select className={className} style={style} onChange={handleChange}>
            {options && options.map(option => (
                <option key={option.value} value={option.value}>{t(option.text)}</option>
            ))}
        </select>
  )
}

export interface BsmSelectOption{
    text: string,
    value: string
}
