import { Sky } from '@react-three/drei';

const SKY_COLOR = '#a9c8e8';

/** Céu, luzes e chão ao redor do estádio. */
export function Environment() {
  return (
    <>
      <color attach="background" args={[SKY_COLOR]} />
      <fog attach="fog" args={[SKY_COLOR, 600, 2200]} />
      <Sky distance={3000} sunPosition={[120, 80, -60]} turbidity={6} rayleigh={1.2} />

      {/* Luz ambiente "céu x chão" + um sol direcional. */}
      <hemisphereLight args={['#ffffff', '#4a5a3a', 2.1]} />
      <directionalLight position={[120, 200, 80]} intensity={2} />

      {/* Chão da cidade, logo abaixo da base do modelo, para o estádio não "flutuar". */}
      <mesh rotation-x={-Math.PI / 2} position-y={-9.3}>
        <planeGeometry args={[6000, 6000]} />
        <meshStandardMaterial color="#3d4554" />
      </mesh>
    </>
  );
}
