import { ReactNode } from "react";

export function SettingContainer({className, title, minorTitle, description, children}: {className?: string, title?: string, minorTitle?: string, description?: string, children?: ReactNode}) {
  return (
    <div className={className || "relative mb-5"}>
        { title && <h1 className="font-bold text-2xl mb-1 tracking-wide">{title}</h1> }
        { minorTitle && <h2 className="font-bold mb-1 tracking-wide text-gray-400">{minorTitle}</h2> }
        { description && <p className="mb-3 text-sm text-gray-400">{description}</p> }
        { children }
    </div>
  )
}
