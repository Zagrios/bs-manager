import { createSvgIcon } from "../svg-icon.type";

export const PhilippineIcon = createSvgIcon((props, ref) => {
    return (
        <svg ref={ref} {...props} width="71" height="48" viewBox="0 0 71 48" xmlns="http://www.w3.org/2000/svg">
            <g fill="none">
                <path d="M63.89.12H6.61A6.36 6.36 0 0 0 .25 6.48v17.64h70V6.48A6.36 6.36 0 0 0 63.89.12" fill="#4758A9"/>
                <path d="M.25 40.75a6.36 6.36 0 0 0 6.36 6.36h57.27a6.36 6.36 0 0 0 6.36-6.36V24.12h-70z" fill="#ED5565"/>
                <path d="M2.15 1.95a6.34 6.34 0 0 0-1.9 4.54v34.27a6.34 6.34 0 0 0 1.95 4.57l23.05-21.21z" fill="#FFF"/>
                <circle fill="#F6D660" cx="10.25" cy="23.62" r="4"/>
            </g>
        </svg>
    );
});
