import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, InstancedMesh, MeshLambertMaterial, Object3D } from 'three';
import {
  getSector,
  getSectorSeats,
  type Seat,
  seatIndexMap,
  type Sector,
  type StandsModel,
} from '@bombonera/shared';
import { CATEGORY_COLORS, COLORS } from '@/config/colors';
import { createSeatMarkerGeometry } from '@/features/seating/lib/seatGeometry';
import { useSeatStore } from '@/store/useSeatStore';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';
import { isDragGesture, supportsHover } from './pointerRules';

/** As cadeiras sobem um tiquinho acima da superfície medida, para não "afundar" nela. */
const SEAT_RENDER_LIFT = 0.03;

/** Mostra as cadeiras do setor escolhido (só dele: os outros continuam como superfícies). */
export function SeatInstances() {
  const selectedSectorId = useSelectionStore((s) => s.selectedSectorId);
  const model = useStandsStore((s) => s.model);
  const sector = selectedSectorId ? getSector(selectedSectorId) : undefined;
  if (!sector) return null;
  // key: trocar de setor monta um componente novo (e o antigo libera a memória da GPU).
  return <SectorSeats key={sector.id} sector={sector} model={model} />;
}

interface SectorSeatsProps {
  sector: Sector;
  model: StandsModel;
}

/**
 * InstancedMesh: um único "molde" de cadeira desenhado N vezes numa só chamada à placa de vídeo.
 * Cada cópia (instância) tem só a sua matriz (posição + rotação) e a sua cor.
 * O número da instância (instanceId) é a posição da cadeira na lista `seats`.
 */
function SectorSeats({ sector, model }: SectorSeatsProps) {
  const seats = useMemo(() => getSectorSeats(sector, model), [sector, model]);
  const indexById = useMemo(() => seatIndexMap(seats), [seats]);
  const meshRef = useRef<InstancedMesh>(null);

  // Molde e material criados à mão → liberados à mão (dispose) quando o setor muda.
  const geometry = useMemo(() => createSeatMarkerGeometry(sector.shape.kind), [sector.shape.kind]);
  const material = useMemo(() => new MeshLambertMaterial({ color: '#ffffff' }), []);
  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  // Cores base: livre = cor da faixa de preço; vendida = cinza escuro.
  const palette = useMemo(() => {
    const available = new Color(CATEGORY_COLORS[sector.categoryId]);
    const sold = new Color(COLORS.soldSeat);
    const gold = new Color(COLORS.gold);
    const white = new Color('#ffffff');
    return {
      available,
      availableHover: available.clone().lerp(white, COLORS.hoverLighten),
      sold,
      selected: gold,
      selectedHover: gold.clone().lerp(white, COLORS.hoverLighten),
    };
  }, [sector.categoryId]);

  /** Cor de uma cadeira a partir do estado atual dos stores. */
  const colorOf = (seat: Seat): Color => {
    const { hoveredSeatId, selectedSeatIds } = useSeatStore.getState();
    const hovered = hoveredSeatId === seat.id && seat.status === 'available';
    if (selectedSeatIds.includes(seat.id))
      return hovered ? palette.selectedHover : palette.selected;
    if (seat.status === 'sold') return palette.sold;
    return hovered ? palette.availableHover : palette.available;
  };

  // 1) Posição e rotação de cada cadeira: escritas uma vez, quando o setor aparece.
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new Object3D(); // "boneco" usado só para calcular cada matriz
    seats.forEach((seat, i) => {
      const [x, y, z] = seat.position;
      dummy.position.set(x, y + SEAT_RENDER_LIFT, z);
      dummy.rotation.set(0, seat.yaw, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, colorOf(seat));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    // Esfera que envolve todas as cadeiras: o raio do ponteiro testa ela antes de cada cadeira.
    mesh.computeBoundingSphere();
    // colorOf lê os stores na hora; só precisamos refazer quando as cadeiras mudam.
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [seats]);

  // 2) Cores: quando o hover ou a seleção mudam, repinta SÓ as cadeiras afetadas.
  //    subscribe() avisa sem re-renderizar o React; setColorAt escreve direto na GPU.
  useEffect(() => {
    const repaint = (ids: Iterable<string | null>) => {
      const mesh = meshRef.current;
      if (!mesh?.instanceColor) return;
      let changed = false;
      for (const id of ids) {
        const index = id ? indexById.get(id) : undefined;
        if (index === undefined) continue; // cadeira de outro setor
        mesh.setColorAt(index, colorOf(seats[index]));
        changed = true;
      }
      if (changed) mesh.instanceColor.needsUpdate = true;
    };

    return useSeatStore.subscribe((state, prev) => {
      const ids = new Set<string | null>();
      if (state.hoveredSeatId !== prev.hoveredSeatId) {
        ids.add(prev.hoveredSeatId).add(state.hoveredSeatId);
      }
      if (state.selectedSeatIds !== prev.selectedSeatIds) {
        // Só a diferença: quem entrou ou saiu da seleção.
        const before = new Set(prev.selectedSeatIds);
        const after = new Set(state.selectedSeatIds);
        for (const id of after) if (!before.has(id)) ids.add(id);
        for (const id of before) if (!after.has(id)) ids.add(id);
      }
      if (ids.size) repaint(ids);
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [seats, indexById]);

  // Ao sair (trocar de setor ou fechar), o hover de uma cadeira deste setor deixa de valer.
  useEffect(
    () => () => {
      const { hoveredSeatId, setHoveredSeat } = useSeatStore.getState();
      if (hoveredSeatId && indexById.has(hoveredSeatId)) setHoveredSeat(null);
    },
    [indexById],
  );

  const seatAt = (e: ThreeEvent<PointerEvent | MouseEvent>) =>
    e.instanceId === undefined ? undefined : seats[e.instanceId];

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation(); // a cadeira mais próxima "segura" o evento
    const seat = seatAt(e);
    if (seat && supportsHover(e)) useSeatStore.getState().setHoveredSeat(seat.id, 'scene');
  };

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    const seat = seatAt(e);
    const store = useSeatStore.getState();
    if (seat && store.hoveredSeatId === seat.id) store.setHoveredSeat(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const seat = seatAt(e);
    if (!seat || isDragGesture(e) || seat.status === 'sold') return; // vendida não é clicável
    useSeatStore.getState().toggleSeat(seat.id);
  };

  /**
   * Duplo clique = ver a visão daquela cadeira (também das vendidas: dá para espiar).
   * Os dois cliques do duplo clique também chegam em handleClick e se anulam (escolhe e desfaz).
   */
  const handleDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const seat = seatAt(e);
    if (!seat || isDragGesture(e)) return;
    useSeatViewStore.getState().enterSeatView(seat.id);
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, seats.length]}
      onPointerOver={handleOver}
      onPointerOut={handleOut}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    />
  );
}
