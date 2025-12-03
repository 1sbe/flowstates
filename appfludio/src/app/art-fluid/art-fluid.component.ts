// Replace your existing file with this version (only change is the corrected GLSL typo).
// The bug was a typo: "domain" instead of "domainSize" in the point vertex shader.
// That caused the VS compile error and prevented particle rendering.

import {
  Component,
  ElementRef,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  Renderer2
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FlipFluid, FlipFluidConfig } from './flip-fluid';
import { AuthService } from '../core/auth.service';
import { StateService, SimState } from '../core/state.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-art-fluid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './art-fluid.component.html',
  styleUrls: ['./art-fluid.component.scss']
})
export class ArtFluidComponent implements AfterViewInit, OnDestroy {
  @ViewChild('myCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ui', { static: true }) uiRef!: ElementRef<HTMLElement>;

  // Template refs for controls we will update when loading a state
  @ViewChild('redFrame') redFrame?: ElementRef<HTMLInputElement>;
  @ViewChild('greenFrame') greenFrame?: ElementRef<HTMLInputElement>;
  @ViewChild('blueFrame') blueFrame?: ElementRef<HTMLInputElement>;

  @ViewChild('sliderR') sliderR?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderG') sliderG?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderB') sliderB?: ElementRef<HTMLInputElement>;

  @ViewChild('ballSliderR') ballSliderR?: ElementRef<HTMLInputElement>;
  @ViewChild('ballSliderG') ballSliderG?: ElementRef<HTMLInputElement>;
  @ViewChild('ballSliderB') ballSliderB?: ElementRef<HTMLInputElement>;

  @ViewChild('sliderLowr') sliderLowr?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderLowg') sliderLowg?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderLowb') sliderLowb?: ElementRef<HTMLInputElement>;

  @ViewChild('sliderHighr') sliderHighr?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderHighg') sliderHighg?: ElementRef<HTMLInputElement>;
  @ViewChild('sliderHighb') sliderHighb?: ElementRef<HTMLInputElement>;

  @ViewChild('flipRange') flipRange?: ElementRef<HTMLInputElement>;
  @ViewChild('thresholdRange') thresholdRange?: ElementRef<HTMLInputElement>;
  @ViewChild('gravityRange') gravityRange?: ElementRef<HTMLInputElement>;

  @ViewChild('particlesCheckbox') particlesCheckbox?: ElementRef<HTMLInputElement>;
  @ViewChild('gridCheckbox') gridCheckbox?: ElementRef<HTMLInputElement>;
  @ViewChild('compensateCheckbox') compensateCheckbox?: ElementRef<HTMLInputElement>;
  @ViewChild('separateCheckbox') separateCheckbox?: ElementRef<HTMLInputElement>;

  canvas!: HTMLCanvasElement;
  gl!: WebGLRenderingContext;
  animationFrameId: number | null = null;

  // scene (kept simple typing)
  scene: any = {
    gravity: -0.3,
    dt: 1.0 / 60.0,
    flipRatio: 0.7,
    numPressureIters: 50,
    numParticleIters: 2,
    frameNr: 0,
    overRelaxation: 1.2,
    compensateDrift: true,
    separateParticles: true,
    obstacleX: 0.0,
    obstacleY: 0.0,
    obstacleRadius: 0.1,
    paused: true,
    showObstacle: true,
    obstacleVelX: 0.0,
    obstacleVelY: 0.0,
    showParticles: true,
    showGrid: false,
    fluid: null as FlipFluid | null
  };

  // GL & buffers/shaders (kept public as previously)
  pointShader: WebGLProgram | null = null;
  meshShader: WebGLProgram | null = null;

  pointVertexBuffer: WebGLBuffer | null = null;
  pointColorBuffer: WebGLBuffer | null = null;

  gridVertBuffer: WebGLBuffer | null = null;
  gridColorBuffer: WebGLBuffer | null = null;

  diskVertBuffer: WebGLBuffer | null = null;
  diskIdBuffer: WebGLBuffer | null = null;

  // visual state
  clearColor = [0.6, 0.1, 0.3, 1.0];

  // color sliders state
  threshold = 0.8;
  lowr = 1.0; lowg = 0.5; lowb = 0.0;
  highr = 0.4; highg = 0.0; highb = 0.3;
  ballr = 1.0; ballg = 0.5; ballb = 0.0;

  // dimension scaling
  simHeight = 3.0;
  cScale = 1.0;
  simWidth = 1.0;

  // config object passed to FlipFluid to update colors/threshold
  config: FlipFluidConfig = {
    threshold: this.threshold,
    lowr: this.lowr, lowg: this.lowg, lowb: this.lowb,
    highr: this.highr, highg: this.highg, highb: this.highb
  };

  pointerDown = false;

  // saved states list
  savedList: SimState[] = [];
  loadingSaves = false;

  // shader sources (full GLSL strings)
  pointVertexShader = `
    attribute vec2 attrPosition;
    attribute vec3 attrColor;
    uniform vec2 domainSize;
    uniform float pointSize;
    uniform float drawDisk;

    varying vec3 fragColor;
    varying float fragDrawDisk;

    void main() {
      // fixed typo: use domainSize.y (was "domain.y" causing undeclared identifier)
      vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
      gl_Position = vec4(attrPosition * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
      gl_PointSize = pointSize;
      fragColor = attrColor;
      fragDrawDisk = drawDisk;
    }
  `;

  pointFragmentShader = `
    precision mediump float;
    varying vec3 fragColor;
    varying float fragDrawDisk;

    void main() {
      if (fragDrawDisk == 1.0) {
        float rx = 0.5 - gl_PointCoord.x;
        float ry = 0.5 - gl_PointCoord.y;
        float r2 = rx * rx + ry * ry;
        if (r2 > 0.25) discard;
      }
      gl_FragColor = vec4(fragColor, 1.0);
    }
  `;

  meshVertexShader = `
    attribute vec2 attrPosition;
    uniform vec2 domainSize;
    uniform vec3 color;
    uniform vec2 translation;
    uniform float scale;

    varying vec3 fragColor;

    void main() {
      vec2 v = translation + attrPosition * scale;
      vec4 screenTransform = vec4(2.0 / domainSize.x, 2.0 / domainSize.y, -1.0, -1.0);
      gl_Position = vec4(v * screenTransform.xy + screenTransform.zw, 0.0, 1.0);
      fragColor = color;
    }
  `;

  meshFragmentShader = `
    precision mediump float;
    varying vec3 fragColor;

    void main() {
      gl_FragColor = vec4(fragColor, 1.0);
    }
  `;

  constructor(
    private renderer: Renderer2,
    public auth: AuthService,
    public stateService: StateService,
    public router: Router
  ) {}

  ngAfterViewInit(): void {
    this.canvas = this.canvasRef.nativeElement;
    this.canvas.width = window.innerWidth - 25;
    this.canvas.height = window.innerHeight - 20;

    this.cScale = this.canvas.height / this.simHeight;
    this.simWidth = this.canvas.width / this.cScale;

    const gl = this.canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not available');
      return;
    }
    this.gl = gl;

    this.canvas.tabIndex = 0;
    this.canvas.focus();

    // create and configure fluid
    this.setupScene();

    // event listeners
    this.renderer.listen(this.canvas, 'mousedown', (ev: MouseEvent) => this.startDrag(ev.clientX, ev.clientY));
    this.renderer.listen(document, 'mouseup', () => this.endDrag());
    this.renderer.listen(this.canvas, 'mousemove', (ev: MouseEvent) => this.drag(ev.clientX, ev.clientY));

    this.renderer.listen(this.canvas, 'touchstart', (ev: TouchEvent) => {
      const t = ev.touches[0];
      this.startDrag(t.clientX, t.clientY);
    });
    this.renderer.listen(this.canvas, 'touchmove', (ev: TouchEvent) => {
      ev.preventDefault();
      const t = ev.touches[0];
      this.drag(t.clientX, t.clientY);
    }, { passive: false });
    this.renderer.listen(this.canvas, 'touchend', () => this.endDrag());

    this.renderer.listen(document, 'fullscreenchange', () => {
      if (document.fullscreenElement) {
        (this.uiRef.nativeElement as HTMLElement).style.display = 'none';
      } else {
        (this.uiRef.nativeElement as HTMLElement).style.display = 'grid';
      }
    });

    // centralised keyboard handling (use public method onKey)
    this.renderer.listen(document, 'keydown', (ev: KeyboardEvent) => this.onKey(ev));

    // start loop
    this.update();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
  }

  // ---------- keyboard handler (public) ----------
  onKey(ev: KeyboardEvent) {
    const key = (ev.key || '').toLowerCase();
    switch (key) {
      case 'p': this.scene.paused = !this.scene.paused; break;
      case 'm': this.scene.paused = false; this.simulate(); this.scene.paused = true; break;
      case 'f': if (this.canvas.requestFullscreen) this.canvas.requestFullscreen(); break;
      case 'e': this.scene.obstacleVelY = 3; break;    // jet up
      case 'r': this.scene.obstacleVelY = -3; break;   // jet down
      case 't': this.scene.obstacleVelX = 3; break;    // jet right
      case 'y': this.scene.obstacleVelX = -3; break;   // jet left
      case 'w': this.scene.obstacleY += 0.1; break;
      case 'a': this.scene.obstacleX -= 0.1; break;
      case 's': this.scene.obstacleY -= 0.1; break;
      case 'd': this.scene.obstacleX += 0.1; break;
    }
  }

  // ---------- Save / Load functionality (public methods used by template) ----------
  openSavePrompt() {
    const name = window.prompt('Name for state', 'My State');
    if (name !== null) {
      this.saveState(name || 'My State');
    }
  }

  saveState(name: string = 'My State') {
    if (!this.auth.getToken()) {
      // not logged in; route to login
      this.router.navigate(['/login']);
      return;
    }

    const payload = this.serializeState();
    const state: SimState = { name, payload };

    this.stateService.create(state).subscribe({
      next: res => {
        // refresh list after save
        this.loadSavedStates();
        console.log('Saved state', res);
      },
      error: err => {
        console.error('save failed', err);
      }
    });
  }

  loadSavedStates() {
    if (!this.auth.getToken()) return;
    this.loadingSaves = true;
    this.stateService.list().subscribe({
      next: list => { this.savedList = list; this.loadingSaves = false; },
      error: () => { this.loadingSaves = false; }
    });
  }

  loadState(id: number | undefined) {
    if (id === undefined || id === null) return;
    this.stateService.get(id).subscribe({
      next: s => {
        this.applyStatePayload(s.payload);
      },
      error: err => console.error('load failed', err)
    });
  }

  /**
   * Overwrite all UI controls and simulation state with the saved payload.
   * This sets model values, updates DOM inputs where necessary, calls
   * the existing handlers, reinitializes buffers if particle data is present,
   * and restarts the simulation.
   */
  async applyStatePayload(payload: any) {
    if (!payload) return;
    // prevent autosave/value change handlers running while we apply
    (this as any).isLoadingState = true;

    // stop simulation loop and cleanup any in-flight work
    this.stopSimulationAndCleanup();

    // -------------------
    // BOOLEANS / CHECKBOXES
    // -------------------
    if (typeof payload.showParticles === 'boolean') {
      this.scene.showParticles = payload.showParticles;
      this.setCheckboxIfPresent(this.particlesCheckbox, payload.showParticles);
    }
    if (typeof payload.showGrid === 'boolean') {
      this.scene.showGrid = payload.showGrid;
      this.setCheckboxIfPresent(this.gridCheckbox, payload.showGrid);
    }
    if (typeof payload.compensateDrift === 'boolean') {
      this.scene.compensateDrift = payload.compensateDrift;
      this.setCheckboxIfPresent(this.compensateCheckbox, payload.compensateDrift);
    }
    if (typeof payload.separateParticles === 'boolean') {
      this.scene.separateParticles = payload.separateParticles;
      this.setCheckboxIfPresent(this.separateCheckbox, payload.separateParticles);
    }

    // -------------------
    // SLIDERS: FLIP / THRESHOLD / GRAVITY
    // Note: saved values in serializeState use scene.flipRatio, threshold, and gravity directly
    // -------------------
    if (typeof payload.flipRatio === 'number') {
      // payload.flipRatio is stored in 0..1; UI slider is 0..10 where we multiply by 0.1
      const flipSliderValue = Math.round(payload.flipRatio * 10);
      this.setRangeIfPresent(this.flipRange, flipSliderValue);
      // call handler with 0..1 value
      this.onFlipRatioChange(payload.flipRatio);
      this.scene.flipRatio = payload.flipRatio;
    }

    if (typeof payload.threshold === 'number') {
      const thresholdSliderValue = Math.round(payload.threshold * 100);
      this.setRangeIfPresent(this.thresholdRange, thresholdSliderValue);
      this.onThresholdChange(payload.threshold);
      this.threshold = payload.threshold;
    }

    if (typeof payload.gravity === 'number') {
      // payload.gravity is actual gravity value; UI slider maps 0.1 * slider to scene.gravity
      const gravitySliderValue = Math.round(payload.gravity * 10);
      this.setRangeIfPresent(this.gravityRange, gravitySliderValue);
      this.scene.gravity = payload.gravity;
    }

    // -------------------
    // COLORS
    // -------------------
    if (Array.isArray(payload.clearColor) && payload.clearColor.length >= 3) {
      this.clearColor[0] = payload.clearColor[0];
      this.clearColor[1] = payload.clearColor[1];
      this.clearColor[2] = payload.clearColor[2];
      // Update background color sliders / UI where appropriate
      if (this.redFrame && this.greenFrame && this.blueFrame) {
        this.setRangeIfPresent(this.redFrame, Math.round((this.clearColor[0] || 0) * 255));
        this.setRangeIfPresent(this.greenFrame, Math.round((this.clearColor[1] || 0) * 255));
        this.setRangeIfPresent(this.blueFrame, Math.round((this.clearColor[2] || 0) * 255));
      }
      // update body background immediately
      this.updateBackgroundColor(
        this.redFrame?.nativeElement.valueAsNumber ?? 0,
        this.greenFrame?.nativeElement.valueAsNumber ?? 0,
        this.blueFrame?.nativeElement.valueAsNumber ?? 0
      );
    }

    if (payload.low) {
      this.lowr = payload.low.r; this.lowg = payload.low.g; this.lowb = payload.low.b;
      if (this.sliderLowr && this.sliderLowg && this.sliderLowb) {
        this.setRangeIfPresent(this.sliderLowr, Math.round(this.lowr * 10));
        this.setRangeIfPresent(this.sliderLowg, Math.round(this.lowg * 10));
        this.setRangeIfPresent(this.sliderLowb, Math.round(this.lowb * 10));
      }
      this.updateLowRGB(this.sliderLowr?.nativeElement.valueAsNumber ?? this.lowr * 10,
        this.sliderLowg?.nativeElement.valueAsNumber ?? this.lowg * 10,
        this.sliderLowb?.nativeElement.valueAsNumber ?? this.lowb * 10);
    }

    if (payload.high) {
      this.highr = payload.high.r; this.highg = payload.high.g; this.highb = payload.high.b;
      if (this.sliderHighr && this.sliderHighg && this.sliderHighb) {
        this.setRangeIfPresent(this.sliderHighr, Math.round(this.highr * 10));
        this.setRangeIfPresent(this.sliderHighg, Math.round(this.highg * 10));
        this.setRangeIfPresent(this.sliderHighb, Math.round(this.highb * 10));
      }
      this.updateHighRGB(this.sliderHighr?.nativeElement.valueAsNumber ?? this.highr * 10,
        this.sliderHighg?.nativeElement.valueAsNumber ?? this.highg * 10,
        this.sliderHighb?.nativeElement.valueAsNumber ?? this.highb * 10);
    }

    if (payload.ball) {
      this.ballr = payload.ball.r; this.ballg = payload.ball.g; this.ballb = payload.ball.b;
      if (this.ballSliderR && this.ballSliderG && this.ballSliderB) {
        this.setRangeIfPresent(this.ballSliderR, Math.round(this.ballr * 10));
        this.setRangeIfPresent(this.ballSliderG, Math.round(this.ballg * 10));
        this.setRangeIfPresent(this.ballSliderB, Math.round(this.ballb * 10));
      }
      this.updateBallRGB(this.ballSliderR?.nativeElement.valueAsNumber ?? this.ballr * 10,
        this.ballSliderG?.nativeElement.valueAsNumber ?? this.ballg * 10,
        this.ballSliderB?.nativeElement.valueAsNumber ?? this.ballb * 10);
    }

    // -------------------
    // PARTICLES / FLUID DATA
    // -------------------
    if (payload.particles && Array.isArray(payload.particles)) {
      if (this.scene.fluid) {
        // placeholder for future particle restoration
      }
    }

    // -------------------
    // resume: recalc derived and restart loop
    // -------------------
    this.recalculateDerivedState();
    this.startSimulationLoop();

    // restore flag
    (this as any).isLoadingState = false;
  }

  serializeState() {
    return {
      gravity: this.scene.gravity,
      flipRatio: this.scene.flipRatio,
      threshold: this.threshold,
      clearColor: [this.clearColor[0], this.clearColor[1], this.clearColor[2]],
      low: { r: this.lowr, g: this.lowg, b: this.lowb },
      high: { r: this.highr, g: this.highg, b: this.highb },
      ball: { r: this.ballr, g: this.ballg, b: this.ballb },
      showParticles: this.scene.showParticles,
      showGrid: this.scene.showGrid,
      compensateDrift: this.scene.compensateDrift,
      separateParticles: this.scene.separateParticles
    };
  }

  // ---------- helper: create shader program ----------
  createShader(vsSource: string, fsSource: string): WebGLProgram | null {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      console.error('VS compile ERROR:', gl.getShaderInfoLog(vs));
      console.error('VS source (first 400 chars):', vsSource.slice(0, 400));
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('FS compile ERROR:', gl.getShaderInfoLog(fs));
      console.error('FS source (first 400 chars):', fsSource.slice(0, 400));
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link ERROR:', gl.getProgramInfoLog(program));
      console.error('Program info - VS log:', gl.getShaderInfoLog(vs));
      console.error('Program info - FS log:', gl.getShaderInfoLog(fs));
    }

    return program;
  }

  // ---------- setup scene (creates FlipFluid) ----------
  setupScene() {
    this.scene.obstacleRadius = 0.1;
    this.scene.overRelaxation = 1.2;

    this.scene.dt = 1.0 / 60.0;
    this.scene.numPressureIters = 50;
    this.scene.numParticleIters = 2;

    const res = 120;

    const tankHeight = 1.0 * this.simHeight;
    const tankWidth = 1.0 * this.simWidth;
    const h = tankHeight / res;
    const density = 1000.0;

    const relWaterHeight = 0.7;
    const relWaterWidth = 0.7;

    const r = 0.4 * h; // particle radius w.r.t. cell size
    const dx = 2.0 * r;
    const dy = Math.sqrt(3.0) / 2.0 * dx;

    const numX = Math.floor((relWaterWidth * tankWidth - 2.0 * h - 2.0 * r) / dx);
    const numY = Math.floor((relWaterHeight * tankHeight - 2.0 * h - 2.0 * r) / dy);
    const maxParticles = Math.max(1, numX * numY);

    const config: FlipFluidConfig = {
      threshold: this.threshold,
      lowr: this.lowr, lowg: this.lowg, lowb: this.lowb,
      highr: this.highr, highg: this.highg, highb: this.highb
    };

    const f = new FlipFluid(density, tankWidth, tankHeight, h, r, maxParticles, config);

    // create particles
    f.numParticles = Math.max(0, numX * numY);
    let p = 0;
    for (let i = 0; i < numX; i++) {
      for (let j = 0; j < numY; j++) {
        f.particlePos[p++] = h + r + dx * i + (j % 2 === 0 ? 0.0 : r);
        f.particlePos[p++] = h + r + dy * j;
      }
    }

    // setup grid cells for tank
    const n = f.fNumY;
    for (let i = 0; i < f.fNumX; i++) {
      for (let j = 0; j < f.fNumY; j++) {
        let s = 1.0; // fluid
        if (i === 0 || i === f.fNumX - 1 || j === 0) s = 0; // solid
        f.s[i * n + j] = s;
      }
    }

    this.setObstacle(4.0 / this.cScale, 2.0 / this.cScale, true, f);

    this.scene.fluid = f;
  }

  // ---------- obstacle ----------
  setObstacle(x: number, y: number, reset: boolean, fParam?: FlipFluid) {
    const fluid = fParam ?? this.scene.fluid;
    if (!fluid) return;
    let vx = 0.0;
    let vy = 0.0;

    if (!reset) {
      vx = (x - this.scene.obstacleX) / this.scene.dt;
      vy = (y - this.scene.obstacleY) / this.scene.dt;
    }

    this.scene.obstacleX = x;
    this.scene.obstacleY = y;
    const r = this.scene.obstacleRadius;
    const n = fluid.fNumY;

    for (let i = 1; i < fluid.fNumX - 2; i++) {
      for (let j = 1; j < fluid.fNumY - 2; j++) {
        fluid.s[i * n + j] = 1.0;

        const dx = (i + 0.5) * fluid.h - x;
        const dy = (j + 0.5) * fluid.h - y;

        if (dx * dx + dy * dy < r * r) {
          fluid.s[i * n + j] = 0.0;
          fluid.u[i * n + j] = vx;
          fluid.u[(i + 1) * n + j] = vx;
          fluid.v[i * n + j] = vy;
          fluid.v[i * n + j + 1] = vy;
        }
      }
    }

    this.scene.showObstacle = true;
    this.scene.obstacleVelX = vx;
    this.scene.obstacleVelY = vy;
  }

  // ---------- pointer helpers ----------
  private clientToSim(clientX: number, clientY: number) {
    const bounds = this.canvas.getBoundingClientRect();
    const mx = clientX - bounds.left - this.canvas.clientLeft;
    const my = clientY - bounds.top - this.canvas.clientTop;
    const x = mx / this.cScale;
    const y = (this.canvas.height - my) / this.cScale;
    return { x, y };
  }

  startDrag(clientX: number, clientY: number) {
    const { x, y } = this.clientToSim(clientX, clientY);
    this.pointerDown = true;
    this.setObstacle(x, y, true);
    this.scene.paused = false;
  }

  drag(clientX: number, clientY: number) {
    if (!this.pointerDown) return;
    const { x, y } = this.clientToSim(clientX, clientY);
    this.setObstacle(x, y, false);
  }

  endDrag() {
    this.pointerDown = false;
    this.scene.obstacleVelX = 0.0;
    this.scene.obstacleVelY = 0.0;
  }

  // ---------- simulation step ----------
  simulate() {
    if (!this.scene.paused && this.scene.fluid) {
      // ensure config is up to date
      this.scene.fluid.config.threshold = this.threshold;
      this.scene.fluid.config.lowr = this.lowr;
      this.scene.fluid.config.lowg = this.lowg;
      this.scene.fluid.config.lowb = this.lowb;
      this.scene.fluid.config.highr = this.highr;
      this.scene.fluid.config.highg = this.highg;
      this.scene.fluid.config.highb = this.highb;

      this.scene.fluid.simulate(
        this.scene.dt, this.scene.gravity, this.scene.flipRatio,
        this.scene.numPressureIters, this.scene.numParticleIters,
        this.scene.overRelaxation, this.scene.compensateDrift,
        this.scene.separateParticles, this.scene.obstacleX, this.scene.obstacleY, this.scene.obstacleRadius
      );
    }
    this.scene.frameNr++;
  }

  // ---------- draw ----------
  draw() {
    const gl = this.gl;
    if (!gl || !this.scene.fluid) return;

    // clear and update clear color
    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    if (this.pointShader == null)
      this.pointShader = this.createShader(this.pointVertexShader, this.pointFragmentShader)!;
    if (this.meshShader == null)
      this.meshShader = this.createShader(this.meshVertexShader, this.meshFragmentShader)!;

    const f = this.scene.fluid;

    // grid
    if (this.gridVertBuffer == null) {
      this.gridVertBuffer = gl.createBuffer();
      const cellCenters = new Float32Array(2 * f.fNumCells);
      let p = 0;
      for (let i = 0; i < f.fNumX; i++) {
        for (let j = 0; j < f.fNumY; j++) {
          cellCenters[p++] = (i + 0.5) * f.h;
          cellCenters[p++] = (j + 0.5) * f.h;
        }
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, cellCenters, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    if (this.gridColorBuffer == null)
      this.gridColorBuffer = gl.createBuffer();

    if (this.scene.showGrid) {
      const pointSize = 0.9 * this.scene.fluid.h / this.simWidth * this.canvas.width;

      gl.useProgram(this.pointShader!);
      gl.uniform2f(gl.getUniformLocation(this.pointShader!, 'domainSize'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.pointShader!, 'pointSize'), pointSize);
      gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 0.0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
      const posLoc = gl.getAttribLocation(this.pointShader!, 'attrPosition');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scene.fluid.cellColor, gl.DYNAMIC_DRAW);

      const colorLoc = gl.getAttribLocation(this.pointShader, 'attrColor');
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, this.scene.fluid.fNumCells);

      gl.disableVertexAttribArray(posLoc);
      gl.disableVertexAttribArray(colorLoc);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // water
    if (this.scene.showParticles) {
      gl.clear(gl.DEPTH_BUFFER_BIT);

      const pointSize = 2.2 * this.scene.fluid.particleRadius / this.simWidth * this.canvas.width;

      gl.useProgram(this.pointShader);
      gl.uniform2f(gl.getUniformLocation(this.pointShader, 'domainSize'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.pointShader, 'pointSize'), pointSize);
      gl.uniform1f(gl.getUniformLocation(this.pointShader, 'drawDisk'), 1.0);

      if (this.pointVertexBuffer == null) this.pointVertexBuffer = gl.createBuffer();
      if (this.pointColorBuffer == null) this.pointColorBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scene.fluid.particlePos, gl.DYNAMIC_DRAW);

      const posLoc = gl.getAttribLocation(this.pointShader, 'attrPosition');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, this.scene.fluid.particleColor, gl.DYNAMIC_DRAW);

      const colorLoc = gl.getAttribLocation(this.pointShader, 'attrColor');
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, this.scene.fluid.numParticles);

      gl.disableVertexAttribArray(posLoc);
      gl.disableVertexAttribArray(colorLoc);

      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // disk
    const numSegs = 100;

    if (this.diskVertBuffer == null) {
      this.diskVertBuffer = gl.createBuffer();
      const dphi = 2.0 * Math.PI / numSegs;
      const diskVerts = new Float32Array(2 * numSegs + 2);
      let p = 0;
      diskVerts[p++] = 0.0;
      diskVerts[p++] = 0.0;
      for (let i = 0; i < numSegs; i++) {
        diskVerts[p++] = Math.cos(i * dphi);
        diskVerts[p++] = Math.sin(i * dphi);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, this.diskVertBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, diskVerts, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);

      this.diskIdBuffer = gl.createBuffer();
      const diskIds = new Uint16Array(3 * numSegs);
      p = 0;
      for (let i = 0; i < numSegs; i++) {
        diskIds[p++] = 0;
        diskIds[p++] = 1 + i;
        diskIds[p++] = 1 + (i + 1) % numSegs;
      }

      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.diskIdBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, diskIds, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    const diskColor = [this.ballr, this.ballg, this.ballb];

    gl.useProgram(this.meshShader);
    gl.uniform2f(gl.getUniformLocation(this.meshShader!, 'domainSize'), this.simWidth, this.simHeight);
    gl.uniform3f(gl.getUniformLocation(this.meshShader!, 'color'), diskColor[0], diskColor[1], diskColor[2]);
    gl.uniform2f(gl.getUniformLocation(this.meshShader!, 'translation'), this.scene.obstacleX, this.scene.obstacleY);
    gl.uniform1f(gl.getUniformLocation(this.meshShader!, 'scale'), this.scene.obstacleRadius + this.scene.fluid!.particleRadius);

    const posLocMesh = gl.getAttribLocation(this.meshShader!, 'attrPosition');
    gl.enableVertexAttribArray(posLocMesh);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.diskVertBuffer);
    gl.vertexAttribPointer(posLocMesh, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.diskIdBuffer);
    gl.drawElements(gl.TRIANGLES, 3 * numSegs, gl.UNSIGNED_SHORT, 0);

    gl.disableVertexAttribArray(posLocMesh);
  }

  // ---------- animation loop ----------
  update() {
    this.simulate();
    this.draw();
    this.animationFrameId = requestAnimationFrame(() => this.update());
  }

  // ---------- UI helpers ----------
  onFlipRatioChange(value: number) {
    // guard against autosave while we programmatically set value
    if ((this as any).isLoadingState) return;
    this.scene.flipRatio = value;
  }

  onThresholdChange(value: number) {
    if ((this as any).isLoadingState) return;
    this.threshold = value;
  }

  updateBackgroundColor(r: number, g: number, b: number) {
    document.body.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
  }

  updateClearColor(r: number, g: number, b: number) {
    this.clearColor[0] = 0.1 * r;
    this.clearColor[1] = 0.1 * g;
    this.clearColor[2] = 0.1 * b;
  }

  updateLowRGB(r: number, g: number, b: number) {
    this.lowr = 0.1 * r; this.lowg = 0.1 * g; this.lowb = 0.1 * b;
  }

  updateHighRGB(r: number, g: number, b: number) {
    this.highr = 0.1 * r; this.highg = 0.1 * g; this.highb = 0.1 * b;
  }

  updateBallRGB(r: number, g: number, b: number) {
    this.ballr = 0.1 * r; this.ballg = 0.1 * g; this.ballb = 0.1 * b;
  }

  // --------------------------
  // DOM helpers used when applying saved state
  // --------------------------
  private setCheckboxIfPresent(el?: ElementRef<HTMLInputElement>, checked?: boolean) {
    try {
      if (!el || typeof checked === 'undefined' || checked === null) return;
      el.nativeElement.checked = !!checked;
    } catch {}
  }

  private setRangeIfPresent(el?: ElementRef<HTMLInputElement>, value?: number) {
    try {
      if (!el || typeof value === 'undefined' || value === null) return;
      el.nativeElement.value = String(value);
      (el.nativeElement as any).valueAsNumber = Number(value);
      // dispatch an input event so any listeners (if present) will be notified
      const ev = new Event('input', { bubbles: true, cancelable: true });
      el.nativeElement.dispatchEvent(ev);
    } catch {}
  }

  private stopSimulationAndCleanup() {
    if (this.animationFrameId != null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    // stop workers / timers as needed
  }

  private reinitializeParticleBuffers(particles: any[]) {
    // placeholder for reinitializing GPU/typed arrays if you later save particle data
  }

  private setSimulationImage(img: HTMLImageElement | null, opts: { flip?: boolean, threshold?: number }) {
    // placeholder: upload to texture, draw to canvas, etc.
  }

  private clearSimulationImage() {
    // placeholder to clear image state
  }

  private recalculateDerivedState() {
    // recompute derived values, uniforms, etc.
    // ensure FlipFluid config uses current color/threshold values
    if (this.scene.fluid) {
      this.scene.fluid.config.threshold = this.threshold;
      this.scene.fluid.config.lowr = this.lowr;
      this.scene.fluid.config.lowg = this.lowg;
      this.scene.fluid.config.lowb = this.lowb;
      this.scene.fluid.config.highr = this.highr;
      this.scene.fluid.config.highg = this.highg;
      this.scene.fluid.config.highb = this.highb;
    }
  }

  private startSimulationLoop() {
    if (this.animationFrameId == null) this.animationFrameId = requestAnimationFrame(() => this.update());
  }
}