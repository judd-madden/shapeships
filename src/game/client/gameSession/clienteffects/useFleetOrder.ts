import { useEffect, useState } from 'react';
import type { ShipDefId } from '../../types/ShipTypes.engine';

export function useFleetOrder(params: {
  myFleetIds: ShipDefId[];
  opponentFleetIds: ShipDefId[];
}) {
  const { myFleetIds, opponentFleetIds } = params;

  const [myFleetOrder, setMyFleetOrder] = useState<ShipDefId[]>([]);
  const [opponentFleetOrder, setOpponentFleetOrder] = useState<ShipDefId[]>([]);

  useEffect(() => {
    setMyFleetOrder((prev) => {
      const newIds = myFleetIds.filter((id) => !prev.includes(id));
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });

    setOpponentFleetOrder((prev) => {
      const newIds = opponentFleetIds.filter((id) => !prev.includes(id));
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });
  }, [myFleetIds, opponentFleetIds]);

  return { myFleetOrder, opponentFleetOrder, setMyFleetOrder, setOpponentFleetOrder };
}
