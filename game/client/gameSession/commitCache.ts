import { useRef, useState } from 'react';

export function usePhaseCommitCache<TPayload extends object>() {
  // State mirrors (for React devtools / debugging / persistence across renders)
  const [payloadByKey, setPayloadByKey] = useState<Record<string, TPayload>>({});
  const [nonceByKey, setNonceByKey] = useState<Record<string, string>>({});

  // Refs for same-tick reliability (setState is async)
  const payloadRef = useRef<Record<string, TPayload>>({});
  const nonceRef = useRef<Record<string, string>>({});

  function setCache(key: string, payload: TPayload, nonce: string) {
    payloadRef.current[key] = payload;
    nonceRef.current[key] = nonce;

    setPayloadByKey(prev => ({ ...prev, [key]: payload }));
    setNonceByKey(prev => ({ ...prev, [key]: nonce }));
  }

  function getCache(key: string): { payload?: TPayload; nonce?: string } {
    return {
      payload: payloadRef.current[key] ?? payloadByKey[key],
      nonce: nonceRef.current[key] ?? nonceByKey[key],
    };
  }

  function clearCache(key: string) {
    delete payloadRef.current[key];
    delete nonceRef.current[key];

    setPayloadByKey(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });

    setNonceByKey(prev => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  return {
    // expose mirrors in case the hook needs them (debug/inspection)
    payloadByKey,
    nonceByKey,

    // operations
    setCache,
    getCache,
    clearCache,
  };
}
