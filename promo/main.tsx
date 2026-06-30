import { createRoot } from "react-dom/client";
import "./promo.css";
import { PromoStage } from "./scenes/PromoStage";
import { sceneRegistry } from "./scenes/sceneRegistry";

function PromoApp() {
  const sceneId = new URLSearchParams(window.location.search).get("scene");

  if (!sceneId) {
    return (
      <main>
        <h1>Promo scenes</h1>
        <ul>
          {sceneRegistry.map((scene) => (
            <li key={scene.id}>
              <a href={`?scene=${encodeURIComponent(scene.id)}`}>
                {scene.title}
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const selectedScene = sceneRegistry.find((scene) => scene.id === sceneId);

  if (!selectedScene) {
    return (
      <main>
        <p>Scene not found.</p>
        <a href="./index.html">Back to scene index</a>
      </main>
    );
  }

  const SceneComponent = selectedScene.component;

  return (
    <PromoStage>
      <SceneComponent />
    </PromoStage>
  );
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Promo root element #root was not found");
}

createRoot(rootElement).render(<PromoApp />);
