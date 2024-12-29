import { createSvgIcon } from "../svg-icon.type";

export const ItalyIcon = createSvgIcon((props, ref) => {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 5 3" ref={ref} {...props} width="71" height="48">
            <rect width="5" height="3" fill="none" rx="6.64"/>
            <rect width="1.67" height="3" x="0" fill="#008d46"/>
            <rect width="1.67" height="3" x="1.67" fill="#ffffff"/>
            <rect width="1.67" height="3" x="3.34" fill="#ce2b37"/>
        </svg>
    );
});
