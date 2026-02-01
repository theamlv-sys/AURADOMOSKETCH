import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { User } from '@supabase/supabase-js';

// Configuration
const SYNC_INTERVAL_MS = 1000;

export const useCreditSystem = (user: User | null, userTier: string | null) => {
    // UI State (For Rendering)
    const [credits, setCredits] = useState<number>(0);
    const [isBurning, setIsBurning] = useState(false);
    const [burnRate, setBurnRate] = useState(0);

    // Source of Truth (Mutable Ref to avoid closure staleness)
    const creditRef = useRef<number>(0);
    const lastSavedRef = useRef<number>(0);
    const timerRef = useRef<any>(null);
    const syncTimerRef = useRef<any>(null);

    const [isLoaded, setIsLoaded] = useState(false);

    // 1. Load Credits on Login/Tier Change
    useEffect(() => {
        if (!user) {
            setCredits(0);
            creditRef.current = 0;
            setIsLoaded(false);
            return;
        }

        const fetchCredits = async () => {
            const { data, error } = await supabase
                .from('users')
                .select('credits')
                .eq('id', user.id)
                .single();

            if (data && data.credits !== null) {
                const val = Number(data.credits); // Ensure number
                console.log('[CreditSystem] Loaded:', val);
                creditRef.current = val;
                lastSavedRef.current = val;
                setCredits(val);
                setIsLoaded(true); // Mark as loaded
            }
        };

        fetchCredits();
    }, [user]);

    // 2. Sync Logic (Backend API)
    const syncToBackend = useCallback(async (force = false) => {
        if (!user || !isLoaded) return; // BLOCK SYNC IF NOT LOADED

        const current = creditRef.current;
        const last = lastSavedRef.current;

        // Skip if no change (unless forced)
        if (!force && Math.abs(current - last) < 0.01) return;

        // Optimistic Update
        lastSavedRef.current = current;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // console.log('[CreditSystem] Syncing:', current);

            // Use Beacon API for ultra-reliable logout sync if creating a raw request,
            // but here we use fetch. 
            // Note: For 'pagehide' we might need sendBeacon,            // console.log('[CreditSystem] Syncing:', current);

            // Round to integer for database compatibility (credits column is INTEGER type)
            const roundedCredits = Math.round(current);

            await fetch('http://localhost:3001/api/sync-credits', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ credits: roundedCredits })
            });

        } catch (err) {
            console.error('[CreditSystem] Sync Failed:', err);
            // Revert optimistic update? No, keep trying next time.
        }
    }, [user, isLoaded]); // FIXED: Added isLoaded dependency

    // 3. Burn Timer (High Precision)
    useEffect(() => {
        if (isBurning && burnRate > 0 && user) {
            timerRef.current = setInterval(() => {
                // Decrement Ref
                const deductionPerTick = burnRate / 60; // Rate is per minute, tick is 1s
                // Ensure we don't go below 0
                if (creditRef.current <= 0) {
                    creditRef.current = 0;
                    setCredits(0);
                    setIsBurning(false); // Stop burning
                } else {
                    creditRef.current -= deductionPerTick;
                    setCredits(creditRef.current); // Update UI
                }
            }, 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
        }

        return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }, [isBurning, burnRate, user]);

    // 4. Sync Interval
    useEffect(() => {
        if (user) {
            syncTimerRef.current = setInterval(() => syncToBackend(), SYNC_INTERVAL_MS);
        }
        return () => { if (syncTimerRef.current) clearInterval(syncTimerRef.current); };
    }, [user, syncToBackend]);

    // 5. Public Methods
    const startBurn = (ratePerMinute: number) => {
        setBurnRate(ratePerMinute);
        setIsBurning(true);
    };

    const stopBurn = () => {
        setIsBurning(false);
        syncToBackend(true); // Force sync on stop
    };

    const deduct = (amount: number) => {
        if (creditRef.current < amount) return false;
        creditRef.current -= amount;
        setCredits(creditRef.current);
        syncToBackend(true); // Force sync immediately
        return true;
    };

    const forceSave = async () => {
        if (isLoaded) await syncToBackend(true);
    };

    return {
        credits,
        startBurn,
        stopBurn,
        deduct,
        forceSave,
        isLoaded
    };
};
