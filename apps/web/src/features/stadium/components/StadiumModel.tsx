import { Bvh, useGLTF } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import { CENTER } from 'three-mesh-bvh';
import { STADIUM_MODEL_URL } from '@/config/stadium';

/** "Segura" o evento: o que está atrás do estádio (ex.: cadeiras sob a marquise) não reage. */
const block = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();

/**
 * Carrega o estádio (.glb comprimido com meshopt).
 * useGLTF faz cache: se outro componente pedir o mesmo arquivo, ele não baixa de novo.
 *
 * Bloqueio por estrutura: o estádio também recebe eventos de ponteiro e os "segura"
 * (stopPropagation). Assim não dá para escolher um setor ou uma cadeira através de um telhado,
 * marquise ou mureta: o raio do ponteiro bate primeiro no concreto.
 *
 * <Bvh>: o modelo tem 721 mil triângulos, e testar o raio contra todos a cada movimento do mouse
 * travaria a tela. O BVH organiza os triângulos em "caixas dentro de caixas" (como o índice
 * de um livro), e o teste fica centenas de vezes mais rápido. firstHitOnly: basta o primeiro
 * triângulo atingido.
 *
 * strategy={CENTER}: o padrão do drei (SAH) monta um índice mais "caprichado", mas leva ~2 s
 * com a tela travada no carregamento. CENTER corta as caixas ao meio: monta várias vezes mais
 * rápido, e as consultas continuam de sobra para um ponteiro de mouse.
 */
export function StadiumModel() {
  // (url, useDraco = false, useMeshopt = true)
  const { scene } = useGLTF(STADIUM_MODEL_URL, false, true);
  return (
    <Bvh firstHitOnly strategy={CENTER} maxLeafTris={20}>
      <primitive object={scene} onPointerOver={block} onClick={block} />
    </Bvh>
  );
}

// Começa o download assim que este módulo é importado, antes mesmo do primeiro render.
useGLTF.preload(STADIUM_MODEL_URL, false, true);
