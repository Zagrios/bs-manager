import { CSSProperties } from "react";

export function RemoveIcon(props: Readonly<{ className?: string; style?: CSSProperties }>) {
    return (
        <svg
            className={props.className}
            style={props.style}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            fill="currentColor"
        >
            <path d="M240-440q-17 0-28.5-11.5T200-480q0-17 11.5-28.5T240-520h480q17 0 28.5 11.5T760-480q0 17-11.5 28.5T720-440H240Z" />
        </svg>
    )
}
