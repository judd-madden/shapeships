declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
  readTextFile(path: URL): Promise<string>;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

Deno.test('head polling remains isolated from clock presentation', async () => {
  const [clockPresentationSource, networkingSource, gameSessionSource] =
    await Promise.all([
      Deno.readTextFile(
        new URL(
          '../../gameSession/clienteffects/useClockPresentation.ts',
          import.meta.url,
        ),
      ),
      Deno.readTextFile(
        new URL(
          '../../gameSession/clienteffects/useNetworkingEffects.ts',
          import.meta.url,
        ),
      ),
      Deno.readTextFile(new URL('../../useGameSession.ts', import.meta.url)),
    ]);

  const affectedRuntimeSource = [
    clockPresentationSource,
    networkingSource,
    gameSessionSource,
  ].join('\n');

  assert(
    !affectedRuntimeSource.includes('applyHeadClockSnapshot'),
    'head clock snapshot plumbing must not be restored',
  );
  assert(
    networkingSource.includes('if (!isClockSnapshot(data.clock))'),
    'timed head clock validation must remain intact',
  );
  assert(
    networkingSource.includes("reason: 'missing_timed_clock_snapshot'"),
    'malformed timed heads must continue falling back to a full sync',
  );
  assert(
    clockPresentationSource.includes('snapshot: getClockData(rawState)'),
    'clock presentation must continue anchoring from full raw state',
  );
  assert(
    clockPresentationSource.includes('}, [effectiveGameId, rawState]);'),
    'clock anchoring must continue reacting to accepted raw-state changes',
  );
  assert(
    clockPresentationSource.includes('}, 1000);'),
    'the local one-second presentation interval must remain intact',
  );
});
