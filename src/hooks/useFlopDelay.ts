import { useEffect, useState } from 'react';

import { FLOP_DELAY_MS } from '@/game/config';

/** True once `over` has been true for FLOP_DELAY_MS; false again as soon as `over` is. */
export function useFlopDelay(over: boolean): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!over) return;
    const t = setTimeout(() => setReady(true), FLOP_DELAY_MS);
    return () => {
      clearTimeout(t);
      setReady(false);
    };
  }, [over]);
  return ready;
}
