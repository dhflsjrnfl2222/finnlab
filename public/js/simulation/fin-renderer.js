/**
 * FinnLab - 2.5D Dorsal Fin Renderer
 * Renders vector-based fish dorsal fins (Shark, Streamline, Betta)
 * with North-is-up compass alignment, motion Lerp, and fluid stream coupling.
 */

class FinRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Fin parameters
    this.size = 50;       // 20 ~ 100
    this.shape = 'shark'; // 'shark' | 'streamline' | 'betta'
    this.color = '#ffffff';

    // Position & vector rotation
    this.x = canvas.width / 2;
    this.y = canvas.height / 2;
    this.targetX = this.x;
    this.targetY = this.y;

    // Heading angle in degrees where 0° = NORTH (Screen UP), 90° = EAST, 180° = SOUTH, 270° = WEST
    this.headingAngleDeg = 90;
    this.targetAngleDeg = 90;
    this.speed = 0;        // Current movement speed (px/frame)

    // Fluid stream coupling
    this.flowVelocity = { x: 0, y: 0, unitX: 0, unitY: 0, speed: 0, angleDeg: 0 };
    this.swayTime = 0;
  }

  /**
   * Update fin configuration
   */
  setConfig(config) {
    if (config.fin_size !== undefined) this.size = Math.max(20, Math.min(100, config.fin_size));
    if (config.fin_shape !== undefined) this.shape = config.fin_shape;
    if (config.fin_color !== undefined) this.color = config.fin_color;
  }

  /**
   * Update current flow velocity from wave engine
   */
  setFlow(flow) {
    if (flow) {
      this.flowVelocity = flow;
    }
  }

  /**
   * Update mouse position and compute motion vector & North-based heading angle
   */
  updateMouse(mouseX, mouseY) {
    const dx = mouseX - this.targetX;
    const dy = mouseY - this.targetY;
    const dist = Math.hypot(dx, dy);

    this.targetX = mouseX;
    this.targetY = mouseY;

    // Compute heading angle clockwise from North (0° = North, 90° = East, 180° = South, 270° = West)
    if (dist > 1.2) {
      let deg = Math.round((Math.atan2(dx, -dy) * 180) / Math.PI);
      if (deg < 0) deg += 360;
      this.targetAngleDeg = deg;
      this.speed = dist;
    } else {
      this.speed *= 0.85;
    }
  }

  /**
   * Angle Lerp taking shortest path around circular boundary [0, 360)
   */
  lerpAngleDeg(current, target, factor) {
    let diff = (target - current) % 360;
    if (diff < -180) diff += 360;
    if (diff > 180) diff -= 360;
    let res = current + diff * factor;
    if (res < 0) res += 360;
    if (res >= 360) res %= 360;
    return res;
  }

  /**
   * Update simulation physics / interpolation
   */
  update() {
    this.swayTime += 0.06;

    // Smooth position interpolation
    this.x += (this.targetX - this.x) * 0.45;
    this.y += (this.targetY - this.y) * 0.45;

    // Smooth heading angle interpolation
    const turnFactor = Math.min(0.28, 0.12 + (this.speed / 100) * 0.15);
    this.headingAngleDeg = this.lerpAngleDeg(this.headingAngleDeg, this.targetAngleDeg, turnFactor);
  }

  /**
   * Main 2.5D Fin Render method
   */
  render() {
    const ctx = this.ctx;
    const x = this.x;
    const y = this.y;
    const scale = (this.size / 50);

    // Canvas rotation: Fin art's nose points East (+X).
    // To align with North-is-up (0° = North = -Y):
    // canvasAngle = (headingAngleDeg - 90) * PI / 180
    const canvasAngleRad = ((this.headingAngleDeg - 90) * Math.PI) / 180;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(canvasAngleRad);

    // 1. Underwater Soft Shadow (2.5D depth illusion)
    this.renderShadow(ctx, scale);

    // 2. Waterline Piercing Ripple / Foam Collar
    this.renderWaterlineCollar(ctx, scale);

    // 3. 2.5D Dorsal Fin Blade
    this.renderFinBlade(ctx, scale);

    ctx.restore();
  }

  /**
   * 1. Underwater Shadow
   */
  renderShadow(ctx, scale) {
    ctx.save();
    const shadowOffsetX = -6 * scale;
    const shadowOffsetY = 14 * scale;

    ctx.beginPath();
    ctx.ellipse(shadowOffsetX, shadowOffsetY, 28 * scale, 10 * scale, -0.1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.filter = 'blur(4px)';
    ctx.fill();
    ctx.restore();
  }

  /**
   * 2. Waterline Piercing Ripple Collar
   */
  renderWaterlineCollar(ctx, scale) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(0, 2, 22 * scale, 7 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.8 * scale;
    ctx.stroke();

    // Secondary trailing foam ring
    ctx.beginPath();
    ctx.ellipse(-10 * scale, 2, 14 * scale, 5 * scale, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1.2 * scale;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * 3. 2.5D Dorsal Fin Blade by Shape
   */
  renderFinBlade(ctx, scale) {
    // Dynamic sway flex coupled with stream velocity & motion speed
    const flowEffect = (this.flowVelocity.speed / 2.8) * 3.5;
    const sway = (Math.sin(this.swayTime * 2.8) * (1.5 + Math.min(6, this.speed * 0.15)) +
                  Math.sin(this.swayTime * 4.5) * flowEffect) * scale;

    ctx.save();

    // Elevation gradient (bright tip, dark waterline base)
    const finGradient = ctx.createLinearGradient(0, -35 * scale, 0, 5 * scale);
    finGradient.addColorStop(0, '#ffffff');
    finGradient.addColorStop(0.35, this.color);
    finGradient.addColorStop(1, 'rgba(10, 20, 30, 0.85)');

    ctx.fillStyle = finGradient;

    switch (this.shape) {
      case 'shark':
        this.drawSharkFin(ctx, scale, sway);
        break;
      case 'streamline':
        this.drawStreamlineFin(ctx, scale, sway);
        break;
      case 'betta':
        this.drawBettaFin(ctx, scale, sway);
        break;
      default:
        this.drawSharkFin(ctx, scale, sway);
        break;
    }

    // Specular leading edge highlight
    this.drawLeadingEdgeHighlight(ctx, scale);

    ctx.restore();
  }

  /**
   * Shark Fin
   */
  drawSharkFin(ctx, scale, sway) {
    ctx.beginPath();
    ctx.moveTo(18 * scale, 2);
    ctx.bezierCurveTo(
      12 * scale, -14 * scale,
      -2 * scale, -32 * scale,
      -12 * scale, -38 * scale
    );
    ctx.bezierCurveTo(
      -10 * scale + sway, -24 * scale,
      -14 * scale + sway, -14 * scale,
      -18 * scale + sway, -4 * scale
    );
    ctx.quadraticCurveTo(-14 * scale, 2, -10 * scale, 3);
    ctx.lineTo(18 * scale, 2);
    ctx.closePath();

    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  /**
   * Streamline Fin
   */
  drawStreamlineFin(ctx, scale, sway) {
    ctx.beginPath();
    ctx.moveTo(22 * scale, 2);
    ctx.bezierCurveTo(
      14 * scale, -16 * scale,
      2 * scale, -30 * scale,
      -8 * scale, -34 * scale
    );
    ctx.bezierCurveTo(
      -10 * scale + sway, -20 * scale,
      -14 * scale + sway, -8 * scale,
      -16 * scale + sway, 2
    );
    ctx.closePath();

    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  /**
   * Betta Fin
   */
  drawBettaFin(ctx, scale, sway) {
    ctx.beginPath();
    ctx.moveTo(16 * scale, 2);
    ctx.bezierCurveTo(
      10 * scale, -18 * scale,
      -4 * scale, -34 * scale,
      -16 * scale, -42 * scale
    );
    ctx.bezierCurveTo(
      -12 * scale + sway, -30 * scale,
      -22 * scale + sway, -22 * scale,
      -14 * scale + sway, -14 * scale
    );
    ctx.bezierCurveTo(
      -24 * scale + sway * 1.5, -8 * scale,
      -18 * scale + sway, -2 * scale,
      -20 * scale, 2
    );
    ctx.closePath();

    ctx.fill();

    // Internal translucent fin rays
    ctx.beginPath();
    ctx.moveTo(10 * scale, 0);
    ctx.quadraticCurveTo(0, -18 * scale, -14 * scale, -38 * scale);
    ctx.moveTo(4 * scale, 0);
    ctx.quadraticCurveTo(-4 * scale, -14 * scale, -16 * scale, -24 * scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /**
   * Specular Leading Edge Highlight
   */
  drawLeadingEdgeHighlight(ctx, scale) {
    ctx.beginPath();
    ctx.moveTo(16 * scale, 0);
    ctx.quadraticCurveTo(6 * scale, -18 * scale, -10 * scale, -34 * scale);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }
}

window.FinRenderer = FinRenderer;
