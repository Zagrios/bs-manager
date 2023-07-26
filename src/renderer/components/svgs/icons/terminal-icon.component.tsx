import { CSSProperties } from "react";

export function TerminalIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40">
            <path fill="currentColor" d="M6.333 33.375Q5.125 33.375 4.229 32.479Q3.333 31.583 3.333 30.333V9.667Q3.333 8.417 4.229 7.521Q5.125 6.625 6.333 6.625H33.667Q34.875 6.625 35.771 7.521Q36.667 8.417 36.667 9.667V30.333Q36.667 31.583 35.771 32.479Q34.875 33.375 33.667 33.375ZM6.333 30.333H33.667Q33.667 30.333 33.667 30.333Q33.667 30.333 33.667 30.333V13.042H6.333V30.333Q6.333 30.333 6.333 30.333Q6.333 30.333 6.333 30.333ZM20.375 28V25.375H29.667V28ZM12.5 27.875 10.667 26.042 14.958 21.708 10.625 17.375 12.5 15.5 18.667 21.708Z" />
        </svg>
    );
}
