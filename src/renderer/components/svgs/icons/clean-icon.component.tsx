import { createSvgIcon } from "../svg-icon.type";

export const CleanIcon = createSvgIcon((props, ref) => {
    return (
        <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"color="currentColor" fill="none" {...props}>
            <path d="m21 3-8 8.5m-3.554-.415c-2.48.952-4.463.789-6.446.003.5 6.443 3.504 8.92 7.509 9.912 0 0 3.017-2.134 3.452-7.193.047-.548.07-.821-.043-1.13-.114-.309-.338-.53-.785-.973-.736-.728-1.103-1.092-1.54-1.184-.437-.09-1.007.128-2.147.565" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M4.5 16.446S7 16.93 9.5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.5 7.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z" stroke="currentColor" strokeWidth="2"/>
            <path d="M11 4v.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
    );
});
