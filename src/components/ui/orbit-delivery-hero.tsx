// @ts-nocheck — generated single-file distribution (21st.dev "Orbit Delivery"); typed sources live upstream.
// Orbit hero for the Vision REAL start page: a glass data globe you can turn.
// Adapted from the template: violet palette, the courier and planet models replaced by a line-drawn glass globe
// (graticule, coastlines, a network of hubs, instrument rings) rising like a horizon; the site's own words and links.
// Dependencies: React, three, @react-three/fiber. No model files to load.
// It turns on its own from the first frame and never stops: drag to spin it, let go and it eases back into its own
// turn. Arrow keys nudge. Supports .dark and data-theme="dark".
import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { BackSide, BufferGeometry, CanvasTexture, Color, Euler, Float32BufferAttribute, FrontSide, MathUtils, MeshStandardMaterial, Quaternion, Vector3 } from "three";
import { WORLD_DOTS } from "./world-dots";
import { WORLD_LINES } from "./world-lines";
import { CursorCrosshair } from "./cursor-crosshair";
import { TextScramble } from "./text-scramble";

// ------------------------------------------------------------------ motion
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (value, target, lambda, dt) => value + (target - value) * (1 - Math.exp(-lambda * dt));
// Top speeds while dragging, in radians per second: sideways (the globe rolls along the horizon) and up/down.
const SPIN_MAX = 3.2,
  PITCH_MAX = 1.6;
const createMotion = () => ({
  planetAngle: 0,
  planetVelocity: 0,
  dragTarget: 0,
  characterTarget: 0,
  characterAngle: 0,
  characterVelocity: 0,
  phase: 0,
  activity: 0,
  direction: 1,
  time: 0,
  dragging: false,
  pitchAngle: 0,
  pitchVelocity: 0,
  pitchTarget: 0,
});
function stepPlanet(m, dt, reduced, autoRoll = -0.032) {
  m.time += dt;
  if (m.dragging) {
    const acceleration = 90 * (m.dragTarget - m.planetAngle) - 18 * m.planetVelocity;
    m.planetVelocity += acceleration * dt;
  } else {
    const desired = reduced ? 0 : autoRoll;
    m.planetVelocity = damp(m.planetVelocity, desired, reduced ? 12 : 2.4, dt);
  }
  m.planetVelocity = clamp(m.planetVelocity, -SPIN_MAX, SPIN_MAX);
  m.planetAngle += m.planetVelocity * dt;
}

// ------------------------------------------------------------------ globe motion
function createGlobeMotion() {
  return { delta: new Quaternion(), orientation: new Quaternion().setFromEuler(new Euler(0.1, 0.5, 0)), angular: new Vector3(), route: 0 };
}
function stepGlobeMotion(globe, m, dt, reduced) {
  // Roaming is the globe's own turn. Only a drag interrupts it; on release the spin eases straight back into it.
  const roaming = !reduced && !m.dragging;
  if (roaming) globe.route += 0.24 * dt;
  stepPlanet(m, dt, reduced, -0.24 * Math.cos(globe.route));
  if (m.dragging) m.pitchVelocity += (70 * (m.pitchTarget - m.pitchAngle) - 17 * m.pitchVelocity) * dt;
  else m.pitchVelocity = MathUtils.damp(m.pitchVelocity, roaming ? 0.24 * Math.sin(globe.route) : 0, 3, dt);
  m.pitchVelocity = MathUtils.clamp(m.pitchVelocity, -PITCH_MAX, PITCH_MAX);
  m.pitchAngle += m.pitchVelocity * dt;
  globe.angular.set(m.pitchVelocity, m.planetVelocity * 0.45, -m.planetVelocity);
  const speed = globe.angular.length();
  if (speed > 1e-8) {
    globe.delta.setFromAxisAngle(globe.angular.multiplyScalar(1 / speed), speed * dt);
    globe.orientation.premultiply(globe.delta).normalize();
  }
}

// ------------------------------------------------------------------ the cyber look
const cyberUniforms = { uTime: { value: 0 } };
const CYBER_GLSL = `
uniform float uTime;
float cyberLine(float v) { float d = 0.5 - abs(fract(v) - 0.5); float w = fwidth(v) * 1.25; return 1.0 - smoothstep(0.0, w, d); }
`;

/** The globe: clear purple glass drawn mostly as lines. `back` is the far side of the graticule, faint, seen through it. */
function glassMaterial(back = false) {
  const mat = new MeshStandardMaterial({ color: new Color("#7c3aed"), metalness: 0.1, roughness: 0.3, transparent: true, opacity: 1, depthWrite: false, side: back ? BackSide : FrontSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = cyberUniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vCyLocal;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvCyLocal = position;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec3 vCyLocal;" + CYBER_GLSL).replace(
      "#include <emissivemap_fragment>",
      `#include <emissivemap_fragment>
vec3 cyDir = normalize(vCyLocal);
float cyLat = asin(clamp(cyDir.y, -1.0, 1.0));
float cyLon = atan(cyDir.x, cyDir.z);
float cyGrid = max(cyberLine(cyLat * 18.0 / PI), cyberLine(cyLon * 18.0 / PI));
float cyMajor = max(cyberLine(cyLat * 6.0 / PI), cyberLine(cyLon * 6.0 / PI));
float cyScan = exp(-pow((cyDir.y - sin(uTime * 0.4) * 0.9) * 60.0, 2.0));
float cyRim = pow(1.0 - saturate(abs(dot(normalize(normal), normalize(vViewPosition)))), 2.4);
${back ? "diffuseColor.a = clamp(cyGrid * 0.16 + cyMajor * 0.1, 0.0, 0.3);" : `totalEmissiveRadiance += vec3(0.48, 0.3, 0.95) * cyRim * 0.35;
totalEmissiveRadiance += vec3(0.13, 0.83, 0.93) * cyScan * 0.25;
diffuseColor.a = clamp(0.025 + cyRim * 0.28 + cyGrid * 0.42 + cyMajor * 0.25 + cyScan * 0.25, 0.0, 0.9);`}`,
    );
  };
  return mat;
}

/** Writes depth only: hides the far side of the dots and arcs that sit on the front. */
function depthOnly() {
  const mat = new MeshStandardMaterial();
  mat.colorWrite = false;
  return mat;
}

/** A soft round dot for glowing points. */
let dotTexture = null;
function getDotTexture() {
  if (dotTexture || typeof document === "undefined") return dotTexture;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.35, "rgba(255,255,255,0.85)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  dotTexture = new CanvasTexture(c);
  return dotTexture;
}

/** A seeded random, so the network looks the same on every visit. */
function seeded(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Nodes on the globe joined by lifted arcs; cyan pulses travel along them like blocks propagating. */
function DataNetwork({ reduced }) {
  const net = useMemo(() => {
    const rand = seeded(20261005);
    const R = 1.012;
    // Hubs on land, spread out: a greedy pick from the continent dots.
    const land = WORLD_DOTS.split(";").map((pair) => {
      const [lat, lon] = pair.split(",").map(Number);
      const la = (lat * Math.PI) / 180,
        lo = (lon * Math.PI) / 180;
      return new Vector3(Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo));
    });
    for (let i = land.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [land[i], land[j]] = [land[j], land[i]];
    }
    const nodes = [];
    for (const p of land) {
      if (nodes.length >= 34) break;
      if (nodes.every((n) => n.distanceTo(p) > 0.3)) nodes.push(p);
    }
    const pairs = new Set();
    const arcs = [];
    nodes.forEach((a, i) => {
      const near = nodes
        .map((b, j) => ({ j, d: a.distanceTo(b) }))
        .filter((x) => x.j !== i)
        .sort((x, y) => x.d - y.d)
        .slice(0, 2 + (rand() < 0.3 ? 1 : 0));
      for (const { j } of near) {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (pairs.has(key)) continue;
        pairs.add(key);
        arcs.push([i, j]);
      }
    });
    const SEG = 18;
    const curves = arcs.map(([i, j]) => {
      const a = nodes[i],
        b = nodes[j];
      const lift = 0.02 + a.distanceTo(b) * 0.12;
      const pts = [];
      for (let k = 0; k <= SEG; k++) {
        const t = k / SEG;
        const p = new Vector3().copy(a).lerp(b, t).normalize().multiplyScalar(R + lift * Math.sin(Math.PI * t));
        pts.push(p);
      }
      return pts;
    });
    const linePos = [];
    for (const pts of curves) for (let k = 0; k < pts.length - 1; k++) linePos.push(pts[k].x, pts[k].y, pts[k].z, pts[k + 1].x, pts[k + 1].y, pts[k + 1].z);
    const lineGeo = new BufferGeometry();
    lineGeo.setAttribute("position", new Float32BufferAttribute(linePos, 3));
    const nodeGeo = new BufferGeometry();
    nodeGeo.setAttribute("position", new Float32BufferAttribute(nodes.flatMap((n) => [n.x * R, n.y * R, n.z * R]), 3));
    const P = 26;
    const pulses = Array.from({ length: P }, () => ({ c: Math.floor(rand() * curves.length), t: rand(), v: 0.18 + rand() * 0.3 }));
    const pulseGeo = new BufferGeometry();
    pulseGeo.setAttribute("position", new Float32BufferAttribute(new Float32Array(P * 3), 3));
    return { curves, lineGeo, nodeGeo, pulses, pulseGeo, SEG };
  }, []);
  useFrame((_, delta) => {
    const pos = net.pulseGeo.attributes.position;
    const dt = reduced ? 0 : Math.min(delta, 0.05);
    net.pulses.forEach((p, i) => {
      p.t += p.v * dt;
      if (p.t >= 1) {
        p.t = 0;
        p.c = (p.c * 7 + 3) % net.curves.length;
      }
      const pts = net.curves[p.c];
      const f = p.t * net.SEG,
        k = Math.min(Math.floor(f), net.SEG - 1),
        u = f - k;
      const a = pts[k],
        b = pts[k + 1];
      pos.setXYZ(i, a.x + (b.x - a.x) * u, a.y + (b.y - a.y) * u, a.z + (b.z - a.z) * u);
    });
    pos.needsUpdate = true;
  });
  const dot = getDotTexture();
  return (
    <group>
      <lineSegments geometry={net.lineGeo} renderOrder={6}>
        <lineBasicMaterial color="#8b5cf6" transparent opacity={0.6} depthWrite={false} />
      </lineSegments>
      <points geometry={net.nodeGeo} renderOrder={6}>
        <pointsMaterial size={7} sizeAttenuation={false} map={dot} color="#6d28d9" transparent alphaTest={0.02} depthWrite={false} />
      </points>
      <points geometry={net.pulseGeo} renderOrder={6}>
        <pointsMaterial size={10} sizeAttenuation={false} map={dot} color="#06b6d4" transparent alphaTest={0.02} depthWrite={false} />
      </points>
    </group>
  );
}

/** A bright point with a fading tail, lying along a ring of radius R. `dir` is the way it travels. */
function comet(R, dir, color) {
  const c = new Color(color);
  const pos = [],
    col = [];
  const steps = 40,
    span = 0.75;
  for (let i = 0; i <= steps; i++) {
    const a = -dir * (i / steps) * span;
    pos.push(Math.cos(a) * R, Math.sin(a) * R, 0);
    col.push(c.r, c.g, c.b, (1 - i / steps) ** 2);
  }
  const tail = new BufferGeometry();
  tail.setAttribute("position", new Float32BufferAttribute(pos, 3));
  tail.setAttribute("color", new Float32BufferAttribute(col, 4));
  const head = new BufferGeometry();
  head.setAttribute("position", new Float32BufferAttribute([R, 0, 0], 3));
  return { tail, head };
}

/**
 * Two thin instrument rings around the globe. A plain circle turning on its own axis looks still, so each ring
 * also swings slowly around the vertical, like a gyroscope, and carries a point of light that runs along it.
 */
function OrbitRings({ reduced }) {
  const swingA = useRef(null),
    swingB = useRef(null),
    ticksA = useRef(null),
    runA = useRef(null),
    runB = useRef(null);
  const dot = useMemo(getDotTexture, []);
  const ticks = useMemo(() => {
    const pos = [];
    const R = 2.78;
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      const len = i % 8 === 0 ? 0.09 : 0.035;
      pos.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a) * (R + len), Math.sin(a) * (R + len), 0);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  const cometA = useMemo(() => comet(2.78, 1, "#7c3aed"), []);
  const cometB = useMemo(() => comet(3.05, -1, "#06b6d4"), []);
  useFrame((_, delta) => {
    if (reduced || !swingA.current) return;
    const dt = Math.min(delta, 0.05);
    swingA.current.rotation.y += dt * 0.14;
    swingB.current.rotation.y -= dt * 0.1;
    ticksA.current.rotation.z += dt * 0.05;
    runA.current.rotation.z += dt * 0.45;
    runB.current.rotation.z -= dt * 0.32;
  });
  return (
    <group>
      <group ref={swingA}>
        <group rotation={[1.2, 0.25, 0]}>
          <mesh>
            <torusGeometry args={[2.78, 0.0045, 6, 220]} />
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.6} depthWrite={false} />
          </mesh>
          <lineSegments ref={ticksA} geometry={ticks}>
            <lineBasicMaterial color="#c4b5fd" transparent opacity={0.7} depthWrite={false} />
          </lineSegments>
          <group ref={runA}>
            <line geometry={cometA.tail}>
              <lineBasicMaterial vertexColors transparent depthWrite={false} />
            </line>
            <points geometry={cometA.head}>
              <pointsMaterial size={11} sizeAttenuation={false} map={dot} color="#7c3aed" transparent alphaTest={0.02} depthWrite={false} />
            </points>
          </group>
        </group>
      </group>
      <group ref={swingB}>
        <group rotation={[1.45, -0.45, 0.3]}>
          <mesh>
            <torusGeometry args={[3.05, 0.003, 6, 220]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.4} depthWrite={false} />
          </mesh>
          <group ref={runB} rotation={[0, 0, 2.4]}>
            <line geometry={cometB.tail}>
              <lineBasicMaterial vertexColors transparent depthWrite={false} />
            </line>
            <points geometry={cometB.head}>
              <pointsMaterial size={11} sizeAttenuation={false} map={dot} color="#06b6d4" transparent alphaTest={0.02} depthWrite={false} />
            </points>
          </group>
        </group>
      </group>
    </group>
  );
}

// ------------------------------------------------------------------ render quality
function chooseRenderQuality() {
  if (typeof navigator === "undefined") return "low";
  const device = navigator;
  const preference = new URLSearchParams(location.search).get("quality");
  if (preference === "high") return "high";
  if (preference === "low") return "low";
  const mobile = matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) < 900;
  const limited = (device.hardwareConcurrency || 4) <= 4 || (device.deviceMemory !== undefined && device.deviceMemory <= 4);
  const slowConnection = device.connection?.saveData || /(^|-)2g$/.test(device.connection?.effectiveType || "");
  return mobile || limited || slowConnection ? "low" : "high";
}
const renderQuality = chooseRenderQuality();

function AdaptiveResolution({ active }) {
  const setDpr = useThree((state) => state.setDpr);
  const maximum = Math.min((typeof window !== "undefined" ? window.devicePixelRatio : 1) || 1, renderQuality === "low" ? 1.25 : 2);
  const minimum = Math.min(maximum, renderQuality === "low" ? 1 : 1.25);
  const sample = useRef({ warmup: 3, time: 0, frames: 0, goodWindows: 0, dpr: maximum });
  useEffect(() => {
    sample.current.warmup = 3;
    sample.current.time = 0;
    sample.current.frames = 0;
    sample.current.goodWindows = 0;
  }, [active]);
  useFrame((state, delta) => {
    const s = sample.current;
    if (!active || delta <= 0) return;
    if (s.warmup > 0) {
      s.warmup -= Math.min(delta, 0.1);
      return;
    }
    if (delta > 0.12) {
      s.time = 0;
      s.frames = 0;
      return;
    }
    s.time += delta;
    s.frames++;
    if (s.time < 2) return;
    const frameTime = s.time / s.frames;
    s.dpr = state.viewport.dpr;
    let next = s.dpr;
    if (frameTime > 1 / 48) {
      next = Math.max(minimum, s.dpr - 0.25);
      s.goodWindows = 0;
    } else if (frameTime < 1 / 57) {
      if (++s.goodWindows >= 4) {
        next = Math.min(maximum, s.dpr + 0.25);
        s.goodWindows = 0;
      }
    } else s.goodWindows = 0;
    s.time = 0;
    s.frames = 0;
    if (next !== s.dpr) {
      s.dpr = next;
      setDpr(next);
      s.warmup = 1;
    }
  });
  return null;
}

// ------------------------------------------------------------------ the planet scene
function ResponsiveCamera() {
  const { size, camera } = useThree();
  useEffect(() => {
    camera.zoom = size.width / (size.width < 700 ? 5.65 : 5.25);
    camera.updateProjectionMatrix();
  }, [size.width, size.height, camera]);
  return null;
}
/** Coastlines as thin lines just above the glass. `ghost` draws the far side, faint, through the globe. */
function Coastlines({ ghost = false }) {
  const geo = useMemo(() => {
    const pos = [];
    const R = 1.003;
    const v = (lat, lon) => {
      const la = (lat * Math.PI) / 180,
        lo = (lon * Math.PI) / 180;
      return [Math.cos(la) * Math.sin(lo) * R, Math.sin(la) * R, Math.cos(la) * Math.cos(lo) * R];
    };
    for (const line of WORLD_LINES.split("|")) {
      const pts = line.split(";").map((p) => p.split(",").map(Number));
      for (let i = 0; i < pts.length - 1; i++) {
        // Skip jumps (a ring crossing the dateline or the cut-off south).
        if (Math.abs(pts[i][1] - pts[i + 1][1]) > 20 || Math.abs(pts[i][0] - pts[i + 1][0]) > 20) continue;
        pos.push(...v(pts[i][0], pts[i][1]), ...v(pts[i + 1][0], pts[i + 1][1]));
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  return ghost ? (
    <lineSegments geometry={geo} renderOrder={1}>
      <lineBasicMaterial color="#a78bfa" transparent opacity={0.2} depthTest={false} depthWrite={false} />
    </lineSegments>
  ) : (
    <lineSegments geometry={geo} renderOrder={5}>
      <lineBasicMaterial color="#6d28d9" transparent opacity={0.85} depthWrite={false} />
    </lineSegments>
  );
}

function World({ motion, reduced, onReady }) {
  const planet = useRef(null);
  useEffect(() => {
    onReady?.(true);
  }, [onReady]);
  const glass = useMemo(() => glassMaterial(false), []);
  const glassBack = useMemo(() => glassMaterial(true), []);
  const depth = useMemo(depthOnly, []);
  const globe = useMemo(createGlobeMotion, []);
  const size = useThree((state) => state.size);
  const small = size.width < 700;
  // The camera shows a fixed width in world units (ResponsiveCamera). On a wide screen the globe's center sits just
  // below the bottom edge, so a little less than its upper half shows, like a horizon. On a phone the stage is tall
  // and narrow, so the globe is as wide as the screen and nearly all of it shows.
  const worldW = small ? 5.65 : 5.25;
  const worldH = (size.height * worldW) / size.width;
  const radius = Math.min(worldW * (small ? 0.5 : 0.44), worldH * (small ? 0.52 : 0.82));
  const centerY = -worldH / 2 + radius * (small ? 0.9 : -0.15);
  useFrame((_, delta) => {
    const m = motion.current;
    const elapsed = Math.min(delta, 0.05),
      count = Math.ceil(elapsed / (1 / 120));
    if (!reduced) cyberUniforms.uTime.value += elapsed;
    for (let i = 0; i < count; i++) stepGlobeMotion(globe, m, elapsed / count, reduced);
    planet.current.quaternion.copy(globe.orientation);
  });
  return (
    <group position={[0, centerY, 0]}>
      <group ref={planet} scale={radius} quaternion={globe.orientation}>
        {/* Far side first (faint), then a depth-only shell, then the bright front layers. */}
        <mesh material={glassBack} renderOrder={1}>
          <sphereGeometry args={[1, 96, 64]} />
        </mesh>
        <Coastlines ghost />
        <mesh material={depth} renderOrder={2} scale={0.985}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
        <mesh material={glass} renderOrder={4}>
          <sphereGeometry args={[1, 128, 96]} />
        </mesh>
        <Coastlines />
        <DataNetwork reduced={reduced} />
      </group>
      <group scale={radius / 2.25}>
        <OrbitRings reduced={reduced} />
      </group>
    </group>
  );
}
function PlanetScene(props) {
  const lowPower = renderQuality === "low";
  return (
    <Canvas orthographic camera={{ position: [0, 0, 9], zoom: 150, near: 0.1, far: 30 }} dpr={lowPower ? [1, 1.25] : [1, 2]} frameloop={props.active ? "always" : "never"} gl={{ antialias: true, alpha: true, powerPreference: lowPower ? "low-power" : "high-performance" }}>
      <ResponsiveCamera />
      <AdaptiveResolution active={props.active} />
      {/* Cool, low key light so the emissive grid and rims carry the look; a cyan back light outlines the shapes. */}
      <ambientLight intensity={0.45} />
      <hemisphereLight args={["#ece6ff", "#1e1240", 1.1]} />
      <directionalLight position={[-3, 5, 5]} intensity={2.2} color="#f3eeff" />
      <directionalLight position={[3, 2, -2]} intensity={2.4} color="#22d3ee" />
      <World {...props} />
    </Canvas>
  );
}
const LazyPlanetScene = lazy(() => Promise.resolve({ default: PlanetScene }));

// ------------------------------------------------------------------ the page
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("3D scene failed:", error);
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        <p>We couldn’t load this little world.</p>
        <button onClick={() => location.reload()}>Try again</button>
      </div>
    ) : (
      this.props.children
    );
  }
}

/** Lines of the slogan. They settle out of random capitals once when the page opens, and again whenever the pointer
 * comes onto them. Screen readers get the plain sentence. */
function ScrambleLines({ as: Tag, lines, ...props }) {
  const [playing, setPlaying] = useState(true);
  return (
    <Tag aria-label={lines.join(" ")} onPointerEnter={() => setPlaying(true)} {...props}>
      {lines.map((line, i) => (
        <TextScramble key={line} as="span" aria-hidden="true" className="scramble-line" trigger={playing} duration={0.6 + i * 0.2} speed={0.035} characterSet="ABCDEFGHIJKLMNOPQRSTUVWXYZ" onScrambleComplete={i === lines.length - 1 ? () => setPlaying(false) : undefined}>
          {line}
        </TextScramble>
      ))}
    </Tag>
  );
}

function HeroPage() {
  const motion = useRef(createMotion());
  const interaction = useRef(null);
  const drag = useRef(null);
  const [visible, setVisible] = useState(true),
    [tabVisible, setTabVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [sceneMounted, setSceneMounted] = useState(false);
  const [dragging, setDragging] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setTabVisible(!document.hidden);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    change();
    query.addEventListener("change", change);
    const onVisibility = () => {
      setTabVisible(!document.hidden);
      if (document.hidden) {
        motion.current.dragging = false;
        drag.current = null;
        setDragging(false);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.01 });
    if (interaction.current) observer.observe(interaction.current);
    return () => {
      query.removeEventListener("change", change);
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    };
  }, []);
  useEffect(() => {
    let frame = 0,
      timeout = 0;
    frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => {
        timeout = window.setTimeout(() => setSceneMounted(true), 100);
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timeout);
    };
  }, []);
  const release = (id) => {
    if (drag.current?.id !== id) return;
    drag.current = null;
    motion.current.dragging = false;
    setDragging(false);
  };
  const nudge = (direction) => {
    motion.current.planetVelocity += direction * 0.65;
  };
  return (
    <div className="page">
      <CursorCrosshair />
      {/* Room for the site header, which App.tsx lays over every page (SiteHeader.tsx). */}
      <div className="site-header" aria-hidden="true" />
      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <ScrambleLines as="h1" id="hero-title" className="hero-statement" lines={["See the real.", "Tell the story.", "Drive the change."]} />
            <ScrambleLines as="p" className="hero-statement hero-note" lines={["AI-powered housing insight", "for every city."]} />
          </div>
          <div className="visual-column">
            <div
              ref={interaction}
              id="planet"
              className={`planet-stage ${dragging ? "dragging" : ""}`}
              tabIndex={0}
              role="group"
              aria-roledescription="interactive 3D planet"
              aria-label="Rotate the planet"
              aria-describedby="planet-instructions"
              onPointerDown={(event) => {
                if (!event.isPrimary || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
                const m = motion.current;
                m.dragTarget = m.planetAngle;
                m.pitchTarget = m.pitchAngle;
                m.dragging = true;
                setDragging(true);
              }}
              onPointerMove={(event) => {
                if (drag.current?.id !== event.pointerId) return;
                const dx = event.clientX - drag.current.x,
                  dy = event.clientY - drag.current.y;
                // A drag across the stage is about two full turns; the target may lead the globe by up to 1.4 rad.
                const sensitivity = 13 / Math.max(360, event.currentTarget.clientWidth);
                const m = motion.current;
                m.dragTarget = Math.max(m.planetAngle - 1.4, Math.min(m.planetAngle + 1.4, m.dragTarget + dx * sensitivity));
                m.pitchTarget = Math.max(m.pitchAngle - 1, Math.min(m.pitchAngle + 1, m.pitchTarget + dy * sensitivity * 0.7));
                drag.current.x = event.clientX;
                drag.current.y = event.clientY;
              }}
              onPointerUp={(event) => release(event.pointerId)}
              onPointerCancel={(event) => release(event.pointerId)}
              onLostPointerCapture={(event) => release(event.pointerId)}
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                  event.preventDefault();
                  nudge(event.key === "ArrowRight" ? 1 : -1);
                }
                if (event.key === "ArrowUp" || event.key === "ArrowDown") {
                  event.preventDefault();
                  motion.current.pitchVelocity += event.key === "ArrowDown" ? 0.4 : -0.4;
                }
              }}
            >
              {sceneMounted && (
                <SceneBoundary>
                  <Suspense fallback={null}>
                    <LazyPlanetScene motion={motion} active={visible && tabVisible} reduced={reduced} onReady={setReady} />
                  </Suspense>
                </SceneBoundary>
              )}
              {!ready && (
                <div className="loading" role="status">
                  <span />
                  Loading the globe…
                </div>
              )}
            </div>
          </div>
          <p id="planet-instructions" className="sr-only">
            Drag in any direction, or use the arrow keys, to rotate the 3D globe. On touch screens, swipe outside the globe to scroll the page.
          </p>
        </section>
      </main>
    </div>
  );
}
// ------------------------------------------------------------------ styles (scoped to .orbit-delivery), in violet
const css = `@font-face{font-family:'Orbit Libre Caslon';font-style:normal;font-weight:400;font-display:swap;src:url('https://cdn.21st.dev/assets/mirror/d7/d7157ad1851673258b7bf8b9d16654e90ca5f2d687aa0c71506d83266e0a20a2.woff2') format('woff2')}
.orbit-delivery{font-family:'DM Sans',sans-serif;color:#160e2b;background:#f8f6ff;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;font-weight:400;color-scheme:light}
.orbit-delivery *{box-sizing:border-box}.orbit-delivery{margin:0}.orbit-delivery button,.orbit-delivery a{-webkit-tap-highlight-color:transparent}.orbit-delivery button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}.orbit-delivery button:disabled{cursor:default;opacity:.55}.orbit-delivery button:focus-visible,.orbit-delivery a:focus-visible{outline:2px solid #7c3aed;outline-offset:6px}.orbit-delivery a{color:inherit;text-decoration:none}.orbit-delivery svg{display:block}.orbit-delivery button svg{width:22px;height:22px}.orbit-delivery .page{height:100svh;min-height:760px;position:relative;overflow:hidden;background:radial-gradient(ellipse at 6% 15%,#fffdfb 0%,#fcfbff 38%,#f3eeff 100%);display:flex;flex-direction:column}.orbit-delivery .explore-button:not(:disabled):hover{background:#6d28d9}.orbit-delivery main{flex:1;min-height:0;display:flex}.orbit-delivery .hero{width:100%;position:relative}.orbit-delivery .hero-copy{position:relative;z-index:3;margin-left:6.5%;padding-top:clamp(14px,3.4vh,46px);width:45%;pointer-events:none}.orbit-delivery .hero-copy button{pointer-events:auto}.orbit-delivery .eyebrow{text-transform:uppercase;letter-spacing:.36em;font-size:12px;font-weight:500;color:#8b5cf6;margin:0 0 21px}.orbit-delivery h1{font-size:clamp(66px,5.55vw,100px);font-weight:550;letter-spacing:-.064em;line-height:1.03;margin:0 0 26px}.orbit-delivery h1 em{font-family:'Orbit Libre Caslon',Georgia,serif;font-size:1.12em;font-weight:400;letter-spacing:-.035em;color:#7c3aed;line-height:.7}.orbit-delivery .hero-description{color:#7f7699;font-size:clamp(16px,1.25vw,21px);line-height:1.45;letter-spacing:-.3px;margin:0 0 30px}.orbit-delivery .explore-button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-width:183px;padding:17px 29px;border-radius:32px;background:#7c3aed;color:white;font-size:16px;min-height:55px;box-shadow:inset 0 1px 0 #ffffff30,0 14px 30px -12px #7c3aed99;transition:background .2s,transform .2s}.orbit-delivery .explore-button:not(:disabled):hover{transform:translateY(-2px)}.orbit-delivery .explore-button:not(:disabled):active{transform:translateY(0)}.orbit-delivery .visual-column{position:absolute;left:0;right:0;top:0;width:100%;height:100%;z-index:1}.orbit-delivery .visual-column::before{content:'';position:absolute;inset:4% 2% 0 8%;background-image:linear-gradient(#7c3aed17 1px,transparent 1px),linear-gradient(90deg,#7c3aed17 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 100%,#000 18%,transparent 62%);mask-image:radial-gradient(ellipse at 50% 100%,#000 18%,transparent 62%);pointer-events:none}.orbit-delivery .planet-stage{height:100%;width:100%;position:relative;cursor:grab;touch-action:none;user-select:none;outline:none}.orbit-delivery .planet-stage:focus-visible{outline:1px dashed #c4b5fd;outline-offset:-15px;border-radius:36px}.orbit-delivery .planet-stage.dragging{cursor:grabbing}.orbit-delivery .planet-caption{position:absolute;right:6.2%;top:17%;z-index:3;width:160px;pointer-events:none;color:#b7a8dc;transition:opacity .2s}.orbit-delivery .planet-caption p{font-size:15px;line-height:1.35;font-style:italic;text-align:right;margin:0}.orbit-delivery .planet-caption svg{width:160px;height:149px;margin-top:-17px;margin-left:-32px}.orbit-delivery .planet-caption.is-dragging{opacity:.6}.orbit-delivery .cloud-bank{position:absolute;z-index:2;inset:auto -12% -90px 24%;height:250px;pointer-events:none;filter:blur(17px);opacity:.95}.orbit-delivery .cloud-bank i{position:absolute;bottom:0;background:radial-gradient(ellipse at 42% 34%,#fffdfe 27%,#f6f2ff 59%,#ebe3fd88 75%,transparent 80%);border-radius:50%}.orbit-delivery .cloud-bank i:nth-child(1){width:390px;height:200px;left:0;bottom:-28px;transform:rotate(-25deg)}.orbit-delivery .cloud-bank i:nth-child(2){width:265px;height:195px;left:14%;bottom:32px}.orbit-delivery .cloud-bank i:nth-child(3){width:270px;height:170px;left:29%;bottom:-2px}.orbit-delivery .cloud-bank i:nth-child(4){width:350px;height:200px;right:7%;bottom:-20px}.orbit-delivery .cloud-bank i:nth-child(5){width:280px;height:215px;right:-2%;bottom:70px}.orbit-delivery .loading{position:absolute;top:42%;left:25%;right:20%;display:flex;align-items:center;justify-content:center;gap:12px;color:#9183c4;font-size:12px;pointer-events:none}.orbit-delivery .loading>span{width:17px;height:17px;border:1px solid #e4dcff;border-top-color:#8b5cf6;border-radius:50%;animation:loading 1.2s linear infinite}@keyframes loading{to{transform:rotate(360deg)}}.orbit-delivery .scene-fallback{position:absolute;inset:35% 20%;font-size:15px;text-align:center;color:#8475b4;z-index:5}.orbit-delivery .scene-fallback button{background:#7c3aed;border-radius:20px;color:white;padding:10px 20px}.orbit-delivery .about-dialog{border:1px solid #e6defa;border-radius:22px;padding:48px;max-width:510px;width:calc(100% - 32px);background:#fbf9ff;color:#160e2b;box-shadow:0 25px 120px #3c187326}.orbit-delivery .about-dialog::backdrop{background:#2e1a5c33;backdrop-filter:blur(8px)}.orbit-delivery .about-dialog h2{font-size:36px;font-weight:500;letter-spacing:-1.6px;line-height:1.15;margin:26px 0 22px}.orbit-delivery .about-dialog p{font-size:15px;line-height:1.75;color:#7f7699}.orbit-delivery .about-dialog .explore-button{margin-top:16px;font-size:14px}.orbit-delivery .close-dialog{position:absolute;right:20px;top:10px;font-size:30px;color:#9081bf}.orbit-delivery .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(min-width:1800px){.orbit-delivery .hero-copy{padding-top:15vh}.orbit-delivery .page{min-height:950px}}
@media(max-width:1150px){.orbit-delivery .hero-copy{margin-left:5%;padding-top:100px;width:48%}.orbit-delivery h1{font-size:65px}.orbit-delivery .hero-description{font-size:15px;max-width:370px}.orbit-delivery .planet-caption{right:4%;top:18%;width:115px}.orbit-delivery .planet-caption p{font-size:12px}.orbit-delivery .planet-caption svg{width:130px;margin-left:-24px}.orbit-delivery .page{min-height:760px}.orbit-delivery .explore-button{font-size:15px;min-width:168px}}
@media(max-width:759px){.orbit-delivery .page{height:auto;min-height:100svh}.orbit-delivery main{display:block}.orbit-delivery .hero{display:flex;flex-direction:column}.orbit-delivery .hero-copy{width:calc(100% - 50px);margin:0 25px;padding-top:8px;pointer-events:auto}.orbit-delivery .eyebrow{font-size:9px;letter-spacing:.33em;margin-bottom:18px}.orbit-delivery h1{font-size:clamp(54px,12vw,80px);margin-bottom:23px;line-height:1.025}.orbit-delivery .hero-description{font-size:15px;line-height:1.6;max-width:340px;margin-bottom:24px}.orbit-delivery .desktop-break{display:none}.orbit-delivery .explore-button{padding:15px 24px;min-height:51px;min-width:163px;font-size:14px}.orbit-delivery .visual-column{position:relative;width:100%;left:0;height:clamp(360px,90vw,560px);margin-top:12px}.orbit-delivery .planet-caption{top:auto;bottom:290px;right:18px;width:96px}.orbit-delivery .planet-caption p{font-size:11px}.orbit-delivery .planet-caption svg{width:92px;height:94px;margin-left:-13px;margin-top:-3px}.orbit-delivery .cloud-bank{left:-20%;right:-20%;height:185px;bottom:-50px;filter:blur(14px)}.orbit-delivery .cloud-bank i:nth-child(1){width:210px;height:140px;left:-10%;bottom:12px}.orbit-delivery .cloud-bank i:nth-child(2){width:170px;height:150px;left:10%;bottom:-32px}.orbit-delivery .cloud-bank i:nth-child(3){width:180px;height:130px;left:35%;bottom:-35px}.orbit-delivery .cloud-bank i:nth-child(4){width:210px;height:160px;right:-5%;bottom:-5px}.orbit-delivery .cloud-bank i:nth-child(5){width:120px;height:120px;right:8%;bottom:0}.orbit-delivery .about-dialog{padding:35px}.orbit-delivery .about-dialog h2{font-size:31px}}
@media(prefers-reduced-motion:reduce){.orbit-delivery *,.orbit-delivery *::before,.orbit-delivery *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}.orbit-delivery .explore-button:not(:disabled):hover{transform:none}}.orbit-delivery .hero-copy h1 em{line-height:.92}.orbit-delivery .hero-copy .explore-button{gap:13px}
.orbit-delivery{width:100%;isolation:isolate;--orbit-bg:radial-gradient(ellipse at 6% 15%,#fffdfb 0%,#fcfbff 38%,#f3eeff 100%);--orbit-ink:#160e2b;--orbit-muted:#7f7699;--orbit-nav:#5b4d83;--orbit-accent:#7c3aed;--orbit-cloud:.55;color:var(--orbit-ink)}
:is(.dark,[data-theme="dark"]) .orbit-delivery:not([data-theme="light"]),.orbit-delivery[data-theme="dark"]{--orbit-bg:radial-gradient(ellipse at 6% 15%,#1d1532 0%,#120d26 50%,#1a1038 100%);--orbit-ink:#f6f3ff;--orbit-muted:#c0b0d9;--orbit-nav:#cfc2e8;--orbit-accent:#b69cff;--orbit-cloud:.14;color-scheme:dark}
.orbit-delivery .page{background:var(--orbit-bg);color:var(--orbit-ink)}
.orbit-delivery .hero-description,.orbit-delivery .about-dialog p{color:var(--orbit-muted)}
.orbit-delivery h1 em{color:var(--orbit-accent)}
.orbit-delivery .cloud-bank{opacity:var(--orbit-cloud)}
.orbit-delivery .about-dialog{background:var(--orbit-bg);color:var(--orbit-ink)}
.orbit-delivery h1{font-family:inherit}
/* Caption type: small tracked capitals, used for every line of words on the page. */
.orbit-delivery{--orbit-caption:#a596d1;--orbit-caption-mid:#7a69b5;--orbit-caption-strong:#3b2d6b;--orbit-rule:#c2b5e0}
:is(.dark,[data-theme="dark"]) .orbit-delivery:not([data-theme="light"]),.orbit-delivery[data-theme="dark"]{--orbit-caption-mid:#c0b0d9;--orbit-caption-strong:#f6f3ff;--orbit-rule:#5a4a8a}
.orbit-delivery h1.hero-statement::before{content:'';display:block;width:25px;height:1px;background:var(--orbit-rule);margin-bottom:14px}
.orbit-delivery h1.hero-statement::before{margin-bottom:22px}
.orbit-delivery .hero-statement{font-size:clamp(14px,1.12vw,17px);font-weight:500;text-transform:uppercase;letter-spacing:.25em;line-height:1.9;color:var(--orbit-caption-strong);margin:0}
.orbit-delivery .hero-note{font-weight:400;color:var(--orbit-caption-mid);margin-top:1.15em}
.orbit-delivery .loading{font-size:10px;text-transform:uppercase;letter-spacing:.25em}
/* With a mouse, the crosshair's square (ui/cursor-crosshair.tsx) is the pointer over the globe. */
@media(hover:hover) and (pointer:fine){.orbit-delivery .planet-stage,.orbit-delivery .planet-stage.dragging{cursor:none}}
@media(max-width:759px){.orbit-delivery h1.hero-statement::before{width:20px;margin-bottom:16px}.orbit-delivery .hero-statement{font-size:12px;letter-spacing:.2em}}
/* Phones: the globe's stage takes whatever height is left, so the hero fills the screen with no empty band below it. */
@media(max-width:759px){.orbit-delivery main{display:flex}.orbit-delivery .hero{flex:1}.orbit-delivery .visual-column{flex:1;height:auto;min-height:clamp(360px,90vw,560px)}}
.orbit-delivery .site-header{height:var(--header-h);flex:none}
/* The slogan takes the pointer (its hover plays the scramble); the rest of the copy block lets drags through to the globe. */
.orbit-delivery .hero-statement{pointer-events:auto;width:fit-content;cursor:default}
.orbit-delivery .scramble-line{display:block;white-space:nowrap}
@media(hover:hover) and (pointer:fine){.orbit-delivery .hero-statement{cursor:none}}
`;

/** The start page's hero: the slogan and the globe. The site header is laid over it by App.tsx. */
export interface OrbitDeliveryHeroProps {
  theme?: "light" | "dark" | "auto";
}
export default function OrbitDeliveryHero({ theme = "light" }: OrbitDeliveryHeroProps) {
  return (
    <div className="orbit-delivery" data-theme={theme}>
        <style>{css}</style>
        <HeroPage />
    </div>
  );
}
