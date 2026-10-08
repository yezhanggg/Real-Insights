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
/** The camera always shows this many world units across, whatever the stage's size. */
const WORLD_W = 5.25;
/** The same condition as the stacked layout in the CSS below: a portrait screen, or a very narrow one. */
const STACKED = "(orientation: portrait), (max-width: 539px)";
/**
 * Where the globe sits, for a stage of any shape (world units; the origin is the middle of the stage).
 * - Stacked (portrait): the stage is the room under the slogan. The globe is as wide as the screen, or as tall as the
 *   room allows, and nearly all of it shows.
 * - Landscape: the stage is the whole hero and the slogan lies over its top left. The globe is a horizon on the
 *   bottom edge, centered and wide when there is room. `copy` is the slogan's lower right corner in stage pixels;
 *   when the globe would reach it (a phone on its side, a low window), the globe shrinks and slides right, step by
 *   step, until it is clear.
 */
function globeLayout(width, height, stacked, copy) {
  const worldH = (height * WORLD_W) / width;
  if (stacked) {
    const radius = Math.min(WORLD_W * 0.5, worldH * 0.52);
    return { radius, x: 0, y: -worldH / 2 + radius * 0.9 };
  }
  const px = WORLD_W / width;
  const corner = copy ? { x: (copy.right - width / 2) * px, y: (height / 2 - copy.bottom) * px } : null;
  let layout;
  for (let step = 0; step <= 30; step++) {
    // Steps 0–20 slide the globe from centered and wide to right and narrow; after that it only gets smaller.
    const t = Math.min(1, step / 20);
    const shrink = step > 20 ? 0.94 ** (step - 20) : 1;
    const radius = Math.min(WORLD_W * MathUtils.lerp(0.44, 0.3, t), worldH * MathUtils.lerp(0.82, 0.95, t)) * shrink;
    layout = { radius, x: Math.min(WORLD_W * 0.22 * t, WORLD_W / 2 - radius * 0.86), y: -worldH / 2 - radius * MathUtils.lerp(0.15, 0.1, t) };
    if (!corner || Math.hypot(corner.x - layout.x, corner.y - layout.y) >= radius * 1.07 + 14 * px) break;
  }
  return layout;
}
function ResponsiveCamera() {
  const { size, camera } = useThree();
  useEffect(() => {
    camera.zoom = size.width / WORLD_W;
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

function World({ motion, reduced, stacked, copy, onReady }) {
  const planet = useRef(null);
  useEffect(() => {
    onReady?.(true);
  }, [onReady]);
  const glass = useMemo(() => glassMaterial(false), []);
  const glassBack = useMemo(() => glassMaterial(true), []);
  const depth = useMemo(depthOnly, []);
  const globe = useMemo(createGlobeMotion, []);
  const size = useThree((state) => state.size);
  const { radius, x: centerX, y: centerY } = globeLayout(size.width, size.height, stacked, copy);
  useFrame((_, delta) => {
    const m = motion.current;
    const elapsed = Math.min(delta, 0.05),
      count = Math.ceil(elapsed / (1 / 120));
    if (!reduced) cyberUniforms.uTime.value += elapsed;
    for (let i = 0; i < count; i++) stepGlobeMotion(globe, m, elapsed / count, reduced);
    planet.current.quaternion.copy(globe.orientation);
  });
  return (
    <group position={[centerX, centerY, 0]}>
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
  const [stacked, setStacked] = useState(() => typeof matchMedia !== "undefined" && matchMedia(STACKED).matches);
  // The slogan's lower right corner, in the stage's own pixels, so the globe can keep clear of it (landscape only).
  const copyRef = useRef(null);
  const [copy, setCopy] = useState(null);
  useEffect(() => {
    const measure = () => {
      const stage = interaction.current?.getBoundingClientRect();
      const text = copyRef.current?.getBoundingClientRect();
      if (!stage || !text) return;
      const next = { right: Math.round(text.right - stage.left), bottom: Math.round(text.bottom - stage.top) };
      setCopy((old) => (old && old.right === next.right && old.bottom === next.bottom ? old : next));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (copyRef.current) observer.observe(copyRef.current);
    if (interaction.current) observer.observe(interaction.current);
    return () => observer.disconnect();
  }, [stacked]);
  const [sceneMounted, setSceneMounted] = useState(false);
  const [dragging, setDragging] = useState(false),
    [ready, setReady] = useState(false);
  useEffect(() => {
    setTabVisible(!document.hidden);
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    change();
    query.addEventListener("change", change);
    const layout = matchMedia(STACKED);
    const relayout = () => setStacked(layout.matches);
    relayout();
    layout.addEventListener("change", relayout);
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
      layout.removeEventListener("change", relayout);
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
          <div className="hero-copy" ref={copyRef}>
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
                    <LazyPlanetScene motion={motion} active={visible && tabVisible} reduced={reduced} stacked={stacked} copy={copy} onReady={setReady} />
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
// Two layouts, chosen by the screen's shape, not by a device list:
//  - Landscape (the default): one screen tall. The slogan lies over the top left of the stage, the globe is a horizon.
//  - Stacked (portrait, or narrower than 540 px): header, slogan, then the stage takes all the height that is left.
// Sizes that must agree with the site header come from src/styles.css: --header-h and --gutter.
const css = `
.orbit-delivery{width:100%;isolation:isolate;font-family:'DM Sans',sans-serif;font-weight:400;font-synthesis:none;text-rendering:optimizeLegibility;-webkit-font-smoothing:antialiased;color-scheme:light;
  --orbit-bg:radial-gradient(ellipse at 6% 15%,#fffdfb 0%,#fcfbff 38%,#f3eeff 100%);--orbit-ink:#160e2b;--orbit-caption-mid:#7a69b5;--orbit-caption-strong:#3b2d6b;--orbit-rule:#c2b5e0;color:var(--orbit-ink)}
:is(.dark,[data-theme="dark"]) .orbit-delivery:not([data-theme="light"]),.orbit-delivery[data-theme="dark"]{--orbit-bg:radial-gradient(ellipse at 6% 15%,#1d1532 0%,#120d26 50%,#1a1038 100%);--orbit-ink:#f6f3ff;--orbit-caption-mid:#c0b0d9;--orbit-caption-strong:#f6f3ff;--orbit-rule:#5a4a8a;color-scheme:dark}
.orbit-delivery *{box-sizing:border-box}
.orbit-delivery button{font:inherit;color:inherit;cursor:pointer;border:0;background:none}
.orbit-delivery button:focus-visible{outline:2px solid #7c3aed;outline-offset:6px}

/* ---- landscape: slogan over the stage */
.orbit-delivery .page{position:relative;overflow:hidden;display:flex;flex-direction:column;height:100svh;min-height:320px;background:var(--orbit-bg);color:var(--orbit-ink)}
.orbit-delivery .site-header{height:var(--header-h);flex:none}
.orbit-delivery main{flex:1;min-height:0;display:flex}
.orbit-delivery .hero{width:100%;position:relative}
.orbit-delivery .hero-copy{position:relative;z-index:3;width:fit-content;max-width:calc(100% - 2 * var(--gutter));margin-left:var(--gutter);padding-top:clamp(4px,3.4vh,46px);pointer-events:none}
.orbit-delivery .visual-column{position:absolute;inset:0;z-index:1}
.orbit-delivery .visual-column::before{content:'';position:absolute;inset:4% 2% 0 8%;background-image:linear-gradient(#7c3aed17 1px,transparent 1px),linear-gradient(90deg,#7c3aed17 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(ellipse at 50% 100%,#000 18%,transparent 62%);mask-image:radial-gradient(ellipse at 50% 100%,#000 18%,transparent 62%);pointer-events:none}
.orbit-delivery .planet-stage{height:100%;width:100%;position:relative;cursor:grab;touch-action:none;user-select:none;outline:none}
.orbit-delivery .planet-stage:focus-visible{outline:1px dashed #c4b5fd;outline-offset:-15px;border-radius:36px}
.orbit-delivery .planet-stage.dragging{cursor:grabbing}

/* ---- the slogan. Caption type: small tracked capitals. The size follows the screen's shorter side, so a phone on its
   side gets the small size and a tablet either way round gets a middle one. */
.orbit-delivery .hero-statement{margin:0;width:fit-content;font-size:clamp(12px,calc(1.5vmin + 4px),17px);font-weight:500;text-transform:uppercase;letter-spacing:.25em;line-height:1.9;color:var(--orbit-caption-strong);pointer-events:auto;cursor:default}
.orbit-delivery h1.hero-statement{font-family:inherit}
.orbit-delivery h1.hero-statement::before{content:'';display:block;width:1.6em;height:1px;background:var(--orbit-rule);margin-bottom:1.35em}
.orbit-delivery .hero-note{font-weight:400;color:var(--orbit-caption-mid);margin-top:1.15em}
.orbit-delivery .scramble-line{display:block;white-space:nowrap}
/* With a mouse, the crosshair's square (ui/cursor-crosshair.tsx) is the pointer over the globe and the slogan. */
@media(hover:hover) and (pointer:fine){.orbit-delivery .planet-stage,.orbit-delivery .planet-stage.dragging,.orbit-delivery .hero-statement{cursor:none}}
/* A phone on its side, or a low window: tighter lines, so slogan and globe both fit in one short screen. */
@media(max-height:520px) and (orientation:landscape){.orbit-delivery .hero-statement{line-height:1.65}.orbit-delivery .hero-note{margin-top:.8em}.orbit-delivery h1.hero-statement::before{margin-bottom:.9em}}

/* ---- stacked: slogan, then the stage fills what is left (never less than a usable globe) */
@media(orientation:portrait),(max-width:539px){
  .orbit-delivery .page{height:auto;min-height:100svh}
  .orbit-delivery .hero{display:flex;flex-direction:column}
  .orbit-delivery .hero-copy{padding-top:clamp(6px,2.4vh,40px)}
  .orbit-delivery .visual-column{position:relative;inset:auto;flex:1;min-height:clamp(250px,76vw,640px);margin-top:clamp(8px,2vh,28px)}
  .orbit-delivery .visual-column::before{inset:0 0 0 0}
}
@media(max-width:539px){.orbit-delivery .hero-statement{letter-spacing:.2em}}

.orbit-delivery .loading{position:absolute;top:42%;left:20%;right:20%;display:flex;align-items:center;justify-content:center;gap:12px;color:#9183c4;font-size:10px;text-transform:uppercase;letter-spacing:.25em;pointer-events:none}
.orbit-delivery .loading>span{width:17px;height:17px;border:1px solid #e4dcff;border-top-color:#8b5cf6;border-radius:50%;animation:loading 1.2s linear infinite}
@keyframes loading{to{transform:rotate(360deg)}}
.orbit-delivery .scene-fallback{position:absolute;inset:35% 20%;font-size:15px;text-align:center;color:#8475b4;z-index:5}
.orbit-delivery .scene-fallback button{background:#7c3aed;border-radius:20px;color:white;padding:10px 20px}
.orbit-delivery .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(prefers-reduced-motion:reduce){.orbit-delivery *,.orbit-delivery *::before,.orbit-delivery *::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
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
