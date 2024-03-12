import { createSvgIcon } from "../svg-icon.type";

export const TrashIcon = createSvgIcon((props, ref) => {
    return (
        <svg ref={ref} {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40" fill="currentColor">
            <path d="M10.917 35.667Q9.417 35.667 8.333 34.583Q7.25 33.5 7.25 32V9.375H5.083V5.708H14.208V3.833H25.75V5.708H34.917V9.375H32.75V32Q32.75 33.5 31.667 34.583Q30.583 35.667 29.083 35.667ZM29.083 9.375H10.917V32Q10.917 32 10.917 32Q10.917 32 10.917 32H29.083Q29.083 32 29.083 32Q29.083 32 29.083 32ZM14.833 28.708H18.083V12.625H14.833ZM21.917 28.708H25.167V12.625H21.917ZM10.917 9.375V32Q10.917 32 10.917 32Q10.917 32 10.917 32Q10.917 32 10.917 32Q10.917 32 10.917 32Z" />
        </svg>
    );
});
