import type { ComponentType } from "react";
import { LinesMakeShipsScene } from "./LinesMakeShipsScene";
import { SharedDiceScene } from "./SharedDiceScene";
import { ShipsHavePowersScene } from "./ShipsHavePowersScene";
import { TextOnlyCenteredScene } from "./TextOnlyCenteredScene";

export interface PromoSceneDefinition {
  id: string;
  title: string;
  component: ComponentType;
}

export const sceneRegistry: readonly PromoSceneDefinition[] = [
  {
    id: "text-only-centered",
    title: "Text Only Centered",
    component: TextOnlyCenteredScene,
  },
  {
    id: "shared-dice",
    title: "Shared Dice",
    component: SharedDiceScene,
  },
  {
    id: "lines-make-ships",
    title: "Lines Make Ships",
    component: LinesMakeShipsScene,
  },
  {
    id: "ships-have-powers",
    title: "Ships Have Powers",
    component: ShipsHavePowersScene,
  },
];
