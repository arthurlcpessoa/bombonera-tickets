import { CAMERA_PRESETS } from '@/features/stadium/cameraPresets';
import { useViewStore } from '@/store/useViewStore';

/** Botões que levam a câmera até pontos de vista prontos. */
export function ViewSwitcher() {
  const activePreset = useViewStore((s) => s.activePreset);
  const goToPreset = useViewStore((s) => s.goToPreset);

  return (
    <nav
      aria-label="Pontos de vista"
      className="bg-boca-navy/80 absolute inset-x-0 bottom-14 mx-auto flex w-fit max-w-[calc(100%-2rem)] gap-1 overflow-x-auto rounded-2xl border border-white/10 p-1 shadow-xl backdrop-blur sm:bottom-6"
    >
      {CAMERA_PRESETS.map((preset) => {
        const active = preset.id === activePreset;
        return (
          <button
            key={preset.id}
            type="button"
            aria-pressed={active}
            onClick={() => goToPreset(preset.id)}
            className={`shrink-0 cursor-pointer rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors ${
              active ? 'bg-boca-gold text-boca-navy' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {preset.label}
          </button>
        );
      })}
    </nav>
  );
}
