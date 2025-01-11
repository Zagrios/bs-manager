import { createSvgIcon } from "../svg-icon.type";

export const ArrowUpwardIcon = createSvgIcon((props, ref) => {
    return (
        <svg
            ref={ref}
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            fill="currentColor"
        >
            <path d="M440-608 324-492q-11 11-28 11t-28-11q-11-11-11-28t11-28l184-184q12-12 28-12t28 12l184 184q11 11 11 28t-11 28q-11 11-28 11t-28-11L520-608v328q0 17-11.5 28.5T480-240q-17 0-28.5-11.5T440-280v-328Z" />
        </svg>
    );
});
