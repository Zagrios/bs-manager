import { createSvgIcon } from "../svg-icon.type";

export const EqualIcon = createSvgIcon((props, ref) => {
    return (
        <svg
            ref={ref}
            {...props}
            className={props.className}
            style={props.style}
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 -960 960 960"
            fill="currentColor"
        >
            <path d="M220-280q-25 0-42.5-17.5T160-340q0-25 17.5-42.5T220-400h520q25 0 42.5 17.5T800-340q0 25-17.5 42.5T740-280H220Zm0-280q-25 0-42.5-17.5T160-620q0-25 17.5-42.5T220-680h520q25 0 42.5 17.5T800-620q0 25-17.5 42.5T740-560H220Z" />
        </svg>
    );
});
