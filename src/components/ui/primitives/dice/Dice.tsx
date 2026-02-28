/**
 * Dice (1-6)
 * Displays dice face images
 * TO DO - Move Assets once we're out of Figma workflow
 */

import { useState, useRef, useEffect } from 'react';
import imgD1 from "figma:asset/1c079466ca4622fc310a4f4ac8a31668545f5746.png";
import imgD2 from "figma:asset/4bd8b8c2966031c9e4cbf7d3b033a13886100b60.png";
import imgD3 from "figma:asset/a16cee3aa31290b8446f22654a82b25c0a85b15f.png";
import imgD4 from "figma:asset/f4cefbd083b166a8239a0a29b3e1634d669d8e03.png";
import imgD5 from "figma:asset/7f932d29011f8a0686994b103e84e580f9dedcd1.png";
import imgD6 from "figma:asset/1efd037aa013abea7a113cc6e3e9a869d374841d.png";

interface DiceProps {
  value: 1 | 2 | 3 | 4 | 5 | 6;
  animateKey?: number;
  className?: string;
}

const diceImages = {
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
