import equal from "fast-deep-equal";
import { ComponentProps, MouseEvent, useRef, useState } from "react";
import { MSModel } from "shared/models/models/model-saber.model";
import { BsmImage } from "../shared/bsm-image.component";
import { motion } from "framer-motion";
import { GlowEffect } from "../shared/glow-effect.component";
import { MODELS_TYPE_MS_PAGE_ROOT, MODEL_SABER_URL } from "shared/models/models/constants";
import { BsmLink } from "../shared/bsm-link.component";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import Tippy from "@tippyjs/react";
import { followCursor } from "tippy.js";
import defaultImage from "../../../../assets/images/default-version-img.jpg";
import { BsmLocalModel } from "shared/models/models/bsm-local-model.interface";
import { BsmIconType } from "../svgs/bsm-icon.component";
import { BsmButton } from "../shared/bsm-button.component";
import { BsmBasicSpinner } from "../shared/bsm-basic-spinner/bsm-basic-spinner.component";
import { isValidUrl } from "shared/helpers/url.helpers";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import useDoubleClick from "use-double-click";
import { useDelayedState } from "renderer/hooks/use-delayed-state.hook";
import { ChevronTopIcon } from "../svgs/icons/chevron-top-icon.component";
import { typedMemo } from "renderer/helpers/typed-memo";

type Props<T> = {
    selected?: boolean;
    hash: string;
    id?: number;
    isDownloading?: boolean;
    callbackValue?: T;
    hideNsFw?: boolean;
    onDelete?: (value: T) => void;
    onDownload?: (value: T) => void;
    onCancelDownload?: (value: T) => void;
    onDoubleClick?: (value: T) => void;
} & Partial<MSModel> &
    Partial<BsmLocalModel> &
    Omit<ComponentProps<"li">, "id" | "onDoubleClick">;

function ModelItemElement<T = unknown>(props: Props<T>) {
    const t = useTranslation();
    const color = useThemeColor("first-color");
    const [hovered, setHovered] = useState(false);
    const [infosHovered, setInfosHovered] = useDelayedState(false);
    const [idContentCopied, setIdContentCopied] = useState<string>(null);
    const ref = useRef();

    const isNsfw = (() => {
        if (!props.hideNsFw) {
            return false;
        }

        const tags = props.tags?.map(tag => tag.toLowerCase()) ?? [];
        const name = props.name.toLowerCase() ?? "";
        return (
            tags.includes("nsfw") ||
            tags.includes("18+") ||
            name.includes("nsfw") ||
            name.includes("18+") ||
            name.includes("nude") ||
            name.includes("naked") ||
            name.includes("lewd")
        );
    })();

    useDoubleClick({
        ref,
        latency: props.onDoubleClick ? 200 : 0,
        onSingleClick: e => props?.onClick?.(e as unknown as MouseEvent<HTMLLIElement>),
        onDoubleClick: () => props?.onDoubleClick?.(props.callbackValue),
    });

    const modelPageUrl = (() => {
        if (!props.id) {
            return null;
        }
        const url = new URL(MODELS_TYPE_MS_PAGE_ROOT[props.type], MODEL_SABER_URL);
        url.searchParams.set("id", props.id.toString());
        return url.toString();
    })();

    const authorPageUrl = (() => {
        if (!props.discord) {
            return null;
        }
        const url = new URL("Profile", MODEL_SABER_URL);
        url.searchParams.set("user", props.discord.toString());
        return url.toString();
    })();

    const thumbnailUrl = (() => {
        if (!props.thumbnail) {
            return null;
        }
        if (isValidUrl(props.thumbnail)) {
            return props.thumbnail;
        }
        const [file, ext] = props.thumbnail.split(".");
        return `${props.download.split("/").slice(0, -1).join("/")}/${file}.${ext.toLowerCase()}`;
    })();

    const modelTags = (() => {
        if (!props.tags) {
            return null;
        }
        return [...new Set(props.tags)];
    })();

    const actionButtons = (): { id: number; icon: BsmIconType; action: () => void; iconColor?: string }[] => {
        const buttons: { id: number; icon: BsmIconType; action: () => void; iconColor?: string }[] = [];

        if (props.onDownload && !props.onCancelDownload) {
            buttons.push({ id: 0, icon: "download", action: () => props.onDownload(props.callbackValue) });
        }

        if (props.onDelete) {
            buttons.push({ id: 1, icon: "trash", action: () => props.onDelete(props.callbackValue) });
        }

        if (props.onCancelDownload) {
            buttons.push({ id: 2, icon: "cross", action: () => props.onCancelDownload(props.callbackValue), iconColor: "red" });
        }

        return buttons;
    };

    const copyContent = (value: string, id?: string) => {
        navigator.clipboard.writeText(value);
        setIdContentCopied(() => id);
        setTimeout(() => {
            setIdContentCopied(() => null);
        }, 700);
    };

    return (
        <motion.li className={`relative flex-grow min-w-[16rem] h-64 cursor-pointer text-gray-200 ${props.className ?? ""}`} onHoverStart={() => setHovered(() => true)} onHoverEnd={() => setHovered(() => false)}>
            <GlowEffect visible={props.selected || hovered} />
            <div className="absolute top-0 left-0 w-full h-full rounded-lg overflow-hidden blur-none bg-black shadow-sm shadow-black">
                <div ref={ref} className="contents">
                    <BsmImage className="absolute top-0 left-0 w-full h-full object-cover brightness-50 scale-[200%] blur-md" image={thumbnailUrl} placeholder={defaultImage} loading="lazy" />
                    <BsmImage className="absolute top-0 left-1/2 -translate-x-1/2 max-w-[20rem] w-full h-full object-cover" image={thumbnailUrl} placeholder={defaultImage} loading="lazy" style={isNsfw && {filter: "blur(10px)"}} />
                    <div className="absolute top-0 right-0 h-full w-0 flex flex-col items-end gap-1 pt-1.5 pr-1.5">
                        {!props.isDownloading ? (
                            actionButtons().map((button, index) => (
                                <BsmButton
                                    key={button.id}
                                    className="w-8 h-8 p-1 rounded-md transition-transform duration-150 shadow-black shadow-sm"
                                    style={{ transitionDelay: `${index * 50}ms`, transform: hovered ? "translate(0%)" : "translate(150%)" }}
                                    icon={button.icon}
                                    iconColor={button.iconColor}
                                    onClick={e => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        button.action();
                                    }}
                                    withBar={false}
                                />
                            ))
                        ) : (
                            <BsmBasicSpinner className="w-7 h-7 p-1 rounded-md bg-main-color-2 flex items-center justify-center shadow-black shadow-sm" spinnerClassName="brightness-200" thikness="3.5px" style={{ color }} />
                        )}
                    </div>
                </div>
                <motion.div
                    className="absolute left-0 w-full h-full px-2 flex flex-col gap-1.5 bg-main-color-3 bg-opacity-60 backdrop-blur-md transition-all group cursor-default"
                    onClick={e => {
                        e.stopPropagation();
                        e.preventDefault();
                    }}
                    onHoverStart={() => setInfosHovered(true, 150)}
                    onHoverEnd={() => setInfosHovered(false, 150)}
                    style={{ top: infosHovered ? "0" : "83%" }}
                >
                    <div className="w-full flex justify-center items-center mt-1.5">
                        <BsmLink className={`block grow overflow-hidden font-bold whitespace-nowrap text-ellipsis ${props.id ? "cursor-pointer hover:underline" : ""}`} href={modelPageUrl}>
                            {props.name}
                        </BsmLink>
                        <ChevronTopIcon className="shrink-0 h-8 group-hover:rotate-180 transition-transform w-fit cursor-pointer" onClick={() => setInfosHovered(false, 0)} />
                    </div>
                    <BsmLink className={`block w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis brightness-200 ${authorPageUrl ? "cursor-pointer hover:underline" : ""}`} style={{ color }} href={authorPageUrl}>
                        {props.author ?? ""}
                    </BsmLink>
                    <ul className="flex flex-row flex-wrap gap-1">
                        {modelTags?.map(tag => (
                            <li key={tag} className="inline-block mr-1 text-xs bg-white text-black px-1 rounded-full p-0.5">
                                {tag}
                            </li>
                        ))}
                    </ul>
                    <Tippy placement="top" content={idContentCopied === "hash" ? t("misc.copied") : t("misc.copy")} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                        <span className="mt-0.5 cursor-copy block w-full max-w-fit overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${props.hash}`, "hash")}>
                            {props.hash}
                        </span>
                    </Tippy>
                    <div className="flex gap-1">
                        {!!props.id && (
                            <Tippy placement="top" content={idContentCopied === "id" ? t("misc.copied") : t("misc.copy")} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                <span className="cursor-copy w-fit shrink-0 max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 uppercase text-xs" onClick={() => copyContent(`${props.id}`, "id")}>
                                    {props.id}
                                </span>
                            </Tippy>
                        )}
                        {props.path && (
                            <Tippy placement="top" content={idContentCopied === "path" ? t("misc.copied") : t("misc.copy")} followCursor="horizontal" plugins={[followCursor]} hideOnClick={false}>
                                <span className="cursor-copy w-fit max-w-full overflow-hidden whitespace-nowrap text-ellipsis bg-main-color-1 rounded-md p-1 text-xs" onClick={() => copyContent(`${props.path}`, "path")}>
                                    {props.path}
                                </span>
                            </Tippy>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.li>
    );
}

export const ModelItem = typedMemo(ModelItemElement, equal);
