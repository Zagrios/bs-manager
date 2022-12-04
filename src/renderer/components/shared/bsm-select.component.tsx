import { ChangeEvent, CSSProperties } from "react"

type Props = {
    className?: string,
    style?: CSSProperties,
    options?: BsmSelectOption[],
    onChange?: (value: any) => void
}

export function BsmSelect({className, style, options, onChange}: Props) {

    const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
        onChange?.(event.target.value);
    }

    return (
        <select className={className} style={style} onChange={handleChange}>
            {options && options.map(option => (
                <option key={option.value} value={option.value}>{option.text}</option>
            ))}
        </select>
  )
}

export interface BsmSelectOption{
    text: string,
    value: string
}
