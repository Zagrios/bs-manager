import { CSSProperties } from "react";

export function UkraineIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480"  className={props.className} style={props.style}>
    <g fill-rule="evenodd" stroke-width="1">
        <path fill="#ffd700" d="M0 0h640v480H0z" />
        <path fill="#0057b8" d="M0 0h640v240H0z" />
    </g>
</svg>
    );
}
