type NavigatorWithStandalone = Navigator & {
  standalone?: boolean;
};

function matchesMedia(query: string): boolean {
  return window.matchMedia(query).matches;
}

export function attemptMobileGameFullscreen(): void {
  try {
    if (!matchesMedia('(hover: none) and (pointer: coarse)')) {
      return;
    }

    if (document.fullscreenElement) {
      return;
    }

    if (
      matchesMedia('(display-mode: standalone)') ||
      matchesMedia('(display-mode: fullscreen)') ||
      (navigator as NavigatorWithStandalone).standalone === true
    ) {
      return;
    }

    if (!document.fullscreenEnabled) {
      return;
    }

    const requestFullscreen = document.documentElement.requestFullscreen;

    if (!requestFullscreen) {
      return;
    }

    requestFullscreen
      .call(document.documentElement, { navigationUI: 'hide' })
      .catch(() => {
        // Best-effort only: unsupported or denied fullscreen should not affect entry.
      });
  } catch {
    // Best-effort only.
  }
}
