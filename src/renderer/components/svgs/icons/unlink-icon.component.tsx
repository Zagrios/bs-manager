import { CSSProperties } from "react";

export function UnlinkIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="48">
            <path d="M200.66,352H144a96,96,0,0,1,0-192h55.41"/>
            <path d="M312.59,160H368a96,96,0,0,1,0,192H311.34"/>
        </svg>
    )
}
