import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { getShipDefinitionUI, SHIP_DEFINITIONS } from '../../game/data/ShipDefinitionsUI';
import type { ShipDefId } from '../../game/types/ShipTypes.engine';
import { resolveShipGraphic } from '../../game/display/graphics/resolveShipGraphic';
import {
  ShipEffectAnimation,
  SHIP_EFFECT_TIMING,
  type ShipEffectKind,
} from '../../game/display/graphics/ShipEffectAnimation';
import { getSoundManifestEntry } from '../../game/client/audio/soundManifest';

const SOURCES: readonly {
  id: ShipDefId;
  label: string;
  effect: ShipEffectKind;
  targets: number;
}[] = [
  { id: 'GUA', label: 'GUA — Destroy', effect: 'destroy', targets: 1 },
  { id: 'SAC', label: 'SAC — Destroy', effect: 'destroy', targets: 1 },
  { id: 'EQU', label: 'EQU — Destroy', effect: 'destroy', targets: 2 },
  { id: 'SPI', label: 'SPI — Destroy', effect: 'destroy', targets: 1 },
  { id: 'SBLA', label: 'SBLA — Destroy, two targets', effect: 'destroy', targets: 2 },
  { id: 'DOM', label: 'DOM — Steal, two targets', effect: 'steal', targets: 2 },
  { id: 'SSIM', label: 'SSIM — Copy', effect: 'copy', targets: 1 },
];

const BASIC_SHIPS = SHIP_DEFINITIONS.filter((ship) => ship.shipType === 'Basic');
const SPECIES = [...new Set(BASIC_SHIPS.map((ship) => ship.species))];

export function ShipEffectPreview() {
  const [targetId, setTargetId] = useState<ShipDefId>('DEF');
  const [sourceId, setSourceId] = useState<ShipDefId>('GUA');
  const [activationKey, setActivationKey] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const nextActivationRef = useRef(0);
  const soundForReplayRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const source = SOURCES.find((option) => option.id === sourceId)!;
  const targetDefinition = getShipDefinitionUI(targetId);
  const sourceDefinition = sourceId === 'SSIM' ? undefined : getShipDefinitionUI(sourceId);
  const TargetGraphic = targetDefinition
    ? resolveShipGraphic(targetDefinition, { context: 'default' })?.component
    : undefined;
  const SourceGraphic = sourceDefinition
    ? resolveShipGraphic(sourceDefinition, { context: 'default' })?.component
    : undefined;

  const stopSound = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch {
      // Match live audio's quiet failure posture.
    }
  }, []);

  useEffect(() => stopSound, [stopSound]);

  const playDestroySound = useCallback(() => {
    if (!soundForReplayRef.current) return;
    const audio = audioRef.current;
    if (!audio) return;
    stopSound();
    try {
      void audio.play().catch(() => {
        // Autoplay restrictions must not interrupt the preview.
      });
    } catch {
      // Sound is optional, including when the browser cannot play the asset.
    }
  }, [stopSound]);

  function resetPreview() {
    soundForReplayRef.current = false;
    stopSound();
    setActivationKey(null);
  }

  function replay() {
    stopSound();
    soundForReplayRef.current = soundEnabled;
    if (soundEnabled && source.effect === 'destroy' && !audioRef.current) {
      const { src } = getSoundManifestEntry('destroy');
      if (src) {
        const audio = new Audio(src);
        audio.preload = 'auto';
        audioRef.current = audio;
        try {
          audio.load();
        } catch {
          // Warm-up failures should remain silent as in live playback.
        }
      }
    }
    setActivationKey(++nextActivationRef.current);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ship Effect Animations</CardTitle>
        <p className="text-sm text-gray-600">
          Destroy, copy and steal · {SHIP_EFFECT_TIMING.durationMs} ms
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Target
            <select
              className="rounded-md border bg-white px-3 py-2 text-gray-900"
              value={targetId}
              onChange={(event) => {
                resetPreview();
                setTargetId(event.target.value as ShipDefId);
              }}
            >
              {SPECIES.map((species) => (
                <optgroup key={species} label={species}>
                  {BASIC_SHIPS.filter((ship) => ship.species === species).map((ship) => (
                    <option key={ship.id} value={ship.id}>{ship.id} — {ship.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Acting source
            <select
              className="rounded-md border bg-white px-3 py-2 text-gray-900"
              value={sourceId}
              onChange={(event) => {
                resetPreview();
                setSourceId(event.target.value as ShipDefId);
              }}
            >
              {SOURCES.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
          <Button type="button" onClick={replay}>Replay</Button>
          <label className="flex items-center gap-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={soundEnabled}
              onChange={(event) => {
                setSoundEnabled(event.target.checked);
                // Enabling sound applies to the next replay only.
                if (!event.target.checked) {
                  soundForReplayRef.current = false;
                  stopSound();
                }
              }}
            />
            Sound
          </label>
        </div>
        {sourceId === 'EQU' ? (
          <p className="text-sm text-gray-600">Equal-cost pair: one own target and one opponent target.</p>
        ) : null}
        <div className="flex min-h-[300px] flex-wrap items-center justify-center gap-x-16 gap-y-24 overflow-visible rounded-lg bg-[#000033] px-16 py-24">
          {Array.from({ length: source.targets }, (_, index) => (
            <div key={`${targetId}-${sourceId}-${index}`} className="relative inline-flex">
              {sourceId === 'EQU' ? (
                <span className="absolute bottom-full left-1/2 mb-8 -translate-x-1/2 text-sm text-white">
                  {index === 0 ? 'Own' : 'Opponent'}
                </span>
              ) : null}
              <ShipEffectAnimation
                effect={source.effect}
                activationKey={activationKey}
                sourceIcon={sourceId === 'SSIM' || !SourceGraphic ? null : <SourceGraphic />}
                sourcePreviewScaleMultiplier={sourceId === 'DOM' ? 0.7 : 1}
                onImpact={source.effect === 'destroy' && index === 0 ? playDestroySound : undefined}
              >
                {TargetGraphic ? <TargetGraphic /> : null}
              </ShipEffectAnimation>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
