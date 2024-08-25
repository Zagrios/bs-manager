import { BsmIcon, BsmIconType } from "../svgs/bsm-icon.component";
import { useRef, CSSProperties, MouseEvent, forwardRef, useCallback, ComponentProps } from "react";
import { BsmImage } from "./bsm-image.component";
import { useTranslation } from "renderer/hooks/use-translation.hook";
import { useClickOutside } from "renderer/hooks/use-click-outside.hook";
import { useThemeColor } from "renderer/hooks/use-theme-color.hook";
import { getCorrectTextColor } from "renderer/helpers/correct-text-color";
import Tippy from "@tippyjs/react";

export type BsmButtonType = "primary" | "secondary" | "success" | "cancel" | "error" | "none";

type Props = {
    className?: string;
    style?: CSSProperties;
    iconStyle?: CSSProperties;
    imgClassName?: string;
    iconClassName?: string;
    icon?: BsmIconType;
    image?: string;
    text?: string;
    type?: string;
    active?: boolean;
    withBar?: boolean;
    disabled?: boolean;
    onClickOutside?: ComponentProps<"div">["onClick"];
    onClick?: ComponentProps<"div">["onClick"];
    typeColor?: BsmButtonType;
    color?: string;
    title?: string;
    iconColor?: string;
    textClassName?: string;
    tooltip?: string;
    tooltipIcon?: BsmIconType;
};

export const BsmButton = forwardRef<unknown, Props>(({
    className, style, iconStyle, imgClassName, iconClassName,
    icon, image, text, type, active, withBar = true, disabled,
    onClickOutside, onClick,
    typeColor, color, title, iconColor, textClassName,
    tooltip, tooltipIcon
}, forwardedRef) => {
    const t = useTranslation();
    const { firstColor, secondColor } = useThemeColor();
    const ref = useRef<HTMLDivElement>(null);

    const setRef = useCallback((node: HTMLDivElement) => {
        if (ref.current) {
            ref.current = node;
        }

        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
            forwardedRef.current = node;
        }
    }, [forwardedRef]);

    useClickOutside(ref, onClickOutside);

    const primaryColor = (() => {
        if (typeColor === "primary") {
            return firstColor;
        }
        if (typeColor === "secondary") {
            return secondColor;
        }
        return undefined;
    })();

    const textColor = (() => {
        if (primaryColor) {
            return getCorrectTextColor(primaryColor);
        }
        return typeColor && typeColor !== "none" ? "white" : undefined;
    })();

    const renderTypeColor = (() => {
        if (!typeColor) {
            return `bg-light-main-color-2 dark:bg-main-color-2 ${!withBar && !disabled && "hover:brightness-125"}`;
        }
        if (typeColor === "cancel") {
            return "bg-gray-500";
        }
        if (typeColor === "error") {
            return "bg-red-500";
        }
        if (typeColor === "success") {
            return "bg-green-500";
        }
        return "";
    })();

    const handleClick = (e: MouseEvent<HTMLDivElement>) => !disabled && onClick?.(e);

    const renderTooltip = () => {
        return (
            <Tippy
                className="!bg-main-color-1"
                content={t(tooltip)}
                delay={[300, 0]}
                arrow={false}
            >
                <div className="h-[20px] w-[20px] p-1.5 rounded-full cursor-help bg-light-main-color-1 dark:bg-main-color-3 hover:brightness-110">
                    <BsmIcon className="w-full h-full" icon={tooltipIcon || "info"} />
                </div>
            </Tippy>
        );
    }

    return (
        <div ref={setRef} onClick={handleClick} title={t(title)} className={`${className} overflow-hidden group ${!withBar && !disabled && (!!typeColor || !!color) && "hover:brightness-[1.15]"} ${disabled ? "brightness-75 cursor-not-allowed" : "cursor-pointer"} ${renderTypeColor}`} style={{ ...style, backgroundColor: primaryColor || color }}>
            {image && <BsmImage image={image} className={imgClassName} />}
            {icon && <BsmIcon icon={icon} className={iconClassName ?? "size-full text-gray-800 dark:text-white"} style={{ ...(iconStyle ?? {}), color: (iconColor || textColor) }} />}
            {text &&
                (type === "submit" ? (
                    <button type="submit" className={`h-full flex items-center justify-center gap-x-2 ${!textClassName && "size-full"}`} style={{ ...(!!textColor && { color: textColor }) }}>
                        <span className={textClassName}>{t(text)}</span>
                        {tooltip && renderTooltip()}
                    </button>
                ) : (
                    <span className="h-full flex items-center justify-center gap-x-2" style={{ ...(!!textColor && { color: `${textColor}` }) }}>
                        <span className={textClassName}>{t(text)}</span>
                        {tooltip && renderTooltip()}
                    </span>
                ))}
            {withBar && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-current" style={{ color: secondColor }}>
                    <div className="absolute top-0 left-0 size-full bg-current brightness-50" />
                    <div className={`absolute top-0 left-0 size-full bg-inherit -translate-x-full group-hover:translate-x-0 transition-transform shadow-center shadow-current ${active && "translate-x-0"}`} />
                </div>
            )}
        </div>
    );
});
