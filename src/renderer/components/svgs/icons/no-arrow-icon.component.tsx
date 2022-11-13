import { CSSProperties } from 'react'

export function NoArrowIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" width="1280" height="1280" viewBox="0 0 1280 1280" fill="currentColor">
            <path d="M926.33,200H353.67C268.8,200,200,268.8,200,353.67v572.67c0,84.87,68.8,153.67,153.67,153.67h572.67  c84.87,0,153.67-68.8,153.67-153.67V353.67C1080,268.8,1011.2,200,926.33,200z M640,824c-100.52,0-182-81.48-182-182  s81.48-182,182-182s182,81.48,182,182S740.52,824,640,824z"/>
        </svg>
    )
}
