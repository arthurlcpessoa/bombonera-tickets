import { useGLTF } from '@react-three/drei';
import { STADIUM_MODEL_URL } from '@/config/stadium';

/**
 * Carrega o estádio (.glb comprimido com meshopt).
 * useGLTF faz cache: se outro componente pedir o mesmo arquivo, ele não baixa de novo.
 */
export function StadiumModel() {
  // (url, useDraco = false, useMeshopt = true)
  const { scene } = useGLTF(STADIUM_MODEL_URL, false, true);
  return <primitive object={scene} />;
}

// Começa o download assim que este módulo é importado, antes mesmo do primeiro render.
useGLTF.preload(STADIUM_MODEL_URL, false, true);
