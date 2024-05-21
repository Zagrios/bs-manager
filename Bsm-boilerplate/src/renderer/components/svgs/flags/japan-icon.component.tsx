import { CSSProperties } from "react";

export function JapanIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="71px" height="48px" viewBox="0 0 71 48" version="1.1" className={props.className} style={props.style}>
            <defs />
            <g id="Flags" stroke="none" strokeWidth="1" fill="none" fillRule="evenodd" transform="translate(-239,-805)">
                <g transform="translate(70,70)" fillRule="nonzero" id="Russian">
                    <g transform="translate(169,735)">
                        <g id="Bolivia-9">
                            <path d="M 0.5 7 L 0.5 41 L 70.5 41 L 70.5 7 C 70.5 3.3 67.5 0.4 63.9 0.4 L 7.2 0.4 C 5.4 0.4 3.7 1.1 2.5 2.3 C 1.2 3.5 0.5 5.2 0.5 7 Z" id="Shape" fill="#ffffff" /> <polygon id="Shape" fill="#fff" points="0.5,33.0 70.5,33.0 70.5,15.0 0.5,15.0" />
                            <path d="M 0.5 40.8 C 0.5 44.4 3.5 47.4 7.2 47.4 L 63.9 47.4 C 67.5 47.4 70.5 44.4 70.5 40.8 L 70.5 31.8 L 0.5 31.8 L 0.5 40.8 Z" id="Shape" fill="#ffffff" />
                            <circle cx="35.5" cy="24" r="15" fill="#ec5565" />
                        </g>
                    </g>
                </g>
            </g>
        </svg>
    );
}

export default JapanIcon;
