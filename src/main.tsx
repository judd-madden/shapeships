import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const FONT_LOAD_TIMEOUT_MS = 2500;
const FONT_SAMPLE =
  "SHAPESHIPS Free strategy game 1v1 Online Shared dice each turn 10–30 minute games Enter your name Player name PLAY";

async function warmRobotoFonts(): Promise<void> {
  if (
    !("fonts" in document) ||
    typeof document.fonts?.load !== "function"
  ) {
    return;
  }

  await Promise.allSettled([
    document.fonts.load('normal 400 16px "Roboto"', FONT_SAMPLE),
    document.fonts.load('italic 400 16px "Roboto"', FONT_SAMPLE),
  ]);
}

async function revealAppWhenFontsAreReady(): Promise<void> {
  let timeoutId: number | undefined;

  const timeoutPromise = new Promise<void>((resolve) => {
    timeoutId = window.setTimeout(resolve, FONT_LOAD_TIMEOUT_MS);
  });

  try {
    await Promise.race([warmRobotoFonts(), timeoutPromise]);
  } catch {
    // Font loading must never block application startup.
  } finally {
    if (timeoutId !== undefined) {
      window.clearTimeout(timeoutId);
    }

    document.documentElement.classList.add("app-ready");
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

const root = createRoot(rootElement);

flushSync(() => {
  root.render(<App />);
});

void revealAppWhenFontsAreReady();
