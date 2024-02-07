import equal from "fast-deep-equal";
import { useEffect, useRef, useState } from "react";

type Options<T = unknown> = {
    untilEqual: T;
    emitOnEqual?: boolean;
}

export function useChangeUntilEqual<T = unknown>(variableValue: T, { untilEqual, emitOnEqual }: Options<T>): T {
    const [value, setValue] = useState(variableValue);

    const untilEqualRef = useRef(untilEqual);
    const emitOnEqualRef = useRef(emitOnEqual);
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

        if(emitOnEqualRef.current) {
            setValue(variableValue);
        }
    }, [variableValue]);

    return value;
}
