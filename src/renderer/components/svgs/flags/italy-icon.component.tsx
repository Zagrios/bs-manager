import { createSvgIcon } from "../svg-icon.type";

export const ItalyIcon = createSvgIcon((props, ref) => {
    return (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 71 48" ref={ref} {...props} width="71" height="48">
                <g fill="none">
                    <path d="M6.65.53A6.36 6.36 0 0 0 .29 6.89v34.27a6.36 6.36 0 0 0 6.36 6.36h17v-47z" fill="#57A863"/>
                    <path d="M23.63.53v47H47v-47z" fill="#FFF"/>
                    <path d="M63.92.53H47v47h16.92a6.36 6.36 0 0 0 6.36-6.36V6.89A6.36 6.36 0 0 0 63.92.53" fill="#ED5565"/>
                </g>
            </svg>
    );
});
