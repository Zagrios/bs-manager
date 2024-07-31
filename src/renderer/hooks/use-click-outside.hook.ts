import { ComponentProps, MutableRefObject, useEffect } from "react";

export function useClickOutside(ref: MutableRefObject<any>, handler: ComponentProps<any>["onClick"]) {
    useEffect(() => {
        if (!handler) {
            return () => {};
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target)) {
                handler?.(event);
            }
        };

        document.addEventListener("click", handleClickOutside);
        return () => {
            document.removeEventListener("click", handleClickOutside);
        };
    }, [ref]);
}
