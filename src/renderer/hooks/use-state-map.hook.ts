import { useEffect, useState } from "react";

export function useStateMap<T = unknown, U = unknown>(value: T, map: (value: T, mappedValue: U) => U, defaultValue?: U): U {

    const [mappedValue, setMappedValue] = useState(defaultValue ?? map(value, defaultValue));

    useEffect(() => {
        setMappedValue(map(value, mappedValue));
    }, [value, map]);

    return mappedValue;

}
