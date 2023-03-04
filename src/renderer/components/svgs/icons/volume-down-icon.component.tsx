import { CSSProperties } from "react";

export function VolumeDownIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960" fill="currentColor">
            <path d="M251.283 675.999q-13.564 0-22.423-8.859-8.859-8.859-8.859-22.423V507.283q0-13.564 8.859-22.423 8.859-8.859 22.423-8.859h117.179L486.794 357.67q14.769-14.769 33.987-6.91 19.218 7.858 19.218 28.781v392.661q0 21.18-19.218 29.038-19.218 7.859-33.987-6.91L368.462 675.999H251.283Zm374.358 49.949V424.463q43.05 19.102 68.704 60.551 25.654 41.448 25.654 90.986 0 50.205-25.654 90.525-25.654 40.32-68.704 59.423ZM489.744 429.436l-99.129 96.82H270.256v99.488h120.359l99.129 97.23V429.436ZM378.923 576Z"/>
        </svg>
    )
}
