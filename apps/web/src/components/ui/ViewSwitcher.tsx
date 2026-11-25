import { CAMERA_PRESETS } from '@/features/stadium/cameraPresets';
import { useViewStore } from '@/store/useViewStore';

/** Botões que levam a câmera até pontos de vista prontos. */
export function ViewSwitcher() {
  const activePreset = useViewStore((s) => s.activePreset);
  const goToPreset = useViewStore((s) => s.goToPreset);

  return (
    <nav
      aria-label="Pontos de vista"
      className="glass-card hide-in-seat-view absolute inset-x-0 bottom-14 mx-auto flex w-fit max-w-[calc(100%-2rem)] gap-1 overflow-x-auto rounded-full p-1.5 sm:bottom-6"
    >
      {CAMERA_PRESETS.map((preset) => {
        const active = preset.id === activePreset;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => goToPreset(preset.id)}
            className={`shrink-0 cursor-pointer rounded-full px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active
                ? 'bg-boca-gold text-boca-navy shadow-md shadow-black/30'
                : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </nav>
  );
}
