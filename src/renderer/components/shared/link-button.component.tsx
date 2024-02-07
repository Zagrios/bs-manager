import { motion } from "framer-motion";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { BsmIcon } from "../svgs/bsm-icon.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { FolderLinkState } from "renderer/services/version-folder-linker.service";
import React from "react";

export type LinkBtnProps = {
    className?: string;
    title?: string;
    state: FolderLinkState;
    onClick?: () => unknown;
};

export function LinkButton({className, title, state, onClick}: LinkBtnProps) {
    const t = useTranslation();

    const color = useThemeColor("first-color");
    const disabled = state === FolderLinkState.Processing || state === FolderLinkState.Pending;

    const btnColor = () => {
        switch (state) {
            case FolderLinkState.Linked:
                return color;
            case FolderLinkState.Pending:
            case FolderLinkState.Processing:
                return "orange";
            case FolderLinkState.Unlinked:
                return "red";
            default:
                return "red";
        }
    }

    const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.preventDefault();
        e.stopPropagation();
        if(disabled){ return; }
        onClick?.();
    }

    return (
        <motion.div
            variants={{ hover: { rotate: 22.5 }, tap: { rotate: 45 } }}
            whileHover="hover"
            whileTap="tap"
            initial={{ rotate: 0 }}
            className={className}
            title={title ? t(title) : null}
            onClick={handleClick}
            style={{ pointerEvents: disabled ? "none" : "auto" }}
            tabIndex={-1}
        >
            <span className="absolute top-0 left-0 h-full w-full rounded-full brightness-50 opacity-75 dark:opacity-20 dark:filter-none" style={{ backgroundColor: btnColor() }} />
            <BsmIcon className="p-1 absolute top-0 left-0 h-full w-full !bg-transparent -rotate-45 brightness-150" icon={state === FolderLinkState.Linked ? "link" : "unlink"} style={{ color: btnColor() }} />
        </motion.div>
    );
}
