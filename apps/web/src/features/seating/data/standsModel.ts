import { PALCOS_PLATEA, STAND_PATH, TIER_PROFILES } from '@/config/stadium';
import type { StandsModel } from '@/features/seating/lib/sectorGeometry';
import { STAND_CALIBRATION } from './standCalibration';

/**
 * Modelo das arquibancadas usado pelo site: a forma geométrica (config/stadium.ts)
 * + a tabela de correção medida no .glb (standCalibration.ts, gerada por script).
 * No modo ?debug, uma cópia editável dele fica em useStandsStore.
 */
export const DEFAULT_STANDS_MODEL: StandsModel = {
  path: STAND_PATH,
  profiles: TIER_PROFILES,
  corrections: STAND_CALIBRATION,
  palcos: PALCOS_PLATEA,
};
