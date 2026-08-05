import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Detailed } from "@react-three/drei";
import * as THREE from "three";

const CHAMPAGNE_GOLD = "#d4af37";
const SOFT_CYAN = "#40e0d0";
const GLOBE_RADIUS = 2;
/** Design Constitution 2.2: ambient rotation of 0.1 degrees per second. */
const ROTATION_DEG_PER_SECOND = 0.1;

/** ~11 major cities used as marker anchors on the world globe. */
const CITY_COORDS: Array<{ name: string; lat: number; lon: number }> = [
  { name: "New York", lat: 40.7128, lon: -74.006 },
  { name: "London", lat: 51.5074, lon: -0.1278 },
  { name: "Tokyo", lat: 35.6762, lon: 139.6503 },
  { name: "Sydney", lat: -33.8688, lon: 151.2093 },
  { name: "São Paulo", lat: -23.5505, lon: -46.6333 },
  { name: "Cape Town", lat: -33.9249, lon: 18.4241 },
  { name: "Dubai", lat: 25.2048, lon: 55.2708 },
  { name: "Singapore", lat: 1.3521, lon: 103.8198 },
  { name: "Los Angeles", lat: 34.0522, lon: -118.2437 },
  { name: "Berlin", lat: 52.52, lon: 13.405 },
  { name: "Mumbai", lat: 19.076, lon: 72.8777 },
];

function latLonToVector3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const z = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  return new THREE.Vector3(x, y, z);
}

export interface GlobeMeshProps {
  reducedMotion: boolean;
}

/** Wireframe lat/lon globe with pulsing city markers (Design Constitution 2.2). */
export function GlobeMesh({ reducedMotion }: GlobeMeshProps) {
  const groupRef = useRef<THREE.Group>(null);
  const markerRefs = useRef<Array<THREE.Mesh | null>>([]);

  const markers = useMemo(
    () =>
      CITY_COORDS.map((city) => ({
        ...city,
        position: latLonToVector3(city.lat, city.lon, GLOBE_RADIUS * 1.01),
      })),
    [],
  );

  useFrame((state, delta) => {
    if (!reducedMotion && groupRef.current) {
      groupRef.current.rotation.y += delta * ROTATION_DEG_PER_SECOND * (Math.PI / 180);
    }

    if (reducedMotion) return;
    const t = state.clock.elapsedTime;
    for (let i = 0; i < markerRefs.current.length; i++) {
      const mesh = markerRefs.current[i];
      if (!mesh) continue;
      // 4-second pulse cycle per marker.
      const phase = (t / 4 + i * 0.15) % 1;
      const scale = 0.7 + Math.sin(phase * Math.PI * 2) * 0.3;
      mesh.scale.setScalar(scale);
    }
  });

  return (
    <group ref={groupRef}>
      <Detailed distances={[0, 12]}>
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 48, 32]} />
          <meshBasicMaterial color={CHAMPAGNE_GOLD} wireframe transparent opacity={0.5} />
        </mesh>
        <mesh>
          <sphereGeometry args={[GLOBE_RADIUS, 16, 12]} />
          <meshBasicMaterial color={CHAMPAGNE_GOLD} wireframe transparent opacity={0.5} />
        </mesh>
      </Detailed>

      {markers.map((marker, i) => (
        <mesh
          key={marker.name}
          position={marker.position}
          ref={(el) => {
            markerRefs.current[i] = el;
          }}
        >
          <sphereGeometry args={[0.035, 8, 8]} />
          <meshStandardMaterial
            color={SOFT_CYAN}
            emissive={SOFT_CYAN}
            emissiveIntensity={1}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
