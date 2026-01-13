/**
 * Action Panel Scroll Area
 * 
 * The ONLY vertical scrolling region inside an ActionPanel.
 * Enforces consistent padding and scrollbar affordance.
 * 
 * LAYOUT CONTRACT:
 * - Padding: 20px (top) / 20px (left) / 20px (bottom) / 36px (right - scrollbar space)
 * - Scrolling: overflow-y auto, overflow-x hidden
 * - Height: Fills available height of ActionPanelFrame
 * 
 * USAGE RULES:
 * 1. ActionPanelFrame → ActionPanelScrollArea → Panel Content
 * 2. Species panels MUST NOT implement their own scrolling or padding
 * 3. Absolute positioning inside catalogues is relative to scroll area's inner content box
 */

import type React from 'react';

interface ActionPanelScrollAreaProps {
  children: React.ReactNode;
}

export function ActionPanelScrollArea({ children }: ActionPanelScrollAreaProps) {
  return (
    <div 
      className="size-full overflow-y-auto overflow-x-hidden flex justify-center"
      style={{
        paddingTop: '20px',
        paddingLeft: '20px',
        paddingBottom: '20px',
        paddingRight: '36px',
      }}
    >
      {children}
    </div>
  );
}