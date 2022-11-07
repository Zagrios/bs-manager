import { CSSProperties } from "react";

export function PlayIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" height="40" width="40" viewBox="0 0 40 40" fill="currentColor">
            <path d="M15.458 30.542q-.791.541-1.604.083-.812-.458-.812-1.417V10.625q0-.958.812-1.417.813-.458 1.604.084l14.625 9.291q.75.5.75 1.355 0 .854-.75 1.312Z"/>
        </svg>
    )
}
