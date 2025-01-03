import { createSvgIcon } from "../svg-icon.type";

export const WarningIcon = createSvgIcon((props, ref) => {
    return (
        <svg ref={ref} {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" fill="currentColor">
            <path d="M80-78q-15 0-27-8t-19-19q-7-11-7.5-25t7.5-28l400-689q8-14 20-20t26-6q14 0 26 6t20 20l400 689q8 14 7.5 28t-7.5 25q-7 11-19 19t-27 8H80Zm401-135q22 0 37.5-15.5T534-266q0-22-15.5-37.5T481-319q-22 0-37.5 15.5T428-266q0 22 15.5 37.5T481-213Zm0-143q22 0 37.5-15.5T534-409v-98q0-22-15.5-37.5T481-560q-22 0-37.5 15.5T428-507v98q0 22 15.5 37.5T481-356Z"/>
        </svg>
    );
})
