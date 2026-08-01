export type MainPhaseControl =
  | {
      mode: 'ready';
      onActivate: () => void;
    }
  | {
      mode: 'back';
      onActivate: () => void;
    };
