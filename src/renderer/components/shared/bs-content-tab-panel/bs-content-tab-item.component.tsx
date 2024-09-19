import { MouseEventHandler } from "react";
import { LinkBtnProps, LinkButton } from "renderer/components/shared/link-button.component";
import { SvgIcon } from "renderer/components/svgs/svg-icon.type";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export type BsContentTabItemProps<T = unknown> = {
    text: string;
    icon: SvgIcon;
    active?: boolean;
    value?: T;
    linkProps?: LinkBtnProps;
    onClick: (value?: T) => void;
};

type BsContentTabItemComponent<T = unknown> = ({text, icon, active, value, linkProps, onClick}: BsContentTabItemProps<T>) => JSX.Element;

export const BsContentTabItem: BsContentTabItemComponent = ({ text, icon: Icon, active, value, linkProps, onClick }) => {

    const t = useTranslation();

    const handleClick: MouseEventHandler<HTMLLIElement> = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(value);
    }

    return (
        <li className={`relative w-full cursor-pointer text-center font-bold flex justify-center items-center content-center px-7 bg-theme-2 hover:bg-theme-1 rounded-l-md ${active && "!bg-theme-1"}`} onClick={handleClick}>
            <div className="flex flex-col gap-0.5 justify-start items-center text-main-color-1 dark:text-gray-200">
                <Icon className="size-7"/>
                <span className=" font-thin italic text-xs">{t(text)}</span>
            </div>
            {linkProps && (
                <div className="absolute top-1.5 left-1.5">
                    <LinkButton
                        state={linkProps.state}
                        className={linkProps.className ?? "block w-6 h-6 aspect-square blur-0 cursor-pointer hover:brightness-75"}
                        title={linkProps.title}
                        onClick={linkProps.onClick}
                    />
                </div>
            )}
        </li>
    );
}
