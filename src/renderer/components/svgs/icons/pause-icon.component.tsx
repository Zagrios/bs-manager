import { CSSProperties } from "react";

export function PauseIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" height="40" width="40" viewBox="0 0 40 40" fill="currentColor">
            <path d="M24.958 32.167q-1.291 0-2.229-.917-.937-.917-.937-2.25V11q0-1.333.937-2.25.938-.917 2.229-.917H29q1.333 0 2.25.917t.917 2.25v18q0 1.333-.917 2.25t-2.25.917Zm-13.958 0q-1.333 0-2.25-.917T7.833 29V11q0-1.333.917-2.25T11 7.833h4.042q1.291 0 2.229.917.937.917.937 2.25v18q0 1.333-.937 2.25-.938.917-2.229.917Z" />
        </svg>
    );
}
