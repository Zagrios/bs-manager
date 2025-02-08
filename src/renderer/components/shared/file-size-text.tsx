import Tippy from "@tippyjs/react";
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

        <Tippy
            content={(isLargeMod ? `This is a very large mod!` : (isMediumMod ? `This is a large mod!` : "") || "")}
            placement="left"
            theme={`${(isLargeMod ? `red` : (isMediumMod ? `yellow` : "") || "")}`}
            className={`${isLargeMod || isMediumMod ? `` : `opacity-0`}`}
            delay={[50, 0]} >
                <span className={`min-w-0 text-center bg-inherit py-2 px-1 text-sm border-t-2 border-b-2 group-hover:brightness-90 ${(isLargeMod ? "text-red-400" : (isMediumMod ? "text-yellow-400" : "") || "")}`} style={wantInfoStyle}>
                    {getFormattedSize()}
                </span>
        </Tippy>
    );
}
