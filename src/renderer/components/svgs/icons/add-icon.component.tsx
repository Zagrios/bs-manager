import { CSSProperties } from "react";

export function AddIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
            <path fill="currentColor" d="M17.833 32.458V22.167H7.542v-4.334h10.291V7.542h4.334v10.291h10.291v4.334H22.167v10.291Z"/>
        </svg>
    ) 
  }