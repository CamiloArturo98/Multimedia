// src/components/GeometryExplorer/GeometryExplorer.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/** Claves tipadas para evitar 'string' index errors */
type GeometryKey =
  | "Box"
  | "Sphere"
  | "Cone"
  | "Cylinder"
  | "Torus"
  | "TorusKnot"
  | "Dodecahedron"
  | "Octahedron"
  | "Icosahedron";

const GEOMETRY_KEYS: GeometryKey[] = [
  "Box",
  "Sphere",
  "Cone",
  "Cylinder",
  "Torus",
  "TorusKnot",
  "Dodecahedron",
  "Octahedron",
  "Icosahedron",
];

export default function GeometryExplorer() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const requestRef = useRef<number | null>(null);

  // Mesh tipado para poder acceder a .material.wireframe sin error
  const meshRef = useRef<
    THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null
  >(null);

  // === Estado con persistencia ===
  const [isPaused, setIsPaused] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("isPaused") || "false")
  );
  const [isWireframe, setIsWireframe] = useState<boolean>(() =>
    JSON.parse(localStorage.getItem("isWireframe") || "false")
  );
  const [activeGeometry, setActiveGeometry] = useState<GeometryKey>(() => {
    const saved = localStorage.getItem("activeGeometry") as GeometryKey | null;
    return saved && GEOMETRY_KEYS.includes(saved) ? saved : "Box";
  });

  // Refs espejo para leer dentro del loop
  const pausedRef = useRef(isPaused);
  const wireframeRef = useRef(isWireframe);

  useEffect(() => {
    pausedRef.current = isPaused;
    localStorage.setItem("isPaused", JSON.stringify(isPaused));
    console.log("Paused:", isPaused);
  }, [isPaused]);

  useEffect(() => {
    wireframeRef.current = isWireframe;
    localStorage.setItem("isWireframe", JSON.stringify(isWireframe));
    console.log("Wireframe:", isWireframe);
  }, [isWireframe]);

  useEffect(() => {
    localStorage.setItem("activeGeometry", activeGeometry);
    console.log("Geometry:", activeGeometry);
  }, [activeGeometry]);

  // === Mapa de creadores de geometría (memoizado) ===
  const geometryMap = useMemo<
    Record<GeometryKey, () => THREE.BufferGeometry>
  >(
    () => ({
      Box: () => new THREE.BoxGeometry(1, 1, 1),
      Sphere: () => new THREE.SphereGeometry(1, 32, 32),
      Cone: () => new THREE.ConeGeometry(1, 2, 32),
      Cylinder: () => new THREE.CylinderGeometry(1, 1, 2, 32),
      Torus: () => new THREE.TorusGeometry(1, 0.4, 16, 100),
      TorusKnot: () => new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
      Dodecahedron: () => new THREE.DodecahedronGeometry(1),
      Octahedron: () => new THREE.OctahedronGeometry(1),
      Icosahedron: () => new THREE.IcosahedronGeometry(1),
    }),
    []
  );

  // === Inicialización de escena ===
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const material = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      wireframe: wireframeRef.current,
    });

    // Mesh inicial
    meshRef.current = new THREE.Mesh(geometryMap[activeGeometry](), material);
    scene.add(meshRef.current);

    // Animación
    const animate = () => {
      if (meshRef.current) {
        if (!pausedRef.current) {
          meshRef.current.rotation.x += 0.01;
          meshRef.current.rotation.y += 0.01;
        }
        meshRef.current.material.wireframe = wireframeRef.current;
      }

      renderer.render(scene, camera);
      requestRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!mount) return;
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // Cleanup
    return () => {
      window.removeEventListener("resize", onResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (meshRef.current) {
        meshRef.current.geometry.dispose();
        meshRef.current.material.dispose();
        scene.remove(meshRef.current);
        meshRef.current = null;
      }
      mount.removeChild(renderer.domElement);
      renderer.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // se inicia una sola vez; el cambio de geometría va en otro efecto

  // === Reemplazar geometría cuando cambia la selección ===
  useEffect(() => {
    if (!meshRef.current) return;
    const oldGeo = meshRef.current.geometry;
    const newGeo = geometryMap[activeGeometry]();
    meshRef.current.geometry = newGeo;
    oldGeo.dispose();
  }, [activeGeometry, geometryMap]);

  // === UI ===
  return (
    <div style={{ display: "flex" }}>
      {/* Panel lateral */}
      <aside
        style={{
          width: 240,
          background: "#1e1e1e",
          padding: 12,
          color: "white",
          boxSizing: "border-box",
        }}
      >
        <h3 style={{ margin: "0 0 8px 0" }}>Geometrías</h3>
        {GEOMETRY_KEYS.map((key) => (
          <button
            key={key}
            onClick={() => setActiveGeometry(key)}
            style={{
              display: "block",
              width: "100%",
              margin: "6px 0",
              padding: "8px 10px",
              textAlign: "left",
              background: activeGeometry === key ? "#0a7d0a" : "#333",
              color: "white",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
            title={`THREE.${key}Geometry`}
          >
            {key} (THREE.{key}Geometry)
          </button>
        ))}

        <hr style={{ margin: "12px 0", borderColor: "#444" }} />

        <button
          onClick={() => setIsPaused((p: boolean) => !p)}
          style={{
            display: "block",
            width: "100%",
            marginBottom: 8,
            padding: "8px 10px",
            background: "#2b2b2b",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isPaused ? "Reanudar Rotación" : "Pausar Rotación"}
        </button>

        <button
          onClick={() => setIsWireframe((w: boolean) => !w)}
          style={{
            display: "block",
            width: "100%",
            padding: "8px 10px",
            background: "#2b2b2b",
            color: "white",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          {isWireframe ? "Desactivar Wireframe" : "Activar Wireframe"}
        </button>
      </aside>

      {/* Canvas */}
      <div ref={mountRef} style={{ width: "100%", height: "100vh" }} />
    </div>
  );
}
