import { CSSProperties } from "react";

export function VolumeDownIcon(props: {className?: string, style?: CSSProperties}) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 96 960 960" fill="currentColor">
            <path d="M229.826 702.696q-16.326 0-27.181-10.855t-10.855-27.022V487.181q0-16.167 10.855-27.101 10.855-10.935 27.181-10.935h125.949l144.928-144.928q17.978-17.819 41.268-8.123 23.29 9.695 23.29 34.978v489.697q0 25.442-23.29 35.137-23.29 9.696-41.268-8.282L355.775 702.696H229.826Zm402.101 41.029V406.942q52.196 18.971 84.24 65.609Q748.21 519.188 748.21 576q0 57.478-32.043 103.036-32.044 45.558-84.24 64.689ZM489.348 427.818l-100.573 97.24H267.703v101.884h121.072l100.573 97.907V427.818ZM377.072 576Z"/>
        </svg>
    )
}
