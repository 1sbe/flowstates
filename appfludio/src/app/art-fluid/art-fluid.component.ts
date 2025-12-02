import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy, Renderer2
} from '@angular/core';
import { FlipFluid, FlipFluidConfig } from './flip-fluid';

@Component({
  selector: 'app-art-fluid',
  templateUrl: './art-fluid.component.html',
  styleUrls: ['./art-fluid.component.scss']
})
export class ArtFluidComponent implements AfterViewInit, OnDestroy {
  @ViewChild('myCanvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ui', { static: true }) uiRef!: ElementRef<HTMLElement>;

  canvas!: HTMLCanvasElement;
  gl!: WebGLRenderingContext;
  animationFrameId: number | null = null;

  // simulation / scene state
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

  // GL & buffers/shaders
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
    threshold: 0.8,
    lowr: 1.0, lowg: 0.5, lowb: 0.0,
    highr: 0.4, highg: 0.0, highb: 0.3
  };

  pointerDown = false;

  // shaders sources (full GLSL strings)
  pointVertexShader = `
    attribute vec2 attrPosition;
    attribute vec3 attrColor;
    uniform vec2 domainSize;
    uniform float pointSize;
    uniform float drawDisk;

    varying vec3 fragColor;
    varying float fragDrawDisk;

    void main() {
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

  constructor(private renderer: Renderer2) {}

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

    this.renderer.listen(document, 'keydown', (ev: KeyboardEvent) => {
      switch (ev.key) {
        case 'p': this.scene.paused = !this.scene.paused; break;
        case 'm': this.scene.paused = false; this.simulate(); this.scene.paused = true; break;
        case 'f': if (this.canvas.requestFullscreen) this.canvas.requestFullscreen(); break;
        case 'e': this.scene.obstacleVelY = 3; break;
        case 'r': this.scene.obstacleVelY = -3; break;
        case 't': this.scene.obstacleVelX = 3; break;
        case 'y': this.scene.obstacleVelX = -3; break;
        case 'w': this.scene.obstacleY += 0.1; break;
        case 'a': this.scene.obstacleX -= 0.1; break;
        case 's': this.scene.obstacleY -= 0.1; break;
        case 'd': this.scene.obstacleX += 0.1; break;
      }
    });

    // start loop
    this.update();
  }

  ngOnDestroy(): void {
    if (this.animationFrameId !== null) cancelAnimationFrame(this.animationFrameId);
  }

  // ---------- setup scene (creates FlipFluid) ----------
  setupScene() {
    const res = 120;
    const tankHeight = 1.0 * this.simHeight;
    const tankWidth = 1.0 * this.simWidth;
    const h = tankHeight / res;
    const density = 1000.0;

    const relWaterHeight = 0.7;
    const relWaterWidth = 0.7;

    const r = 0.4 * h;
    const dx = 2.0 * r;
    const dy = Math.sqrt(3.0) / 2.0 * dx;

    const numX = Math.floor((relWaterWidth * tankWidth - 2.0 * h - 2.0 * r) / dx);
    const numY = Math.floor((relWaterHeight * tankHeight - 2.0 * h - 2.0 * r) / dy);
    const maxParticles = numX * numY;

    const config: FlipFluidConfig = {
      threshold: this.threshold,
      lowr: this.lowr, lowg: this.lowg, lowb: this.lowb,
      highr: this.highr, highg: this.highg, highb: this.highb
    };

    const f = new FlipFluid(density, tankWidth, tankHeight, h, r, maxParticles, config);
    // create particles
    f.numParticles = numX * numY;
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
        let s = 1.0;
        if (i === 0 || i === f.fNumX - 1 || j === 0) s = 0.0;
        f.s[i * n + j] = s;
      }
    }

    // set obstacle in a default position
    this.setObstacle(4.0 / this.cScale, 2.0 / this.cScale, true, f);

    this.scene.fluid = f;
  }

  // ---------- obstacle (null-safe) ----------
  setObstacle(x: number, y: number, reset: boolean, fParam?: FlipFluid) {
    const fluid = fParam ?? this.scene.fluid;
    if (!fluid) return; // guard for undefined fluid
    let vx = 0.0, vy = 0.0;
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
  createShader(vsSource: string, fsSource: string): WebGLProgram | null {
    const gl = this.gl;

    const vs = gl.createShader(gl.VERTEX_SHADER)!;
    gl.shaderSource(vs, vsSource);
    gl.compileShader(vs);
    if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(vs);
      console.error('VS compile ERROR:', info);
      // helpful to see the source around line 1 if there's a hidden char
      console.error('VS source (first 120 chars):', vsSource.slice(0, 120));
      // continue so program creation will also show errors
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER)!;
    gl.shaderSource(fs, fsSource);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      const info = gl.getShaderInfoLog(fs);
      console.error('FS compile ERROR:', info);
      console.error('FS source (first 120 chars):', fsSource.slice(0, 120));
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link ERROR:', gl.getProgramInfoLog(program));
    }

    return program;
  }

  draw() {
    const gl = this.gl;
    if (!gl || !this.scene.fluid) return;

    // clear and update clear color
    gl.clearColor(this.clearColor[0], this.clearColor[1], this.clearColor[2], this.clearColor[3]);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

    if (!this.pointShader) this.pointShader = this.createShader(this.pointVertexShader, this.pointFragmentShader);
    if (!this.meshShader) this.meshShader = this.createShader(this.meshVertexShader, this.meshFragmentShader);

    const f = this.scene.fluid;

    // grid buffer
    if (!this.gridVertBuffer) {
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

    if (!this.gridColorBuffer) this.gridColorBuffer = gl.createBuffer();

    // draw grid if enabled
    if (this.scene.showGrid) {
      const pointSize = 0.9 * f.h / this.simWidth * this.canvas.width;
      gl.useProgram(this.pointShader);
      gl.uniform2f(gl.getUniformLocation(this.pointShader!, 'domainSize'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.pointShader!, 'pointSize'), pointSize);
      gl.uniform1f(gl.getUniformLocation(this.pointShader!, 'drawDisk'), 0.0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridVertBuffer);
      const posLoc = gl.getAttribLocation(this.pointShader!, 'attrPosition');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.gridColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, f.cellColor, gl.DYNAMIC_DRAW);
      const colorLoc = gl.getAttribLocation(this.pointShader!, 'attrColor');
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, f.fNumCells);

      gl.disableVertexAttribArray(posLoc);
      gl.disableVertexAttribArray(colorLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // draw particles
    if (this.scene.showParticles) {
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const pointSize = 2.2 * f.particleRadius / this.simWidth * this.canvas.width;

      gl.useProgram(this.pointShader);
      gl.uniform2f(gl.getUniformLocation(this.pointShader!, 'domainSize'), this.simWidth, this.simHeight);
      gl.uniform1f(gl.getUniformLocation(this.pointShader!, 'pointSize'), pointSize);
      gl.uniform1f(gl.getUniformLocation(this.pointShader!, 'drawDisk'), 1.0);

      if (!this.pointVertexBuffer) this.pointVertexBuffer = gl.createBuffer();
      if (!this.pointColorBuffer) this.pointColorBuffer = gl.createBuffer();

      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, f.particlePos, gl.DYNAMIC_DRAW);
      const posLoc = gl.getAttribLocation(this.pointShader!, 'attrPosition');
      gl.enableVertexAttribArray(posLoc);
      gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

      gl.bindBuffer(gl.ARRAY_BUFFER, this.pointColorBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, f.particleColor, gl.DYNAMIC_DRAW);
      const colorLoc = gl.getAttribLocation(this.pointShader!, 'attrColor');
      gl.enableVertexAttribArray(colorLoc);
      gl.vertexAttribPointer(colorLoc, 3, gl.FLOAT, false, 0, 0);

      gl.drawArrays(gl.POINTS, 0, f.numParticles);

      gl.disableVertexAttribArray(posLoc);
      gl.disableVertexAttribArray(colorLoc);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
    }

    // draw disk (obstacle)
    const numSegs = 100;
    if (!this.diskVertBuffer) {
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
    gl.uniform1f(gl.getUniformLocation(this.meshShader!, 'scale'), this.scene.obstacleRadius + f.particleRadius);

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
    this.scene.flipRatio = value;
  }

  onThresholdChange(value: number) {
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
}