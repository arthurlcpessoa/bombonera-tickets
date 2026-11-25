import { CameraControls, CameraControlsImpl } from '@react-three/drei';
import { useEffect, useRef, type ComponentRef } from 'react';
import { Box3, MathUtils, PerspectiveCamera, Spherical, Vector3 } from 'three';
import { CAMERA_LIMITS, SEAT_VIEW, SECTOR_CAMERA, SECTOR_PANEL_LAYOUT } from '@/config/stadium';
import { findSeat } from '@/features/seating/data/seats';
import { getSector } from '@/features/seating/data/sectors';
import type { Seat } from '@/features/seating/lib/seatLayout';
import { initialLookTarget, isWithinTurn, seatAzimuthRange } from '@/features/seating/lib/seatView';
import { sectorFrame } from '@/features/seating/lib/sectorGeometry';
import { DEFAULT_PRESET, getPreset, type CameraPresetId } from '@/features/stadium/cameraPresets';
import { prefersReducedMotion } from '@/lib/motion';
import { useSeatViewStore } from '@/store/useSeatViewStore';
import { useSelectionStore } from '@/store/useSelectionStore';
import { useStandsStore } from '@/store/useStandsStore';
import { useViewStore } from '@/store/useViewStore';

/** Quanto afastar as visões "de fora" em telas verticais (celular em pé). */
const PORTRAIT_ZOOM_OUT = 1.8;

/** Caixa que limita o ponto para onde a câmera olha (não deixa "fugir" do estádio). */
const TARGET_BOUNDS = new Box3(new Vector3(-110, 0, -130), new Vector3(70, 40, 130));

type Controls = ComponentRef<typeof CameraControls>;

const { ACTION } = CameraControlsImpl;
const DEG = Math.PI / 180;

/**
 * Controle de câmera: girar (arrastar), zoom (scroll/pinça) e mover (botão direito / dois dedos).
 * Também escuta os stores e anima a câmera até o preset escolhido, até o setor clicado ou até os
 * olhos de quem senta numa cadeira (visão do assento).
 */
export function CameraRig() {
  const controls = useRef<Controls>(null);
  const clearPreset = useViewStore((s) => s.clearPreset);

  useEffect(() => {
    const cc = controls.current;
    if (!cc) return;

    const isPortrait = () => cc.camera instanceof PerspectiveCamera && cc.camera.aspect < 1;

    const lookAtPreset = (id: CameraPresetId, animate: boolean) => {
      const { position, target, wide } = getPreset(id);
      const pos = new Vector3(...position);
      if (wide && isPortrait()) {
        // Afasta a câmera na mesma direção, mantendo o ângulo: alvo + (posição − alvo) × fator
        const t = new Vector3(...target);
        pos.sub(t).multiplyScalar(PORTRAIT_ZOOM_OUT).add(t);
      }
      void cc.setFocalOffset(0, 0, 0, animate); // desfaz o deslocamento usado nos setores
      void cc.setLookAt(pos.x, pos.y, pos.z, ...target, animate && !prefersReducedMotion());
    };

    cc.setBoundary(TARGET_BOUNDS);
    const orbit = captureOrbitSettings(cc);
    lookAtPreset(useViewStore.getState().activePreset ?? DEFAULT_PRESET, false);

    // subscribe() avisa a cada mudança no store sem re-renderizar este componente.
    const unsubscribeView = useViewStore.subscribe((state, prev) => {
      if (state.requestId !== prev.requestId && state.activePreset) {
        lookAtPreset(state.activePreset, true);
      }
    });

    const unsubscribeSelection = useSelectionStore.subscribe((state, prev) => {
      if (state.selectRequestId !== prev.selectRequestId && state.selectedSectorId) {
        flyToSector(cc, state.selectedSectorId, isPortrait());
      }
    });

    // Visão do assento: entrar, trocar de cadeira e sair.
    const seatOf = (id: string | null) =>
      id ? (findSeat(id, useStandsStore.getState().model) ?? null) : null;

    const unsubscribeSeatView = useSeatViewStore.subscribe((state, prev) => {
      if (state.viewingSeatId && state.requestId !== prev.requestId) {
        const found = seatOf(state.viewingSeatId);
        if (!found) return;
        const fromAnotherSeat = prev.viewingSeatId !== null;
        if (!fromAnotherSeat) enterFirstPerson(cc);
        // Vindo de outra cadeira: voo curto mantendo o olhar. Vindo de fora: voo até os olhos.
        sitAt(cc, found.seat, fromAnotherSeat);
      } else if (!state.viewingSeatId && prev.viewingSeatId) {
        restoreOrbit(cc, orbit);
        const found = seatOf(prev.viewingSeatId);
        if (found) flyToSector(cc, found.sector.id, isPortrait());
      }
      // Teclas +/− e botões do HUD pedem zoom pelo store.
      if (state.zoomRequest.id !== prev.zoomRequest.id && state.viewingSeatId) {
        void cc.zoomTo(state.zoomRequest.value, !prefersReducedMotion());
      }
    });

    // A câmera conta ao HUD o zoom atual (que também muda com o scroll e a pinça).
    const reportZoom = () => useSeatViewStore.getState().reportZoom(cc.camera.zoom);
    // Com o binóculo, arrastar gira mais devagar: senão a paisagem "voa" na tela.
    const adjustTurnSpeed = () => {
      if (!useSeatViewStore.getState().viewingSeatId) return;
      const speed = -SEAT_VIEW.rotateSpeed / cc.camera.zoom;
      cc.azimuthRotateSpeed = speed;
      cc.polarRotateSpeed = speed;
    };
    cc.addEventListener('update', reportZoom);
    cc.addEventListener('controlstart', adjustTurnSpeed);

    // Link direto para uma cadeira (?assento=...): a visão já começa ativa, sem voo.
    const initial = seatOf(useSeatViewStore.getState().viewingSeatId);
    if (initial) {
      enterFirstPerson(cc);
      sitAt(cc, initial.seat, false, false);
    }

    return () => {
      unsubscribeView();
      unsubscribeSelection();
      unsubscribeSeatView();
      cc.removeEventListener('update', reportZoom);
      cc.removeEventListener('controlstart', adjustTurnSpeed);
    };
  }, []);

  return (
    <CameraControls
      ref={controls}
      makeDefault
      minDistance={CAMERA_LIMITS.minDistance}
      maxDistance={CAMERA_LIMITS.maxDistance}
      maxPolarAngle={CAMERA_LIMITS.maxPolarAngle}
      smoothTime={0.6}
      onStart={clearPreset} // usuário mexeu na câmera → nenhum preset ativo
    />
  );
}

/** O que a visão do assento muda na câmera, guardado para restaurar ao sair. */
type OrbitSettings = ReturnType<typeof captureOrbitSettings>;

function captureOrbitSettings(cc: Controls) {
  const camera = cc.camera as PerspectiveCamera;
  return {
    mouseButtons: { ...cc.mouseButtons },
    touches: { ...cc.touches },
    azimuthRotateSpeed: cc.azimuthRotateSpeed,
    polarRotateSpeed: cc.polarRotateSpeed,
    minDistance: cc.minDistance,
    minPolarAngle: cc.minPolarAngle,
    maxPolarAngle: cc.maxPolarAngle,
    minZoom: cc.minZoom,
    maxZoom: cc.maxZoom,
    near: camera.near,
    far: camera.far,
  };
}

/**
 * Modo "girar a cabeça": a câmera fica parada nos olhos e só gira.
 *
 * - Arrastar (mouse ou um dedo) gira. A velocidade é NEGATIVA: arrastar para a direita "puxa" a
 *   paisagem para a direita, como no Street View, em vez de orbitar em volta de um objeto.
 * - Não há "dolly" (aproximar) nem "truck" (deslizar): o botão direito e o arrasto com dois dedos
 *   não fazem nada, e scroll/pinça viram ZOOM DA LENTE (binóculo): muda o campo de visão, não a
 *   posição. Por isso a câmera nunca "anda" para fora da cadeira.
 * - Planos near e far: a câmera só desenha o que está entre eles. Veja SEAT_VIEW em config/stadium.ts.
 */
function enterFirstPerson(cc: Controls) {
  cc.mouseButtons.left = ACTION.ROTATE;
  cc.mouseButtons.middle = ACTION.NONE;
  cc.mouseButtons.right = ACTION.NONE;
  cc.mouseButtons.wheel = ACTION.ZOOM;
  cc.touches.one = ACTION.TOUCH_ROTATE;
  cc.touches.two = ACTION.TOUCH_ZOOM;
  cc.touches.three = ACTION.NONE;
  cc.azimuthRotateSpeed = -SEAT_VIEW.rotateSpeed;
  cc.polarRotateSpeed = -SEAT_VIEW.rotateSpeed;
  // A câmera fica a SEAT_VIEW.lookAhead do alvo: a distância mínima precisa caber nisso.
  cc.minDistance = 0;
  // Ângulo polar = ângulo a partir do "para cima" do vetor alvo → câmera. Olhar reto = 90°;
  // olhar para baixo α graus = 90° − α (a câmera fica acima do alvo).
  cc.minPolarAngle = (90 - SEAT_VIEW.lookDownDeg) * DEG;
  cc.maxPolarAngle = (90 + SEAT_VIEW.lookUpDeg) * DEG;
  cc.minZoom = 1;
  cc.maxZoom = SEAT_VIEW.maxZoom;

  const camera = cc.camera as PerspectiveCamera;
  camera.near = SEAT_VIEW.near;
  camera.far = SEAT_VIEW.far;
  camera.updateProjectionMatrix();
}

/** Desfaz o modo assento: controles, limites, lente e planos near/far voltam ao normal. */
function restoreOrbit(cc: Controls, orbit: OrbitSettings) {
  Object.assign(cc.mouseButtons, orbit.mouseButtons);
  Object.assign(cc.touches, orbit.touches);
  cc.azimuthRotateSpeed = orbit.azimuthRotateSpeed;
  cc.polarRotateSpeed = orbit.polarRotateSpeed;
  cc.minDistance = orbit.minDistance;
  cc.minPolarAngle = orbit.minPolarAngle;
  cc.maxPolarAngle = orbit.maxPolarAngle;
  cc.minZoom = orbit.minZoom;
  cc.maxZoom = orbit.maxZoom;
  void cc.zoomTo(1, !prefersReducedMotion());

  const camera = cc.camera as PerspectiveCamera;
  camera.near = orbit.near;
  camera.far = orbit.far;
  camera.updateProjectionMatrix();
}

/**
 * "Senta" a câmera numa cadeira: posição = olhos do torcedor; alvo = um ponto a poucos
 * centímetros à frente dos olhos, na direção do olhar. Como a câmera orbital gira EM VOLTA do
 * alvo, um alvo quase colado nos olhos faz o giro parecer um "virar a cabeça".
 *
 * @param keepGaze trocando de cadeira: mantém para onde a pessoa estava olhando, se fizer sentido
 */
function sitAt(cc: Controls, seat: Seat, keepGaze: boolean, animate = true) {
  const eye = new Vector3(...seat.eye);
  let gaze = new Vector3(...initialLookTarget(seat.eye, seat.yaw)).sub(eye).normalize();

  if (keepGaze) {
    const current = cc.getTarget(new Vector3()).sub(cc.getPosition(new Vector3())).normalize();
    if (isWithinTurn(seat.yaw, [current.x, current.z])) gaze = current;
  }

  const ahead = gaze.multiplyScalar(SEAT_VIEW.lookAhead).add(eye);
  void cc.setFocalOffset(0, 0, 0, animate);
  void cc.setLookAt(
    eye.x,
    eye.y,
    eye.z,
    ahead.x,
    ahead.y,
    ahead.z,
    animate && !prefersReducedMotion(),
  );
  // O ângulo atual e o final ficam no mesmo "trecho" da volta: o voo gira pelo caminho curto.
  cc.normalizeRotations();
  const end = cc.getSpherical(new Spherical(), true);
  [cc.minAzimuthAngle, cc.maxAzimuthAngle] = seatAzimuthRange(seat.yaw, end.theta);
}

/**
 * Voa até um setor. A câmera fica entre o setor e o campo, mais alta, olhando para ele:
 *
 *          câmera ●
 *                  ╲  ← distância (proporcional ao tamanho do setor)
 *     campo   ⟵     ╲ elevação
 *              ───────● centro do setor
 */
function flyToSector(cc: Controls, sectorId: string, portrait: boolean) {
  const sector = getSector(sectorId);
  if (!sector) return;
  const { center, toField, size } = sectorFrame(sector.shape, useStandsStore.getState().model);

  const elevation = MathUtils.degToRad(SECTOR_CAMERA.elevationDeg[sector.shape.kind]);
  let distance = MathUtils.clamp(
    size * SECTOR_CAMERA.distanceFactor,
    SECTOR_CAMERA.minDistance,
    SECTOR_CAMERA.maxDistance,
  );
  if (portrait) distance *= SECTOR_CAMERA.portraitZoomOut;

  // Posição = centro + direção do campo (na horizontal) × cos(elevação) + para cima × sen(elevação)
  const horizontal = Math.cos(elevation) * distance;
  const [cx, cy, cz] = center;
  const position = [
    cx + toField[0] * horizontal,
    cy + Math.sin(elevation) * distance,
    cz + toField[1] * horizontal,
  ] as const;

  const animate = !prefersReducedMotion();
  // Saindo da visão do assento: o giro horizontal volta a ser livre.
  cc.minAzimuthAngle = -Infinity;
  cc.maxAzimuthAngle = Infinity;
  const [ox, oy] = panelFocalOffset(cc, distance);
  void cc.setFocalOffset(ox, oy, 0, animate);
  void cc.setLookAt(...position, cx, cy, cz, animate);
}

/**
 * Desloca a imagem (sem mudar o ponto em volta do qual a câmera gira) para o setor aparecer
 * no meio da área livre da tela, e não atrás do painel: para a esquerda no desktop
 * (painel à direita) ou para cima no celular (gaveta embaixo).
 */
function panelFocalOffset(cc: Controls, distance: number): [x: number, y: number] {
  const camera = cc.camera;
  if (!(camera instanceof PerspectiveCamera)) return [0, 0];
  // Tamanho, em metros, do que cabe na tela à distância do setor.
  const visibleHeight = 2 * distance * Math.tan(MathUtils.degToRad(camera.fov / 2));
  const visibleWidth = visibleHeight * camera.aspect;
  const { innerWidth: w, innerHeight: h } = window;
  const { desktopMinWidth, sideWidth, sheetHeight } = SECTOR_PANEL_LAYOUT;
  // No camera-controls, x > 0 move a câmera para a direita (a cena "vai" para a esquerda)
  // e y > 0 move a câmera para baixo (a cena "sobe" na tela).
  if (w >= desktopMinWidth) return [(sideWidth / 2 / w) * visibleWidth, 0];
  return [0, (Math.min(sheetHeight, h * 0.65) / 2 / h) * visibleHeight];
}
