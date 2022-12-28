import { CSSProperties } from "react"
import "./bsm-basic-spinner.component.css"

type Props = {
    className?: string,
    style?: CSSProperties,
    spinnerClassName?: string,
    thikness?: string
}

export function BsmBasicSpinner({className, style, spinnerClassName, thikness = "5px"}: Props) {
  return (
    <div className={className} style={style}>
        <span className={`${spinnerClassName} loader`} style={{border: `${thikness} solid currentColor`, borderBottomColor: "transparent"}}/>
    </div>
  )
}
