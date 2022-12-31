import { CSSProperties } from "react";

export function FilterIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">
            <path fill="currentColor" d="M18.333 33.333q-.708 0-1.187-.479-.479-.479-.479-1.187v-10L6.792 9.083q-.584-.75-.167-1.583.417-.833 1.375-.833h24q.958 0 1.375.833.417.833-.167 1.583l-9.875 12.584v10q0 .708-.479 1.187-.479.479-1.187.479ZM20 21.375l9.417-11.917H10.583Zm0 0Z"/>
        </svg>
    )
}
