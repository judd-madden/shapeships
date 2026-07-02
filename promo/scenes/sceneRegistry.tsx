import type { ComponentType } from "react";
import { LinesMakeShipsScene } from "./LinesMakeShipsScene";
import { SharedDiceScene } from "./SharedDiceScene";
import { ShipsHavePowersScene } from "./ShipsHavePowersScene";
import { TextOnlyCenteredScene } from "./TextOnlyCenteredScene";
import { TwoTopHeadingsScene } from "./TwoTopHeadingsScene";
import { UpgradeYourShipsBatScene } from "./UpgradeYourShipsBatScene";
import { UpgradeYourShipsScene } from "./UpgradeYourShipsScene";

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
  {
    id: "upgrade-your-ships",
    title: "Upgrade Your Ships",
    component: UpgradeYourShipsScene,
  },
  {
    id: "upgrade-your-ships-bat",
    title: "Upgrade Your Ships — BAT",
    component: UpgradeYourShipsBatScene,
  },
  {
    id: "two-top-headings",
    title: "Two Top Headings",
    component: TwoTopHeadingsScene,
  },
];
