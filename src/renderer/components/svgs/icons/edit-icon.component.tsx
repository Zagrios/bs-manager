import { CSSProperties } from "react";

export default function EditIcon(props: { className?: string; style?: CSSProperties }) {
    return (
        <svg className={props.className} style={props.style} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" height="40" width="40">
            <path fill="currentColor" d="M7.833 32.25h1.875L26.75 15.208l-1.875-1.875L7.833 30.375Zm24.959-19.042-5.959-5.916 1.917-1.917q.833-.833 2.042-.833 1.208 0 2.083.875l1.833 1.833q.875.833.854 2.021-.02 1.187-.854 2.021ZM6.542 35.125q-.667 0-1.125-.458-.459-.459-.459-1.125v-3.709q0-.333.104-.604.105-.271.355-.521L24.875 9.25l5.958 5.958-19.458 19.459q-.25.25-.542.354-.291.104-.583.104Zm19.25-20.833-.917-.959 1.875 1.875Z" />
        </svg>
    );
}
