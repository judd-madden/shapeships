import { useLayoutEffect, useRef } from 'react';

function deriveStableRenderOrder(previousOrder: string[], currentKeys: string[]): string[] {
  const currentKeySet = new Set(currentKeys);
  const retained = previousOrder.filter((renderKey) => currentKeySet.has(renderKey));
  const retainedSet = new Set(retained);
  const appended = currentKeys.filter((renderKey) => !retainedSet.has(renderKey));
  const nextOrder = [...retained, ...appended];

  if (
    nextOrder.length === previousOrder.length &&
    nextOrder.every((renderKey, index) => renderKey === previousOrder[index])
  ) {
    return previousOrder;
  }

  return nextOrder;
}

export function useFleetOrder(params: {
  myFleetRenderKeys: string[];
  opponentFleetRenderKeys: string[];
}) {
  const { myFleetRenderKeys, opponentFleetRenderKeys } = params;

  const prevMyOrderRef = useRef<string[]>([]);
  const prevOpponentOrderRef = useRef<string[]>([]);

  const myFleetRenderOrder = deriveStableRenderOrder(
    prevMyOrderRef.current,
    myFleetRenderKeys
  );
  const opponentFleetRenderOrder = deriveStableRenderOrder(
    prevOpponentOrderRef.current,
    opponentFleetRenderKeys
  );

  useLayoutEffect(() => {
    prevMyOrderRef.current = myFleetRenderOrder;
    prevOpponentOrderRef.current = opponentFleetRenderOrder;
  }, [myFleetRenderOrder, opponentFleetRenderOrder]);

  return { myFleetRenderOrder, opponentFleetRenderOrder };
}
