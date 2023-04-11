import { useEffect, useState, useRef } from 'react'

// Code improved from : https://www.npmjs.com/package/use-delayed-state

export function useDelayedState<T = unknown>(initialState: T): [T, (newState: T, delay: number) => void, () => void] {

    const [state, setState] = useState(initialState);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const setStateAfter = (newState: T, delay: number) => {
        if (delay === 0 || delay === undefined) {
            return setState(newState);
        } 
        
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            setState(newState);
            timeoutRef.current = null;
        }, delay);
    }

    const cancelSetState = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null
        }
    }

    useEffect(() => {
        return () => {
            if (timeoutRef.current) { clearTimeout(timeoutRef.current); }
        }
    }, []);

    return [state, setStateAfter, cancelSetState]
}