// src/components/ui/primitives/dice/Dice.tsx
import { useEffect, useRef, useState } from "react";

import imgD1 from "../../../../graphics/global/d1.png";
import imgD2 from "../../../../graphics/global/d2.png";
import imgD3 from "../../../../graphics/global/d3.png";
import imgD4 from "../../../../graphics/global/d4.png";
import imgD5 from "../../../../graphics/global/d5.png";
import imgD6 from "../../../../graphics/global/d6.png";

const diceImages: Record<1 | 2 | 3 | 4 | 5 | 6, string> = {
    1: imgD1,
    2: imgD2,
    3: imgD3,
    4: imgD4,
    5: imgD5,
    6: imgD6,
};


interface DiceProps {
    value: 1 | 2 | 3 | 4 | 5 | 6;
    animateKey?: number;
    className?: string;

    // NEW (optional): rotation feature toggle + tuning
    enableRotate?: boolean;
    rotateMaxDeg?: number; // e.g. 45
}

const ROLL_MS = 1000;
const STEP_MS = 180;

export function Dice({
    value,
    animateKey,
    className = "",
    enableRotate = true,
    rotateMaxDeg = 45,
}: DiceProps) {
    const [displayValue, setDisplayValue] = useState<1 | 2 | 3 | 4 | 5 | 6>(value);
    const [isRolling, setIsRolling] = useState(false);
    const [rollRotateDeg, setRollRotateDeg] = useState(0);

    const prevAnimateKeyRef = useRef<number | undefined>(animateKey);
    const isMountedRef = useRef(false);

    const timersRef = useRef<{ timeouts: number[]; finalTimeoutId: number | null }>({
        timeouts: [],
        finalTimeoutId: null,
    });

    function clearTimers() {
        for (const id of timersRef.current.timeouts) clearTimeout(id);
        timersRef.current.timeouts = [];

        if (timersRef.current.finalTimeoutId != null) {
            clearTimeout(timersRef.current.finalTimeoutId);
            timersRef.current.finalTimeoutId = null;
        }
    }

    useEffect(() => {
        // First mount: no animation
        if (!isMountedRef.current) {
            isMountedRef.current = true;
            setDisplayValue(value);
            prevAnimateKeyRef.current = animateKey;
            return;
        }

        const animateKeyChanged = animateKey !== prevAnimateKeyRef.current;
        prevAnimateKeyRef.current = animateKey;

        // Only animate when animateKey changes.
        if (!animateKeyChanged) {
            // Still keep displayValue in sync if server updates it.
            setDisplayValue(value);
            return;
        }

        clearTimers();

        // Optional rotate per-roll
        if (enableRotate) {
            const max = Math.max(0, rotateMaxDeg);
            const deg = (Math.random() * (max * 2) - max);
            setRollRotateDeg(deg);
        } else {
            setRollRotateDeg(0);
        }

        const steps = 10;

        // Build a deterministic sequence of faces to show (no repeats, avoid final)
        const seq: Array<1 | 2 | 3 | 4 | 5 | 6> = [];
        let prev = displayValue;

        for (let i = 0; i < steps; i++) {
            let next = (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
            while (next === prev || next === value) {
                next = (Math.floor(Math.random() * 6) + 1) as 1 | 2 | 3 | 4 | 5 | 6;
            }
            seq.push(next);
            prev = next;
        }

        setIsRolling(true);

        // Immediate first face
        setDisplayValue(seq[0]);

        // Schedule the remaining faces with a fixed cadence
        for (let i = 1; i < seq.length; i++) {
            const t = window.setTimeout(() => {
                setDisplayValue(seq[i]);
            }, i * STEP_MS);

            timersRef.current.timeouts.push(t);
        }

        // Final settle + stop pulse
        timersRef.current.finalTimeoutId = window.setTimeout(() => {
            clearTimers();
            setDisplayValue(value);
            setIsRolling(false);
        }, ROLL_MS);

        return () => clearTimers();
    }, [value, animateKey, enableRotate, rotateMaxDeg]);

    return (
        <div className={["relative size-[164px]", className].join(" ")}>
            {/* Pulse layer (only when rolling) */}
            <div className={isRolling ? "absolute inset-0 ss-dice-roll-pulse" : "absolute inset-0"}>
                {/* Spin layer (always) */}
                <div className={enableRotate ? "absolute inset-0 ss-dice-slow-spin" : "absolute inset-0"}>
                    {([1, 2, 3, 4, 5, 6] as const).map((face) => (
                        <img
                            key={face}
                            alt=""
                            src={diceImages[face]}
                            className="absolute inset-0 max-w-none object-50%-50% object-cover pointer-events-none size-full"
                            style={{ opacity: displayValue === face ? 1 : 0 }}
                            loading="eager"
                            decoding="async"
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}