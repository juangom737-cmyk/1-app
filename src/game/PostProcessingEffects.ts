import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const RadialMotionBlurShader = {
  name: 'RadialMotionBlurShader',
  uniforms: {
    tDiffuse: { value: null },
    uStrength: { value: 0.0 }, // 0.0 to 1.0
    uCenter: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uStrength;
    uniform vec2 uCenter;
    varying vec2 vUv;

    void main() {
      if (uStrength <= 0.005) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }

      vec2 dir = vUv - uCenter;
      float dist = length(dir);
      vec4 sum = vec4(0.0);
      const int SAMPLES = 14;
      float stepFactor = (uStrength * 0.045 * dist) / float(SAMPLES);

      for (int i = 0; i < SAMPLES; i++) {
        vec2 offset = dir * (float(i) * stepFactor);
        sum += texture2D(tDiffuse, vUv - offset);
      }
      vec4 blurred = sum / float(SAMPLES);

      // Chromatic aberration streak at high Mach velocity
      if (uStrength > 0.15) {
        float chroma = uStrength * 0.014 * dist;
        blurred.r = texture2D(tDiffuse, vUv - dir * chroma).r;
        blurred.b = texture2D(tDiffuse, vUv + dir * chroma).b;
      }

      // Cinematic speed tunnel vignette on screen edges
      float vignette = 1.0 - smoothstep(0.35, 0.88, dist) * (uStrength * 0.7);
      blurred.rgb *= vignette;

      gl_FragColor = blurred;
    }
  `,
};

export interface PostProcessingController {
  composer: EffectComposer;
  bloomPass: UnrealBloomPass;
  motionBlurPass: ShaderPass;
  update: (delta: number, isFiringHeat: boolean, isSupersonic: boolean, mach: number) => void;
  setSize: (width: number, height: number) => void;
  setPixelRatio: (ratio: number) => void;
  render: () => void;
  dispose: () => void;
}

export function setupPostProcessing(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): PostProcessingController {
  const composer = new EffectComposer(renderer);

  // 1. Base Scene Render Pass
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  // 2. Cinematic Unreal Bloom Pass
  const bloomResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
  const bloomPass = new UnrealBloomPass(
    bloomResolution,
    0.35, // strength
    0.35, // radius
    0.75  // threshold
  );
  composer.addPass(bloomPass);

  // 3. Supersonic Radial Motion Blur Shader Pass
  const motionBlurPass = new ShaderPass(RadialMotionBlurShader);
  composer.addPass(motionBlurPass);

  // Both full-screen effects are expensive on integrated GPUs. Keep them
  // disabled while idle and enable them only when their power is in use.
  bloomPass.enabled = false;
  motionBlurPass.enabled = false;

  // Dynamic parameters target
  let currentStrength = 0.0;
  let currentBloomStrength = 0.0;
  let currentBloomThreshold = 0.75;
  let currentBloomRadius = 0.35;

  const update = (delta: number, isFiringHeat: boolean, isSupersonic: boolean, mach: number) => {
    // --- 1. BLOOM DYNAMICS FOR HEAT VISION ---
    // Targeted, crisp laser glow without washing out or blinding the entire viewport
    const targetBloomStrength = isFiringHeat ? 0.65 : 0.0;
    const targetBloomThreshold = isFiringHeat ? 0.60 : 0.78;
    const targetBloomRadius = isFiringHeat ? 0.45 : 0.30;

    currentBloomStrength = THREE.MathUtils.lerp(currentBloomStrength, targetBloomStrength, delta * 12);
    currentBloomThreshold = THREE.MathUtils.lerp(currentBloomThreshold, targetBloomThreshold, delta * 12);
    currentBloomRadius = THREE.MathUtils.lerp(currentBloomRadius, targetBloomRadius, delta * 12);

    bloomPass.strength = currentBloomStrength;
    bloomPass.threshold = currentBloomThreshold;
    bloomPass.radius = currentBloomRadius;

    // --- 2. MOTION BLUR DYNAMICS FOR SUPERSONIC FLIGHT ---
    // Target motion blur ramps up when supersonic (Mach 1.0+)
    let targetMotionBlur = 0.0;
    if (isSupersonic) {
      // Scales with Mach speed (Mach 1 to 5)
      const machFactor = Math.min(1.0, Math.max(0.2, (mach - 0.5) / 3.0));
      targetMotionBlur = 0.45 + machFactor * 0.45; // 0.54 - 0.90
    }

    currentStrength = THREE.MathUtils.lerp(currentStrength, targetMotionBlur, delta * 8);
    motionBlurPass.uniforms.uStrength.value = currentStrength;
    bloomPass.enabled = isFiringHeat;
    motionBlurPass.enabled = isSupersonic;
  };

  const render = () => {
    if (bloomPass.enabled || motionBlurPass.enabled) {
      composer.render();
    } else {
      // Skip the multi-pass pipeline for ordinary walking/flying.
      renderer.render(scene, camera);
    }
  };

  const setPixelRatio = (ratio: number) => {
    composer.setPixelRatio(ratio);
  };

  const setSize = (width: number, height: number) => {
    composer.setSize(width, height);
    bloomPass.resolution.set(width, height);
  };

  const dispose = () => {
    composer.dispose();
  };

  return {
    composer,
    bloomPass,
    motionBlurPass,
    update,
    setSize,
    setPixelRatio,
    render,
    dispose,
  };
}
