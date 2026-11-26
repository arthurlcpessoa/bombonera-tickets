/**
 * Painel de calibração (só com ?debug na URL). Carregado sob demanda: o leva (biblioteca de
 * painéis de ajuste) não entra no pacote normal do site.
 *
 * Cada controle escreve no useStandsStore, e a cena 3D redesenha os setores na hora.
 * "Copiar JSON" copia os valores para colar em src/config/stadium.ts.
 */
import { button, folder, Leva, useControls } from 'leva';
import { useEffect } from 'react';
import { type CurvedTier, DEFAULT_STANDS_MODEL, type TierProfile } from '@bombonera/shared';
import { useStandsStore } from '@/store/useStandsStore';

const defaults = DEFAULT_STANDS_MODEL;

/** Controles (com faixa e passo) de um perfil de bandeja. */
function profileControls(p: TierProfile) {
  return {
    innerOffset: { value: p.innerOffset, min: -5, max: 50, step: 0.1 },
    outerOffset: { value: p.outerOffset, min: 0, max: 55, step: 0.1 },
    innerHeight: { value: p.innerHeight, min: -2, max: 40, step: 0.1 },
    outerHeight: { value: p.outerHeight, min: 0, max: 45, step: 0.1 },
  };
}

const TIER_FOLDERS: Record<CurvedTier, string> = {
  lower: 'Bandeja inferior',
  middle: 'Bandeja média',
  upper: 'Bandeja superior',
};

export default function DebugPanel() {
  const setModel = useStandsStore((s) => s.setModel);

  const { applyCorrection, ...path } = useControls('Caminho em U', {
    applyCorrection: { value: true, label: 'aplicar correção' },
    sideX: { value: defaults.path.sideX, min: -70, max: -30, step: 0.1 },
    endZ: { value: defaults.path.endZ, min: 50, max: 85, step: 0.1 },
    cornerRadius: { value: defaults.path.cornerRadius, min: 1, max: 50, step: 0.5 },
    tipX: { value: defaults.path.tipX, min: 0, max: 50, step: 0.5 },
  });
  const lower = useControls(TIER_FOLDERS.lower, profileControls(defaults.profiles.lower));
  const middle = useControls(TIER_FOLDERS.middle, profileControls(defaults.profiles.middle));
  const upper = useControls(TIER_FOLDERS.upper, profileControls(defaults.profiles.upper));
  const palcos = useControls('Platea palcos', {
    frente: folder({
      frontX: { value: defaults.palcos.frontX, min: 30, max: 45, step: 0.1 },
      frontY: { value: defaults.palcos.frontY, min: 0, max: 12, step: 0.1 },
    }),
    fundo: folder({
      backX: { value: defaults.palcos.backX, min: 30, max: 50, step: 0.1 },
      backY: { value: defaults.palcos.backY, min: 0, max: 15, step: 0.1 },
    }),
  });

  useControls({
    'Copiar JSON': button(() => {
      const { path, profiles, palcos } = useStandsStore.getState().model;
      const json = JSON.stringify(
        { STAND_PATH: path, TIER_PROFILES: profiles, PALCOS_PLATEA: palcos },
        null,
        2,
      );
      void navigator.clipboard.writeText(json).then(
        () => console.info('[debug] JSON copiado:\n' + json),
        () => console.info('[debug] Não deu para copiar; aqui está o JSON:\n' + json),
      );
    }),
  });

  // Sempre que algum controle muda, monta um modelo novo e publica no store.
  const { sideX, endZ, cornerRadius, tipX } = path;
  useEffect(() => {
    setModel({
      path: { sideX, endZ, cornerRadius, tipX },
      profiles: { lower, middle, upper },
      corrections: applyCorrection ? defaults.corrections : null,
      palcos,
    });
  }, [sideX, endZ, cornerRadius, tipX, lower, middle, upper, palcos, applyCorrection, setModel]);

  return <Leva titleBar={{ title: 'Calibração' }} />;
}
