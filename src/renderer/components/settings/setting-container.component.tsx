import { ReactNode } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";

type Props = {
    id?: string;
    className?: string;
    title?: string;
    minorTitle?: string;
    description?: string;
    children?: ReactNode;
    os?: string;
};

export function SettingContainer({ id, className, title, minorTitle, description, children, os }: Props) {
    const t = useTranslation();

    if (os && os !== window.electron.platform) {
        return undefined;
    }

    return (
        <div id={id} className={className || "relative mb-5"}>
            {title && <h1 className="mb-1 text-2xl font-bold tracking-wide">{t(title)}</h1>}
            {minorTitle && <h2 className="mb-1 font-bold tracking-wide text-gray-600 dark:text-gray-300">{t(minorTitle)}</h2>}
            {description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t(description)}</p>}
            {children}
        </div>
    );
}
