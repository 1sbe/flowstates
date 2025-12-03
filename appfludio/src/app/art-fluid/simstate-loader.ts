
export interface Particle {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

export interface Color3 { r: number; g: number; b: number; }

export interface SimState {
  // core UI / sim values
  gravity?: number;        // actual gravity value used by the sim
  flipRatio?: number;      // 0..1
  threshold?: number;      // 0..1

  // boolean toggles
  showParticles?: boolean;
  showGrid?: boolean;
  compensateDrift?: boolean;
  separateParticles?: boolean;


  clearColor?: number[];   // [r, g, b] (0..1)
  low?: Color3;
  high?: Color3;
  ball?: Color3;

  imageUrl?: string | null;


  particles?: Particle[];

  [key: string]: any;
}


export interface ArtFluidAPI {
  // model / scene
  scene: {
    gravity?: number;
    flipRatio?: number;
    showParticles?: boolean;
    showGrid?: boolean;
    compensateDrift?: boolean;
    separateParticles?: boolean;
    fluid?: any;
    // other fields are allowed
    [k: string]: any;
  };

  // DOM refs (ViewChild elements) - the loader will set .nativeElement.value and dispatch input events
  flipRange?: any;
  thresholdRange?: any;
  gravityRange?: any;

  redFrame?: any;
  greenFrame?: any;
  blueFrame?: any;

  sliderR?: any;
  sliderG?: any;
  sliderB?: any;

  ballSliderR?: any;
  ballSliderG?: any;
  ballSliderB?: any;

  sliderLowr?: any;
  sliderLowg?: any;
  sliderLowb?: any;

  sliderHighr?: any;
  sliderHighg?: any;
  sliderHighb?: any;

  particlesCheckbox?: any;
  gridCheckbox?: any;
  compensateCheckbox?: any;
  separateCheckbox?: any;

  // visual / numeric state
  threshold?: number;
  lowr?: number; lowg?: number; lowb?: number;
  highr?: number; highg?: number; highb?: number;
  ballr?: number; ballg?: number; ballb?: number;
  clearColor?: number[];

  particles?: Particle[];

  // helpers the component should implement (loader will call if present)
  stopSimulationAndCleanup?: () => void;
  reinitializeParticleBuffers?: (particles: Particle[]) => void;
  setSimulationImage?: (img: HTMLImageElement | null, opts?: { flip?: boolean; threshold?: number }) => void;
  clearSimulationImage?: () => void;
  recalculateDerivedState?: () => void;
  startSimulationLoop?: () => void;

  // UI handlers
  onFlipRatioChange?: (value: number) => void;
  onThresholdChange?: (value: number) => void;
  updateBackgroundColor?: (r: number, g: number, b: number) => void;
  updateClearColor?: (r: number, g: number, b: number) => void;
  updateLowRGB?: (r: number, g: number, b: number) => void;
  updateHighRGB?: (r: number, g: number, b: number) => void;
  updateBallRGB?: (r: number, g: number, b: number) => void;

  // loader flag to suppress autosave / valueChange handlers while applying state
  __isLoadingState?: boolean;

  [key: string]: any;
}

/* -------------------------
   Helpers
   ------------------------- */

function setCheckbox(ref: any, checked: boolean) {
  if (!ref || !ref.nativeElement) return;
  try {
    ref.nativeElement.checked = !!checked;
    // Optionally dispatch change event if you rely on DOM listeners
    const ev = new Event('change', { bubbles: true, cancelable: true });
    ref.nativeElement.dispatchEvent(ev);
  } catch (e) {
    // ignore
  }
}

function setRange(ref: any, value: number) {
  if (!ref || !ref.nativeElement) return;
  try {
    ref.nativeElement.value = String(value);
    // Keep numeric valueAsNumber consistent
    try { (ref.nativeElement as any).valueAsNumber = Number(value); } catch {}
    // dispatch input event so any framework listeners pick it up
    const ev = new Event('input', { bubbles: true, cancelable: true });
    ref.nativeElement.dispatchEvent(ev);
  } catch (e) {
    // ignore
  }
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function loadImage(url: string | null, crossOrigin = 'anonymous'): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = crossOrigin;
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = url;
  });
}

/* -------------------------
   Core loader
   ------------------------- */

/**
 * Apply the SimState to the component-like target.
 * This function is defensive — it checks existence of refs and methods before calling them.
 *
 * - stops the simulation loop
 * - sets model booleans and DOM inputs (checkboxes / ranges)
 * - calls existing handlers so the simulation picks up derived state
 * - replaces particle buffers (if particles are provided and reinitializer exists)
 * - loads image (if provided) and sets it via setSimulationImage
 * - recalculates derived state and restarts the simulation loop
 */
export async function applySimState(target: ArtFluidAPI, sim: SimState): Promise<void> {
  if (!target || !sim) return;

  // Mark loader-active so autosave/valueChange handlers can skip while we mutate
  target.__isLoadingState = true;

  // Stop simulation immediately (if available)
  try { target.stopSimulationAndCleanup?.(); } catch (e) { /* ignore */ }

  // BOOLEANS
  if (typeof sim.showParticles === 'boolean') {
    target.scene.showParticles = sim.showParticles;
    setCheckbox(target.particlesCheckbox, sim.showParticles);
  }
  if (typeof sim.showGrid === 'boolean') {
    target.scene.showGrid = sim.showGrid;
    setCheckbox(target.gridCheckbox, sim.showGrid);
  }
  if (typeof sim.compensateDrift === 'boolean') {
    target.scene.compensateDrift = sim.compensateDrift;
    setCheckbox(target.compensateCheckbox, sim.compensateDrift);
  }
  if (typeof sim.separateParticles === 'boolean') {
    target.scene.separateParticles = sim.separateParticles;
    setCheckbox(target.separateCheckbox, sim.separateParticles);
  }

  // SLIDERS / NUMERIC VALUES
  // flipRatio: saved 0..1, UI slider 0..10 => slider value = flipRatio * 10
  if (typeof sim.flipRatio === 'number') {
    const sliderVal = Math.round(clamp(sim.flipRatio, 0, 1) * 10);
    setRange(target.flipRange, sliderVal);
    // call handler with 0..1
    try { target.onFlipRatioChange?.(sim.flipRatio); } catch (e) {}
    target.scene.flipRatio = sim.flipRatio;
  }

  if (typeof sim.threshold === 'number') {
    const sliderVal = Math.round(clamp(sim.threshold, 0, 1) * 100);
    setRange(target.thresholdRange, sliderVal);
    try { target.onThresholdChange?.(sim.threshold); } catch (e) {}
    target.threshold = sim.threshold;
  }

  if (typeof sim.gravity === 'number') {
    // UI slider maps 0.1 * sliderValue => gravity, so sliderValue = gravity * 10
    const sliderVal = Math.round(sim.gravity * 10);
    setRange(target.gravityRange, sliderVal);
    target.scene.gravity = sim.gravity;
  }

  // COLORS (clearColor assumed to be [r,g,b] in 0..1)
  if (Array.isArray(sim.clearColor) && sim.clearColor.length >= 3) {
    target.clearColor = [sim.clearColor[0], sim.clearColor[1], sim.clearColor[2]];
    // reflect on fine-grain sliders (which in this project are 0..255)
    if (target.redFrame && target.greenFrame && target.blueFrame) {
      setRange(target.redFrame, Math.round((sim.clearColor[0] ?? 0) * 255));
      setRange(target.greenFrame, Math.round((sim.clearColor[1] ?? 0) * 255));
      setRange(target.blueFrame, Math.round((sim.clearColor[2] ?? 0) * 255));
    }
    try {
      target.updateBackgroundColor?.(
        target.redFrame?.nativeElement.valueAsNumber ?? 0,
        target.greenFrame?.nativeElement.valueAsNumber ?? 0,
        target.blueFrame?.nativeElement.valueAsNumber ?? 0
      );
    } catch (e) {}
  }

  if (sim.low) {
    target.lowr = sim.low.r; target.lowg = sim.low.g; target.lowb = sim.low.b;
    if (target.sliderLowr && target.sliderLowg && target.sliderLowb) {
      setRange(target.sliderLowr, Math.round((sim.low.r ?? 0) * 10));
      setRange(target.sliderLowg, Math.round((sim.low.g ?? 0) * 10));
      setRange(target.sliderLowb, Math.round((sim.low.b ?? 0) * 10));
    }
    try {
      target.updateLowRGB?.(
        target.sliderLowr?.nativeElement.valueAsNumber ?? (sim.low.r ?? 0) * 10,
        target.sliderLowg?.nativeElement.valueAsNumber ?? (sim.low.g ?? 0) * 10,
        target.sliderLowb?.nativeElement.valueAsNumber ?? (sim.low.b ?? 0) * 10
      );
    } catch (e) {}
  }

  if (sim.high) {
    target.highr = sim.high.r; target.highg = sim.high.g; target.highb = sim.high.b;
    if (target.sliderHighr && target.sliderHighg && target.sliderHighb) {
      setRange(target.sliderHighr, Math.round((sim.high.r ?? 0) * 10));
      setRange(target.sliderHighg, Math.round((sim.high.g ?? 0) * 10));
      setRange(target.sliderHighb, Math.round((sim.high.b ?? 0) * 10));
    }
    try {
      target.updateHighRGB?.(
        target.sliderHighr?.nativeElement.valueAsNumber ?? (sim.high.r ?? 0) * 10,
        target.sliderHighg?.nativeElement.valueAsNumber ?? (sim.high.g ?? 0) * 10,
        target.sliderHighb?.nativeElement.valueAsNumber ?? (sim.high.b ?? 0) * 10
      );
    } catch (e) {}
  }

  if (sim.ball) {
    target.ballr = sim.ball.r; target.ballg = sim.ball.g; target.ballb = sim.ball.b;
    if (target.ballSliderR && target.ballSliderG && target.ballSliderB) {
      setRange(target.ballSliderR, Math.round((sim.ball.r ?? 0) * 10));
      setRange(target.ballSliderG, Math.round((sim.ball.g ?? 0) * 10));
      setRange(target.ballSliderB, Math.round((sim.ball.b ?? 0) * 10));
    }
    try {
      target.updateBallRGB?.(
        target.ballSliderR?.nativeElement.valueAsNumber ?? (sim.ball.r ?? 0) * 10,
        target.ballSliderG?.nativeElement.valueAsNumber ?? (sim.ball.g ?? 0) * 10,
        target.ballSliderB?.nativeElement.valueAsNumber ?? (sim.ball.b ?? 0) * 10
      );
    } catch (e) {}
  }

  // PARTICLES: if a particle snapshot is included, attempt to hand off to reinitializer
  if (Array.isArray(sim.particles) && sim.particles.length && typeof target.reinitializeParticleBuffers === 'function') {
    try {
      // deep copy to avoid shared references
      const copied = sim.particles.map(p => ({ ...p }));
      target.reinitializeParticleBuffers?.(copied);
      target.particles = copied;
    } catch (e) {
      console.warn('simstate-loader: failed to reinitialize particles', e);
    }
  }

  // IMAGE: load image if present, then set it via setSimulationImage
  try {
    const img = await loadImage(sim.imageUrl ?? null);
    if (img) {
      target.setSimulationImage?.(img, { flip: Boolean(sim.flipRatio), threshold: sim.threshold ?? 0 });
    } else {
      target.clearSimulationImage?.();
    }
  } catch (e) {
    console.warn('simstate-loader: image load failed', e);
    try { target.clearSimulationImage?.(); } catch (_) {}
  }

  // Recalculate and restart
  try { target.recalculateDerivedState?.(); } catch (e) {}
  try { target.startSimulationLoop?.(); } catch (e) {}

  // clear loader flag
  target.__isLoadingState = false;
}

/* -------------------------
   Serializer (inverse of apply)
   ------------------------- */

/**
 * Create a SimState payload from the current component state.
 * This is the lightweight serializer used for saving current UI/sim state.
 */
export function serializeSimState(target: ArtFluidAPI): SimState {
  const payload: SimState = {};

  payload.gravity = target.scene?.gravity;
  payload.flipRatio = target.scene?.flipRatio;
  payload.threshold = target.threshold;
  payload.showParticles = target.scene?.showParticles;
  payload.showGrid = target.scene?.showGrid;
  payload.compensateDrift = target.scene?.compensateDrift;
  payload.separateParticles = target.scene?.separateParticles;

  if (Array.isArray(target.clearColor) && target.clearColor.length >= 3) {
    payload.clearColor = [target.clearColor[0], target.clearColor[1], target.clearColor[2]];
  }

  if (typeof target.lowr === 'number') payload.low = { r: target.lowr, g: target.lowg ?? 0, b: target.lowb ?? 0 };
  if (typeof target.highr === 'number') payload.high = { r: target.highr, g: target.highg ?? 0, b: target.highb ?? 0 };
  if (typeof target.ballr === 'number') payload.ball = { r: target.ballr, g: target.ballg ?? 0, b: target.ballb ?? 0 };

  // we intentionally do not include large particle buffers in default serializer, but include if present
  if (Array.isArray(target.particles) && target.particles.length) {
    payload.particles = target.particles.map(p => ({ ...p }));
  }

  return payload;
}