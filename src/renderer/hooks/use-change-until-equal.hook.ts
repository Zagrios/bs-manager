import equal from "fast-deep-equal";
import { useEffect, useRef, useState } from "react";

type Options<T = unknown> = {
    untilEqual: T;
}

export function useChangeUntilEqual<T = unknown>(variableValue: T, { untilEqual }: Options<T> ): T {
    const [value, setValue] = useState(variableValue);

    const untilEqualRef = useRef(untilEqual);
    const hasBeenEqual = useRef(false);

    useEffect(() => {

        if(hasBeenEqual.current) {
            return;
        }

        const isEqual = equal(variableValue, untilEqualRef.current);

        if(!isEqual){
            return setValue(variableValue);
        }

        hasBeenEqual.current = true;
        setValue(variableValue);
    }, [variableValue]);

    return value;
}
