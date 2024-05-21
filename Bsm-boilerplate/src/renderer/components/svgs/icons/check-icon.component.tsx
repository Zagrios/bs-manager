import { CSSProperties } from "react";

export function CheckIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40">
            <path fill="currentColor" d="M15.792 29.458q-.292 0-.563-.104-.271-.104-.521-.354l-7.416-7.417q-.459-.458-.459-1.145 0-.688.459-1.146.458-.459 1.104-.459.646 0 1.146.459l6.25 6.291 14.666-14.666q.459-.459 1.125-.459.667 0 1.125.459.459.458.459 1.145 0 .688-.459 1.146L16.917 29q-.25.25-.521.354-.271.104-.604.104Z" />
        </svg>
    );
}
