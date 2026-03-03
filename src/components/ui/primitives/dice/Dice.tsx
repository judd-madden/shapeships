/**
 * Dice (1-6)
 * Displays dice face images
 */

import { useState, useRef, useEffect } from 'react';

import imgD1 from "../../../../graphics/global/d1.png";
import imgD2 from "../../../../graphics/global/d2.png";
import imgD3 from "../../../../graphics/global/d3.png";
import imgD4 from "../../../../graphics/global/d4.png";
import imgD5 from "../../../../graphics/global/d5.png";
import imgD6 from "../../../../graphics/global/d6.png";

interface DiceProps {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    animateKey?: number;
    className?: string;
}

const diceImages: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
    1: imgD1,
    2: imgD2,
    3: imgD3,
    4: imgD4,
    5: imgD5,
    6: imgD6,
};

export function Dice({ value, animateKey, className = "" }: DiceProps) {
    const [displayValue, setDisplayValue] = useState<1 | 2 | 3 | 4 | 5 | 6>(value);
    const [isRolling, setIsRolling] = useState(false);
    const prevAnimateKeyRef = useRef<number | undefined>(animateKey);
    const isMountedRef = useRef(false);

    useEffect(() => {
        // On first mount: set displayValue without animation
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            setDisplayValue(value);
            prevAnimateKeyRef.current = animateKey;
            return;
        }

        // Check if animateKey or value changed
        const animateKeyChanged = animateKey !== prevAnimateKeyRef.current;
        const valueChanged = value !== displayValue;

        if (!animateKeyChanged && !valueChanged) {
            return;
        }

        // Update prev ref
        prevAnimateKeyRef.current = animateKey;

        // Start roll animation
        setIsRolling(true);

        // Flick through random values every ~130ms
        const flickInterval = setInterval(() => {
            setDisplayValue((Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6);
        }, 130);

        // After 900ms: stop animation and show final value
        const stopTimeout = setTimeout(() => {
            clearInterval(flickInterval);
            setDisplayValue(value);
            setIsRolling(false);
        }, 900);

        return () => {
            clearInterval(flickInterval);
            clearTimeout(stopTimeout);
        };
    }, [value, animateKey, displayValue]);

    return (
        <div
            className={`relative size-[164px] ${isRolling ? 'ss-dice-roll-bounce' : ''} ${className}`}
        >
            <img
                alt={`Dice ${displayValue}`}
                className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full"
                src={diceImages[displayValue]}
            />
        </div>
    );
}