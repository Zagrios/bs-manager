import { CSSProperties } from "react";

type Props = {
    fileSize?: number;
    wantInfoStyle: CSSProperties;
}

export function FileSizeText({ fileSize, wantInfoStyle }: Props) {

    const verifyFileSize = fileSize !== undefined;

    const isMediumMod = verifyFileSize && fileSize > 1024 * 1024 * 50; // 50MB

    const isLargeMod = verifyFileSize && fileSize > 1024 * 1024 * 100; // 100MB

    const getFormattedSize = () : string => {
        if (!verifyFileSize)
            return `-`;
        if (fileSize < 1024 * 1024)
            return `${(fileSize/1024).toFixed(2)}KB`;
        return `${(fileSize/1024/1024).toFixed(2)}MB`;
    };

    return (
        <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover/mod:brightness-90 ${(isLargeMod ? "text-red-400 group/tooltip" : (isMediumMod ? "text-yellow-400 group/tooltip" : "") || "")}`} style={wantInfoStyle}>
                {getFormattedSize()}
                <span className={`opacity-0 group-hover/tooltip:opacity-100 text-center py-[5px] px-0 rounded-[6px] top-[7%] right-[105%] transition-opacity duration-500 absolute bg-black after:absolute after:top-[50%] after:left-full after:-mt-[5px] after:border-5 after:border-solid after:border-t-transparent after:border-r-transparent after:border-b-transparent after:border-l-black ${(isLargeMod ? `w-[160px] text-red-400` : (isMediumMod ? `w-[140px] text-yellow-400` : "") || "")}`}>
                    {(isLargeMod ? `This is a very large mod!` : (isMediumMod ? `This is a large mod!` : "") || "")}
                </span>
            </span>
    );
}
