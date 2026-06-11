import { useState, useEffect } from 'react';

/**
 * A custom hook that behaves like useState but persists the value in localStorage.
 * 
 * @param key The key to use in localStorage
 * @param initialState The initial value if no value is found in localStorage
 * @param storageType 'local' or 'session' (defaults to 'session' for navigation persistence)
 */
export function usePersistentState<T>(
    key: string,
    initialState: T,
    storageType: 'local' | 'session' = 'session'
): [T, (value: T | ((val: T) => T)) => void] {
    const storage = storageType === 'local' ? window.localStorage : window.sessionStorage;

    // Initialize state with value from storage or initialState
    const [state, setState] = useState<T>(() => {
        try {
            const item = storage.getItem(key);
            return item ? JSON.parse(item) : initialState;
        } catch (error) {
            console.error(`Error reading persistent state for key "${key}":`, error);
            return initialState;
        }
    });

    // Update storage whenever state changes
    useEffect(() => {
        try {
            storage.setItem(key, JSON.stringify(state));
        } catch (error) {
            console.error(`Error saving persistent state for key "${key}":`, error);
        }
    }, [key, state, storage]);

    return [state, setState];
}
