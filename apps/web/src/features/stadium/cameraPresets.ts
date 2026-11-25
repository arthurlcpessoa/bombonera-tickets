/** Um "preset" é uma posição de câmera pronta: de onde ela olha (position) e para onde (target). */
export type Vec3 = [x: number, y: number, z: number];

export interface CameraPreset {
  id: string;
  label: string;
  position: Vec3;
  target: Vec3;
  /** Visões de fora do estádio: em telas verticais (celular) a câmera se afasta para caber tudo. */
  wide?: boolean;
}

export const CAMERA_PRESETS = [
  {
    id: 'overview',
    label: 'Visão geral',
    position: [170, 140, 170],
    target: [-15, 0, 0],
    wide: true,
  },
  { id: 'aerial', label: 'Vista aérea', position: [0, 300, 0.01], target: [0, 0, 0], wide: true },
  { id: 'upper-tier', label: 'Bandeja alta', position: [-75, 34, -40], target: [5, 0, 5] },
  { id: 'behind-goal', label: 'Atrás do gol', position: [0, 15, -84], target: [0, 0, 0] },
] as const satisfies readonly CameraPreset[];

export type CameraPresetId = (typeof CAMERA_PRESETS)[number]['id'];

export const DEFAULT_PRESET: CameraPresetId = 'overview';

export function getPreset(id: CameraPresetId): CameraPreset {
  return CAMERA_PRESETS.find((p) => p.id === id)!;
}
