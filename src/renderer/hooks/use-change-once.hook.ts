import equal from "fast-deep-equal";
import { useEffect, useRef, useState } from "react";

export function useChangeOnce<T = unknown>(initialValue: T, onlyFirstIfTruthy?: boolean): T {
    const [trackedValue, setTrackedValue] = useState<T>(initialValue);
    const didChangeOnceRef = useRef<boolean>(onlyFirstIfTruthy ? !!initialValue : false);

    useEffect(() => {
        if (didChangeOnceRef.current || equal(initialValue, trackedValue)) {
            return;
        }

        setTrackedValue(() => initialValue);
        didChangeOnceRef.current = true;
    }, [initialValue]);

    return trackedValue;
}
