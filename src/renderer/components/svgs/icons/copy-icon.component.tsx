import { CSSProperties } from "react";

export function CopyIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40">
            <path fill="currentColor" d="M13.625 31.167q-1.292 0-2.229-.917-.938-.917-.938-2.25V6q0-1.292.938-2.229.937-.938 2.229-.938h17q1.333 0 2.25.938.917.937.917 2.229v22q0 1.333-.917 2.25t-2.25.917Zm0-3.167h17V6h-17v22Zm-5.917 9.125q-1.333 0-2.25-.937-.916-.938-.916-2.23V11.083q0-.666.458-1.104.458-.437 1.125-.437t1.125.437q.458.438.458 1.104v22.875h17.584q.666 0 1.125.459.458.458.458 1.125 0 .666-.458 1.125-.459.458-1.125.458ZM13.625 6v22V6Z" />
        </svg>
    );
}
