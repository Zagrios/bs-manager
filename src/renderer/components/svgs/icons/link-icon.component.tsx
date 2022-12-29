import { CSSProperties } from "react";

export function LinkIcon(props: {className?: string, style?: CSSProperties}) {
  return (
    <svg className={props.className} style={props.style} stroke="currentColor" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" strokeWidth="48" strokeLinecap="round" strokeLinejoin="round">
        <path d="M200.66,352H144a96,96,0,0,1,0-192h55.41"/>
        <path d="M312.59,160H368a96,96,0,0,1,0,192H311.34"/>
        <line x1="169.07" x2="344.93" y1="256" y2="256"/>
    </svg>
  )
}
