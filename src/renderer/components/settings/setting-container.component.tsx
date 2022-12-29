import { ReactNode } from "react";
import { useTranslation } from "renderer/hooks/use-translation.hook";

export function SettingContainer({className, title, minorTitle, description, children}: {className?: string, title?: string, minorTitle?: string, description?: string, children?: ReactNode}) {

  const t = useTranslation();

  return (
    <div className={className || "relative mb-5"}>
        { title && <h1 className="font-bold text-2xl mb-1 tracking-wide">{t(title)}</h1> }
        { minorTitle && <h2 className="font-bold mb-1 tracking-wide text-gray-600 dark:text-gray-300">{t(minorTitle)}</h2> }
        { description && <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{t(description)}</p> }
        { children }
    </div>
  )
}
