import { createSvgIcon } from "../svg-icon.type";

export const BrazilIcon = createSvgIcon((props, ref) => {
    return (
        <svg ref={ref} {...props} width="71" height="48" viewBox="0 0 71 48" xmlns="http://www.w3.org/2000/svg">
            <g fill="none"><rect fill="#52C162" x=".15" y=".13" width="70" height="47" rx="6.36"/>
                <path fill="#F6D660" d="m7.93 23.63 27.21-21 27.21 21-27.21 21z"/>
                <path d="M31 18.55c-2.83 0-5.612.737-8.07 2.14a12.56 12.56 0 0 0 23.44 8.59A16.41 16.41 0 0 0 31 18.55" fill="#4758A9"/>
                <path d="M31 18.55a16.41 16.41 0 0 1 15.37 10.73 12.5 12.5 0 0 0 1-2.87C42.964 17.945 32.834 14.23 24 17.84a12.5 12.5 0 0 0-1.06 2.85A16.3 16.3 0 0 1 31 18.55" fill="#FFF"/>
                <path d="M47.4 26.42A12.57 12.57 0 0 0 24 17.84c8.848-3.633 19.005.09 23.41 8.58z" fill="#4758A9"/>
            </g>
        </svg>
    );
});
