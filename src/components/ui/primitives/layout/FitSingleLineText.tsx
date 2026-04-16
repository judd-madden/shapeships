import { useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { cn } from '../../utils';

type FitSingleLineTextProps = {
  text: string;
  maxFontSize: number;
  minFontSize?: number;
  className?: string;
  style?: CSSProperties;
  align?: 'left' | 'center' | 'right';
  as?: 'p' | 'div' | 'span';
  title?: string;
};

const FONT_SIZE_THRESHOLD = 0.25;
const FIT_EPSILON = 0.5;
const FIT_ITERATIONS = 12;

export function FitSingleLineText({
  text,
  maxFontSize,
  minFontSize = 12,
  className,
  style,
  align = 'left',
  as = 'p',
  title,
}: FitSingleLineTextProps) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [fontSize, setFontSize] = useState<number | null>(null);

  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) {
      return;
    }

    const applyFontSize = (nextFontSize: number | null) => {
      outer.style.fontSize = nextFontSize == null ? '' : `${nextFontSize}px`;
    };

    const readBaseFontSize = () => {
      const previousFontSize = outer.style.fontSize;
      outer.style.fontSize = '';
      const computedFontSize = Number.parseFloat(window.getComputedStyle(outer).fontSize);
      outer.style.fontSize = previousFontSize;
      return Number.isFinite(computedFontSize) && computedFontSize > 0 ? computedFontSize : maxFontSize;
    };

    const compute = () => {
      const availableWidth = outer.clientWidth;
      if (availableWidth <= 0) {
        return;
      }

      const baseFontSize = readBaseFontSize();
      const upperBound = Math.min(maxFontSize, baseFontSize);
      const lowerBound = Math.min(minFontSize, upperBound);

      applyFontSize(upperBound);
      const fullSizeWidth = inner.scrollWidth;

      let resolvedFontSize: number | null;

      if (fullSizeWidth <= availableWidth + FIT_EPSILON) {
        resolvedFontSize =
          Math.abs(baseFontSize - upperBound) <= FONT_SIZE_THRESHOLD ? null : upperBound;
      } else {
        let low = lowerBound;
        let high = upperBound;
        let best = lowerBound;

        for (let index = 0; index < FIT_ITERATIONS; index += 1) {
          const mid = (low + high) / 2;
          applyFontSize(mid);

          if (inner.scrollWidth <= availableWidth + FIT_EPSILON) {
            best = mid;
            low = mid;
          } else {
            high = mid;
          }
        }

        resolvedFontSize =
          Math.abs(baseFontSize - best) <= FONT_SIZE_THRESHOLD ? null : Number(best.toFixed(2));
      }

      applyFontSize(resolvedFontSize);
      setFontSize((previousFontSize) => {
        const previousValue = previousFontSize ?? baseFontSize;
        const nextValue = resolvedFontSize ?? baseFontSize;
        return Math.abs(previousValue - nextValue) <= FONT_SIZE_THRESHOLD ? previousFontSize : resolvedFontSize;
      });
    };

    const scheduleCompute = () => {
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
      }

      rafRef.current = window.requestAnimationFrame(() => {
        rafRef.current = null;
        compute();
      });
    };

    scheduleCompute();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleCompute) : null;

    resizeObserver?.observe(outer);

    if (typeof document !== 'undefined' && 'fonts' in document) {
      void document.fonts.ready.then(() => {
        scheduleCompute();
      });
    }

    return () => {
      resizeObserver?.disconnect();

      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [text, maxFontSize, minFontSize]);

  const Component = as;
  const resolvedTitle = title ?? text;
  const alignmentClassName =
    align === 'right'
      ? 'justify-end'
      : align === 'center'
        ? 'justify-center'
        : 'justify-start';

  return (
    <div
      ref={outerRef}
      className={cn('flex min-w-0 overflow-hidden', alignmentClassName, className)}
      style={{
        ...style,
        fontSize: fontSize == null ? style?.fontSize : `${fontSize}px`,
      }}
      title={resolvedTitle}
    >
      <Component
        ref={innerRef as never}
        className="block max-w-full whitespace-nowrap"
      >
        {text}
      </Component>
    </div>
  );
}
