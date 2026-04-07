import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root was not found");
}

const root = createRoot(rootElement);

flushSync(() => {
  root.render(<App />);
});

document.documentElement.classList.add("app-ready");
