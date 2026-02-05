import { useState, useEffect, useRef } from 'react';

export const useInactivityTimer = (timeoutMs: number = 300000) => {
    const [isInactive, setIsInactive] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = () => {
        setIsInactive(false);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            setIsInactive(true);
        }, timeoutMs);
    };

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'touchstart', 'click', 'scroll'];
        const handleActivity = () => resetTimer();

        // Debounce slightly to avoid excessive calls? 
        // Actually resetTimer is cheap (clearTimeout/setTimeout interaction).
        // Can throttle if needed, but for now simple is fine.

        events.forEach(event => window.addEventListener(event, handleActivity));
        resetTimer();

        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
            events.forEach(event => window.removeEventListener(event, handleActivity));
        };
    }, [timeoutMs]);

    return { isInactive, reset: resetTimer };
};
