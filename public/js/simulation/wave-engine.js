/**
 * FinnLab - 2D Heightmap Wave Simulation Engine
 * Implements 2D wave equation with 2.5D visual rendering (Surface / Line modes)
 * and active stream advection & obstacle wave splitting.
 */

class WaveEngine {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Heightmap Grid dimensions (optimized for smooth 60fps)
    this.cols = 160;
    this.rows = 100;
    this.totalCells = this.cols * this.rows;

    // Dual buffers for 2D wave equation
    this.buffer1 = new Float32Array(this.totalCells);
    this.buffer2 = new Float32Array(this.totalCells);
    this.currentBuffer = this.buffer1;
    this.prevBuffer = this.buffer2;

    // Simulation Parameters
    this.density = 50;        // 10 ~ 100
    this.viscosity = 95;      // 80 ~ 99
    this.flowDirection = 'E'; // N, NE, E, SE, S, SW, W, NW, RANDOM, NONE
    this.flowSpeed = 50;      // 0 ~ 100 (Slider)
    this.renderMode = 'surface'; // 'surface' | 'line'
    this.fluidColor = '#00d2ff';
    this.fluidTexture = 'water'; // 'water' | 'magma' | 'mercury' | 'slime'

    // Runtime state
    this.time = 0;
    this.randomFlowAngleDeg = 45;
    this.flowVelocity = { x: 0, y: 0, unitX: 0, unitY: 0, angleDeg: 0, speed: 0 };

    // Offscreen render canvas for surface texture acceleration
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = this.cols;
    this.offscreenCanvas.height = this.rows;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    this.imageData = this.offscreenCtx.createImageData(this.cols, this.rows);
  }

  /**
   * Update configuration parameters
   */
  setConfig(config) {
    if (config.density !== undefined) this.density = Math.max(10, Math.min(100, config.density));
    if (config.viscosity !== undefined) this.viscosity = Math.max(80, Math.min(99, config.viscosity));
    if (config.flowDirection !== undefined) this.flowDirection = config.flowDirection;
    if (config.flowSpeed !== undefined) this.flowSpeed = Math.max(0, Math.min(100, config.flowSpeed));
    if (config.renderMode !== undefined) this.renderMode = config.renderMode;
    if (config.fluidColor !== undefined) this.fluidColor = config.fluidColor;
    if (config.fluidTexture !== undefined) this.fluidTexture = config.fluidTexture;
  }

  /**
   * Calculate flow velocity vector based on flowDirection & flowSpeed
   * NORTH IS SCREEN UP (-Y). Angle 0° = North, 90° = East, 180° = South, 270° = West.
   */
  updateFlowVector() {
    let angleDeg = 0;
    let ux = 0;
    let uy = 0;

    switch (this.flowDirection) {
      case 'N':
        angleDeg = 0;
        ux = 0; uy = -1;
        break;
      case 'NE':
        angleDeg = 45;
        ux = 0.7071; uy = -0.7071;
        break;
      case 'E':
        angleDeg = 90;
        ux = 1; uy = 0;
        break;
      case 'SE':
        angleDeg = 135;
        ux = 0.7071; uy = 0.7071;
        break;
      case 'S':
        angleDeg = 180;
        ux = 0; uy = 1;
        break;
      case 'SW':
        angleDeg = 225;
        ux = -0.7071; uy = 0.7071;
        break;
      case 'W':
        angleDeg = 270;
        ux = -1; uy = 0;
        break;
      case 'NW':
        angleDeg = 315;
        ux = -0.7071; uy = -0.7071;
        break;
      case 'RANDOM':
        // Smoothly drifting random angle over time
        this.randomFlowAngleDeg = (this.randomFlowAngleDeg + Math.sin(this.time * 0.02) * 0.75 + 360) % 360;
        angleDeg = Math.round(this.randomFlowAngleDeg);
        const rad = (angleDeg * Math.PI) / 180;
        ux = Math.sin(rad);
        uy = -Math.cos(rad);
        break;
      case 'NONE':
      default:
        angleDeg = 0;
        ux = 0; uy = 0;
        break;
    }

    // Speed scaling (0 to 100 -> magnitude 0 to 2.8)
    const speedMag = (this.flowDirection === 'NONE') ? 0 : (this.flowSpeed / 100) * 2.8;

    this.flowVelocity = {
      x: ux * speedMag,
      y: uy * speedMag,
      unitX: ux,
      unitY: uy,
      angleDeg: angleDeg,
      speed: speedMag
    };
  }

  /**
   * Inject wave disturbance into heightmap
   */
  disturb(screenX, screenY, radius = 3, intensity = 40) {
    const gridX = Math.floor((screenX / this.canvas.width) * this.cols);
    const gridY = Math.floor((screenY / this.canvas.height) * this.rows);

    const adjustedIntensity = intensity * (1.2 - (this.density / 100) * 0.4);
    const r = Math.max(1, Math.floor(radius));

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const gx = gridX + dx;
        const gy = gridY + dy;
        if (gx > 1 && gx < this.cols - 1 && gy > 1 && gy < this.rows - 1) {
          const distSq = dx * dx + dy * dy;
          if (distSq <= r * r) {
            const factor = Math.cos((Math.sqrt(distSq) / r) * (Math.PI / 2));
            const idx = gy * this.cols + gx;
            this.currentBuffer[idx] += adjustedIntensity * factor;
          }
        }
      }
    }
  }

  /**
   * Physical Fin & Stream Interaction (Runs EVERY FRAME in the simulation loop!)
   * 1. Oncoming water streams hit the fin -> Bow wave rises at leading edge
   * 2. The fin wedges and splits the stream -> Divergent V-waves stream around both flanks
   * 3. Turbulent wake vortex sheds downstream behind the fin
   * 4. If fin moves, additional propulsion wake is added
   */
  interactWithFin(screenX, screenY, finHeadingAngle, finSpeed, finSize) {
    const scale = (finSize / 50);
    const flow = this.flowVelocity;

    // 1. Automatic Stream Collision & Wave Splitting
    if (flow.speed > 0.05) {
      const streamStrength = flow.speed * 4.5 * scale;

      // Upstream vector (where water is coming FROM)
      const fromX = -flow.unitX;
      const fromY = -flow.unitY;

      // Normal vector perpendicular to the flow (for splitting water left/right)
      const perpX = -flow.unitY;
      const perpY = flow.unitX;

      // 1-A. Stagnation / Bow Wave (앞머리 솟구치는 반발파)
      const bowDist = 14 * scale;
      const bowX = screenX + fromX * bowDist;
      const bowY = screenY + fromY * bowDist;
      const bowPulse = Math.sin(this.time * 0.3) * 0.3 + 0.9;
      this.disturb(bowX, bowY, 2 * scale, streamStrength * 0.65 * bowPulse);

      // 1-B. Wave Splitting (물결 양쪽 가르기)
      // Water is diverted along the left and right flanks into divergent streams
      const flankDist = 12 * scale;
      const flankDownstream = 6 * scale;
      
      const leftX = screenX + perpX * flankDist + flow.unitX * flankDownstream;
      const leftY = screenY + perpY * flankDist + flow.unitY * flankDownstream;
      const rightX = screenX - perpX * flankDist + flow.unitX * flankDownstream;
      const rightY = screenY - perpY * flankDist + flow.unitY * flankDownstream;

      this.disturb(leftX, leftY, 2 * scale, streamStrength * 0.5);
      this.disturb(rightX, rightY, 2 * scale, streamStrength * 0.5);

      // 1-C. Downstream Turbulent Wake / Eddy Shedding (후류 와류)
      // Behind the fin, low-pressure wake ripples trail downstream
      const wakeDist = 20 * scale;
      const vortexSway = Math.sin(this.time * 0.28) * (8 * scale);
      const wakeX = screenX + flow.unitX * wakeDist + perpX * vortexSway;
      const wakeY = screenY + flow.unitY * wakeDist + perpY * vortexSway;
      this.disturb(wakeX, wakeY, 2.5 * scale, streamStrength * 0.45);
    }

    // 2. Fin Direct Movement Propulsion Wake (지느러미 직접 이동 시 추진파)
    if (finSpeed > 1) {
      const disturbStrength = Math.min(32, finSpeed * 0.4) * scale;
      this.disturb(screenX, screenY, 2.2 * scale, disturbStrength);

      // Trailing V-wake behind moving fin direction
      const moveRad = (finHeadingAngle * Math.PI) / 180;
      // Fin heading vector: (sin(rad), -cos(rad))
      const headX = Math.sin(moveRad);
      const headY = -Math.cos(moveRad);

      const wakeDist = (12 + finSpeed * 0.2) * scale;
      const perpHeadX = -headY;
      const perpHeadY = headX;

      const trailLeftX = screenX - headX * wakeDist + perpHeadX * (8 * scale);
      const trailLeftY = screenY - headY * wakeDist + perpHeadY * (8 * scale);
      const trailRightX = screenX - headX * wakeDist - perpHeadX * (8 * scale);
      const trailRightY = screenY - headY * wakeDist - perpHeadY * (8 * scale);

      this.disturb(trailLeftX, trailLeftY, 2 * scale, disturbStrength * 0.6);
      this.disturb(trailRightX, trailRightY, 2 * scale, disturbStrength * 0.6);
    }
  }

  /**
   * Inject continuous rolling stream wavefronts at the upstream boundaries
   */
  injectUpstreamWaves() {
    const flow = this.flowVelocity;
    if (flow.speed <= 0.05) return;

    const cols = this.cols;
    const rows = this.rows;
    const cur = this.currentBuffer;

    const waveAmp = (flow.speed / 2.8) * 12.0 * (1.1 - (this.density / 100) * 0.3);
    const wavePhase = this.time * 0.15;
    const spatialFreq = 0.2;

    // Upstream boundaries based on flow direction:
    // If flowing South (uy > 0.3): inject at top boundary (y = 1, 2)
    if (flow.unitY > 0.2) {
      for (let x = 1; x < cols - 1; x++) {
        const val = Math.sin(x * spatialFreq - wavePhase) * waveAmp;
        cur[1 * cols + x] += val * 0.6;
        cur[2 * cols + x] += val * 0.4;
      }
    }
    // If flowing North (uy < -0.2): inject at bottom boundary
    if (flow.unitY < -0.2) {
      for (let x = 1; x < cols - 1; x++) {
        const val = Math.sin(x * spatialFreq - wavePhase) * waveAmp;
        cur[(rows - 2) * cols + x] += val * 0.6;
        cur[(rows - 3) * cols + x] += val * 0.4;
      }
    }
    // If flowing East (ux > 0.2): inject at left boundary (x = 1, 2)
    if (flow.unitX > 0.2) {
      for (let y = 1; y < rows - 1; y++) {
        const val = Math.sin(y * spatialFreq - wavePhase) * waveAmp;
        cur[y * cols + 1] += val * 0.6;
        cur[y * cols + 2] += val * 0.4;
      }
    }
    // If flowing West (ux < -0.2): inject at right boundary
    if (flow.unitX < -0.2) {
      for (let y = 1; y < rows - 1; y++) {
        const val = Math.sin(y * spatialFreq - wavePhase) * waveAmp;
        cur[y * cols + (cols - 2)] += val * 0.6;
        cur[y * cols + (cols - 3)] += val * 0.4;
      }
    }
  }

  /**
   * Step the 2D wave equation simulation
   */
  step() {
    this.time++;
    this.updateFlowVector();

    // 1. Inject continuous stream waves from upstream edges
    this.injectUpstreamWaves();

    // Damping factor calculated from viscosity (80% to 99%)
    // Higher viscosity means thicker fluid -> faster wave decay
    const damping = 0.992 - ((this.viscosity - 80) / 19) * 0.055;

    const cols = this.cols;
    const rows = this.rows;
    const cur = this.currentBuffer;
    const prev = this.prevBuffer;

    const flowX = this.flowVelocity.x;
    const flowY = this.flowVelocity.y;
    const hasFlow = this.flowVelocity.speed > 0.05;

    // Main 2D wave equation kernel with flow advection
    for (let y = 1; y < rows - 1; y++) {
      const rowOffset = y * cols;
      for (let x = 1; x < cols - 1; x++) {
        const idx = rowOffset + x;

        // Wave propagation from 4 cardinal neighbors
        let val = (cur[idx - 1] + cur[idx + 1] + cur[idx - cols] + cur[idx + cols]) * 0.5 - prev[idx];

        // Active fluid advection: shift wave energy downstream in flow direction
        if (hasFlow) {
          const shiftX = Math.round(flowX * 0.45);
          const shiftY = Math.round(flowY * 0.45);
          const srcIdx = (y - shiftY) * cols + (x - shiftX);
          if (srcIdx > 0 && srcIdx < this.totalCells) {
            val = val * 0.88 + cur[srcIdx] * 0.12;
          }
        }

        prev[idx] = val * damping;
      }
    }

    // Swap dual buffers
    this.currentBuffer = prev;
    this.prevBuffer = cur;
  }

  /**
   * Parse hex color to RGB
   */
  hexToRgb(hex) {
    const clean = hex.replace('#', '');
    let r = 0, g = 210, b = 255;
    if (clean.length === 6) {
      r = parseInt(clean.substring(0, 2), 16);
      g = parseInt(clean.substring(2, 4), 16);
      b = parseInt(clean.substring(4, 6), 16);
    }
    return { r, g, b };
  }

  /**
   * Render wave heightfield based on renderMode ('surface' or 'line')
   */
  render() {
    if (this.renderMode === 'line') {
      this.renderLineMode();
    } else {
      this.renderSurfaceMode();
    }
  }

  /**
   * Mode 1: Line (선 방식 - 와이어프레임 / 등고선·격자 파동 2.5D)
   */
  renderLineMode() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cols = this.cols;
    const rows = this.rows;
    const cur = this.currentBuffer;

    ctx.fillStyle = '#05080e';
    ctx.fillRect(0, 0, w, h);

    const stepX = w / (cols - 1);
    const stepY = h / (rows - 1);
    const waveScale = 2.0;

    const baseRgb = this.hexToRgb(this.fluidColor);
    const rowSkip = 2;
    const colSkip = 2;

    // Draw horizontal wave contour lines
    for (let y = 1; y < rows - 1; y += rowSkip) {
      ctx.beginPath();
      let first = true;
      for (let x = 1; x < cols - 1; x += colSkip) {
        const idx = y * cols + x;
        const waveH = cur[idx];
        const screenX = x * stepX;
        const screenY = y * stepY - waveH * waveScale;

        if (first) {
          ctx.moveTo(screenX, screenY);
          first = false;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }

      let alpha = 0.35 + (y / rows) * 0.25;
      ctx.strokeStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, ${alpha})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Draw perspective vertical grid lines
    for (let x = 1; x < cols - 1; x += colSkip * 2) {
      ctx.beginPath();
      let first = true;
      for (let y = 1; y < rows - 1; y += rowSkip) {
        const idx = y * cols + x;
        const waveH = cur[idx];
        const screenX = x * stepX;
        const screenY = y * stepY - waveH * waveScale;

        if (first) {
          ctx.moveTo(screenX, screenY);
          first = false;
        } else {
          ctx.lineTo(screenX, screenY);
        }
      }
      ctx.strokeStyle = `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.18)`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  /**
   * Mode 2: Surface (면 방식 - 그라데이션·입체 음영 수면 2.5D)
   */
  renderSurfaceMode() {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cols = this.cols;
    const rows = this.rows;
    const cur = this.currentBuffer;

    const imgData = this.imageData;
    const pixels = imgData.data;

    const base = this.hexToRgb(this.fluidColor);
    const texture = this.fluidTexture;

    for (let y = 1; y < rows - 1; y++) {
      const rowOffset = y * cols;
      for (let x = 1; x < cols - 1; x++) {
        const idx = rowOffset + x;
        const pIdx = idx * 4;

        const dx = (cur[idx + 1] - cur[idx - 1]) * 0.6;
        const dy = (cur[idx + cols] - cur[idx - cols]) * 0.6;
        const waveH = cur[idx];

        const light = -dx * 0.5 - dy * 0.5;
        const spec = Math.pow(Math.max(0, -dx * 0.7 - dy * 0.7), 3) * 2.2;

        let r = 0, g = 0, b = 0, a = 255;

        if (texture === 'water') {
          r = Math.min(255, Math.max(0, base.r * 0.2 + waveH * 1.5 + spec * 220));
          g = Math.min(255, Math.max(0, base.g * 0.5 + waveH * 2.5 + light * 40 + spec * 240));
          b = Math.min(255, Math.max(0, base.b * 0.8 + waveH * 3.0 + light * 50 + spec * 255));
        } else if (texture === 'magma') {
          const glow = Math.abs(waveH) * 5.0 + light * 30;
          r = Math.min(255, Math.max(25, 40 + glow * 3.5 + spec * 180));
          g = Math.min(255, Math.max(8, 12 + glow * 1.8 + spec * 120));
          b = Math.min(255, Math.max(4, 5 + glow * 0.3));
        } else if (texture === 'mercury') {
          const metal = 110 + light * 90 + spec * 320;
          r = Math.min(255, Math.max(40, metal * 0.95 + base.r * 0.15));
          g = Math.min(255, Math.max(45, metal * 1.0 + base.g * 0.15));
          b = Math.min(255, Math.max(55, metal * 1.1 + base.b * 0.2));
        } else if (texture === 'slime') {
          const slimeGlow = waveH * 3.0 + light * 45;
          r = Math.min(255, Math.max(0, 15 + slimeGlow * 0.5 + spec * 100));
          g = Math.min(255, Math.max(20, 80 + slimeGlow * 3.0 + spec * 220));
          b = Math.min(255, Math.max(0, 20 + slimeGlow * 0.3 + spec * 60));
        }

        pixels[pIdx] = r;
        pixels[pIdx + 1] = g;
        pixels[pIdx + 2] = b;
        pixels[pIdx + 3] = a;
      }
    }

    this.offscreenCtx.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.offscreenCanvas, 0, 0, cols, rows, 0, 0, w, h);

    // Depth vignette
    const gradient = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, w * 0.7);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0, 3, 8, 0.45)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);
  }
}

window.WaveEngine = WaveEngine;
