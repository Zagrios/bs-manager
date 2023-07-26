import { CSSProperties } from "react";

export function CloseIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40">
            <path fill="currentColor" d="m20 22.208-8.417 8.417q-.458.458-1.104.458-.646 0-1.104-.458-.458-.458-.458-1.104 0-.646.458-1.104L17.792 20l-8.417-8.417q-.458-.458-.458-1.104 0-.646.458-1.104.458-.458 1.104-.458.646 0 1.104.458L20 17.792l8.417-8.417q.458-.458 1.104-.458.646 0 1.104.458.458.458.458 1.104 0 .646-.458 1.104L22.208 20l8.417 8.417q.458.458.458 1.104 0 .646-.458 1.104-.458.458-1.104.458-.646 0-1.104-.458Z" />
        </svg>
    );
}
