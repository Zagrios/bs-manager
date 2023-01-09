import { CSSProperties } from "react";

export function Mee6Icon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style}  xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 40 40">
            <path fill="#60D1F6" d="M20 40c11.046 0 20-8.954 20-20S31.046 0 20 0 0 8.954 0 20s8.954 20 20 20z"></path>
            <path fill="#17181E" fill-rule="evenodd" d="M13.636 25.394c1.85-.538 4.03-.848 6.365-.848 2.333 0 4.512.31 6.363.847-.472 3.123-3.141 5.516-6.364 5.516s-5.893-2.393-6.364-5.515z" clip-rule="evenodd"></path>
            <mask id="mask0" width="14" height="7" x="13" y="24" maskUnits="userSpaceOnUse">
                <path fill="#fff" fill-rule="evenodd" d="M13.636 25.394c1.85-.538 4.03-.848 6.365-.848 2.333 0 4.512.31 6.363.847-.472 3.123-3.141 5.516-6.364 5.516s-5.893-2.393-6.364-5.515z" clip-rule="evenodd"></path>
            </mask>
            <g mask="url(#mask0)">
                <path fill="#F90043" d="M20 35.151c2.929 0 5.303-1.662 5.303-3.712 0-2.05-2.374-3.712-5.303-3.712s-5.303 1.662-5.303 3.712c0 2.05 2.374 3.712 5.303 3.712z"></path>
            </g>
            <path fill="#17181E" d="M13.182 18.182a2.273 2.273 0 100-4.546 2.273 2.273 0 000 4.546zM26.818 18.182a2.273 2.273 0 100-4.546 2.273 2.273 0 000 4.546z"></path>
        </svg>
    )
}
