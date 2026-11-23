/**
 * FinnLab - Tank Simulation Orchestration & UI Controller
 * Manages simulation loop, mouse tracking, panel toggles, real-time telemetry, and CRUD
 */

document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('simCanvas');
  const viewport = document.getElementById('canvasViewport');
  const config = window.INITIAL_TANK_CONFIG || {};

  // Initialize Engines
  const waveEngine = new WaveEngine(canvas);
  const finRenderer = new FinRenderer(canvas);

  // Apply initial configuration to engines
  waveEngine.setConfig({
    density: config.density,
    viscosity: config.viscosity,
    flowDirection: config.flow_direction,
    flowSpeed: config.flow_speed !== undefined ? config.flow_speed : 50,
    renderMode: config.render_mode,
    fluidColor: config.fluid_color,
    fluidTexture: config.fluid_texture
  });

  finRenderer.setConfig({
    fin_size: config.fin_size,
    fin_shape: config.fin_shape,
    fin_color: config.fin_color
  });

  // Telemetry state
  let lastTime = performance.now();
  let frameCount = 0;
  let fps = 60;
  let mouseInViewport = false;

  // --- Resize Handler ---
  function resizeCanvas() {
    const rect = viewport.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    if (!mouseInViewport) {
      finRenderer.x = canvas.width / 2;
      finRenderer.y = canvas.height / 2;
      finRenderer.targetX = finRenderer.x;
      finRenderer.targetY = finRenderer.y;
    }
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // --- Mouse / Touch Interaction ---
  const hintEl = document.getElementById('canvasHint');

  function handlePointerMove(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (hintEl) {
      hintEl.style.opacity = '0';
      setTimeout(() => hintEl.remove(), 1000);
    }

    mouseInViewport = true;
    finRenderer.updateMouse(x, y);
  }

  viewport.addEventListener('mousemove', (e) => {
    handlePointerMove(e.clientX, e.clientY);
  });

  viewport.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0) {
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
    }
  }, { passive: true });

  viewport.addEventListener('mouseleave', () => {
    mouseInViewport = false;
  });

  // --- Panel Toggle System ---
  const panelTank = document.getElementById('panelTankSettings');
  const panelFish = document.getElementById('panelFishSettings');
  const panelInfo = document.getElementById('panelInfoOverview');

  const btnToggleTank = document.getElementById('btnToggleTankPanel');
  const btnToggleFish = document.getElementById('btnToggleFishPanel');
  const btnToggleInfo = document.getElementById('btnToggleInfoPanel');

  const btnCloseTank = document.getElementById('btnCloseTankPanel');
  const btnCloseFish = document.getElementById('btnCloseFishPanel');
  const btnCloseInfo = document.getElementById('btnCloseInfoPanel');

  function togglePanel(panel, btn) {
    const isClosed = panel.classList.toggle('closed');
    if (btn) {
      btn.classList.toggle('active', !isClosed);
    }
  }

  btnToggleTank.addEventListener('click', () => togglePanel(panelTank, btnToggleTank));
  btnToggleFish.addEventListener('click', () => togglePanel(panelFish, btnToggleFish));
  btnToggleInfo.addEventListener('click', () => togglePanel(panelInfo, btnToggleInfo));

  btnCloseTank.addEventListener('click', () => {
    panelTank.classList.add('closed');
    btnToggleTank.classList.remove('active');
  });
  btnCloseFish.addEventListener('click', () => {
    panelFish.classList.add('closed');
    btnToggleFish.classList.remove('active');
  });
  btnCloseInfo.addEventListener('click', () => {
    panelInfo.classList.add('closed');
    btnToggleInfo.classList.remove('active');
  });

  // --- UI Synchronizer & Parameter Listeners ---
  // 1. Tank Name
  const nameInput = document.getElementById('tankNameInput');
  const titleDisplay = document.getElementById('currentTankTitle');
  nameInput.addEventListener('input', (e) => {
    titleDisplay.textContent = e.target.value || '이름 없는 수조';
  });

  // 2. Density Slider
  const densitySlider = document.getElementById('densitySlider');
  const densityVal = document.getElementById('densityValue');
  const infoDensityVal = document.getElementById('infoDensityVal');
  densitySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    densityVal.textContent = val;
    infoDensityVal.textContent = val;
    waveEngine.setConfig({ density: val });
  });

  // 3. Viscosity Slider
  const viscositySlider = document.getElementById('viscositySlider');
  const viscosityVal = document.getElementById('viscosityValue');
  const infoViscosityVal = document.getElementById('infoViscosityVal');
  viscositySlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    viscosityVal.textContent = val + '%';
    infoViscosityVal.textContent = val + '%';
    waveEngine.setConfig({ viscosity: val });
  });

  // 4. Fluid Texture Select
  const textureSelect = document.getElementById('fluidTextureSelect');
  const infoTextureVal = document.getElementById('infoTextureVal');
  textureSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    infoTextureVal.textContent = val;
    waveEngine.setConfig({ fluidTexture: val });
  });

  // 5. Render Mode Radio
  const renderModeRadios = document.querySelectorAll('input[name="render_mode"]');
  const infoRenderModeVal = document.getElementById('infoRenderModeVal');
  renderModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = e.target.value;
      infoRenderModeVal.textContent = val === 'line' ? '선 (Line)' : '면 (Surface)';
      waveEngine.setConfig({ renderMode: val });
    });
  });

  // 6. Fluid Color Picker & Presets
  const fluidColorInput = document.getElementById('fluidColorInput');
  const fluidColorText = document.getElementById('fluidColorText');
  function updateFluidColor(hex) {
    fluidColorInput.value = hex;
    fluidColorText.value = hex;
    waveEngine.setConfig({ fluidColor: hex });
  }
  fluidColorInput.addEventListener('input', (e) => updateFluidColor(e.target.value));
  fluidColorText.addEventListener('change', (e) => updateFluidColor(e.target.value));
  document.querySelectorAll('#fluidColorPresets .btn-color-preset').forEach(btn => {
    btn.addEventListener('click', () => updateFluidColor(btn.dataset.color));
  });

  // 7. Flow Direction Compass Buttons
  const flowButtons = document.querySelectorAll('.btn-flow, .btn-flow-special');
  let currentFlowDir = config.flow_direction || 'E';
  flowButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      flowButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFlowDir = btn.dataset.dir;
      waveEngine.setConfig({ flowDirection: currentFlowDir });
    });
  });

  // 7-2. Flow Speed Slider
  const flowSpeedSlider = document.getElementById('flowSpeedSlider');
  const flowSpeedVal = document.getElementById('flowSpeedValue');
  const infoFlowSpeed = document.getElementById('infoFlowSpeed');
  const infoFlowSpeedVal = document.getElementById('infoFlowSpeedVal');
  if (flowSpeedSlider) {
    flowSpeedSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (flowSpeedVal) flowSpeedVal.textContent = val + '%';
      if (infoFlowSpeed) infoFlowSpeed.textContent = val + '%';
      if (infoFlowSpeedVal) infoFlowSpeedVal.textContent = val + '%';
      waveEngine.setConfig({ flowSpeed: val });
    });
  }

  // 8. Fin Shape Radio & Cards
  const shapeCards = document.querySelectorAll('.shape-card');
  const finShapeRadios = document.querySelectorAll('input[name="fin_shape"]');
  const infoFinShapeVal = document.getElementById('infoFinShapeVal');
  finShapeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      shapeCards.forEach(c => c.classList.remove('selected'));
      const parentCard = radio.closest('.shape-card');
      if (parentCard) parentCard.classList.add('selected');
      const val = e.target.value;
      infoFinShapeVal.textContent = val;
      finRenderer.setConfig({ fin_shape: val });
    });
  });

  // 9. Fin Size Slider
  const finSizeSlider = document.getElementById('finSizeSlider');
  const finSizeVal = document.getElementById('finSizeValue');
  finSizeSlider.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    finSizeVal.textContent = val;
    finRenderer.setConfig({ fin_size: val });
  });

  // 10. Fin Color Picker & Presets
  const finColorInput = document.getElementById('finColorInput');
  const finColorText = document.getElementById('finColorText');
  function updateFinColor(hex) {
    finColorInput.value = hex;
    finColorText.value = hex;
    finRenderer.setConfig({ fin_color: hex });
  }
  finColorInput.addEventListener('input', (e) => updateFinColor(e.target.value));
  finColorText.addEventListener('change', (e) => updateFinColor(e.target.value));
  document.querySelectorAll('#finColorPresets .btn-color-preset').forEach(btn => {
    btn.addEventListener('click', () => updateFinColor(btn.dataset.color));
  });

  // --- Toast Notification Helper ---
  const toast = document.getElementById('toastNotification');
  let toastTimer = null;
  function showToast(message, isError = false) {
    if (toastTimer) clearTimeout(toastTimer);
    toast.textContent = message;
    toast.className = 'toast-notification show' + (isError ? ' error' : '');
    toastTimer = setTimeout(() => {
      toast.className = 'toast-notification';
    }, 3200);
  }

  // --- Save Tank (POST for new, PUT for existing) ---
  const btnSave = document.getElementById('btnSaveTank');
  btnSave.addEventListener('click', async () => {
    const currentRenderMode = document.querySelector('input[name="render_mode"]:checked')?.value || 'surface';
    const currentFinShape = document.querySelector('input[name="fin_shape"]:checked')?.value || 'shark';

    const payload = {
      name: nameInput.value.trim() || '실험 수조 #1',
      density: parseFloat(densitySlider.value),
      viscosity: parseFloat(viscositySlider.value),
      flow_direction: currentFlowDir,
      flow_speed: flowSpeedSlider ? parseFloat(flowSpeedSlider.value) : 50,
      render_mode: currentRenderMode,
      fluid_color: fluidColorInput.value,
      fluid_texture: textureSelect.value,
      fin_size: parseFloat(finSizeSlider.value),
      fin_shape: currentFinShape,
      fin_color: finColorInput.value
    };

    btnSave.disabled = true;
    btnSave.textContent = '저장 중...';

    try {
      if (config.isNew || !config.id) {
        // Create new tank (INSERT)
        const res = await fetch('/api/tanks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.id) {
          showToast('새 수조가 성공적으로 저장되었습니다!');
          setTimeout(() => {
            window.location.href = `/tank/${data.id}`;
          }, 800);
        } else {
          showToast(data.error || '저장에 실패했습니다.', true);
          btnSave.disabled = false;
          btnSave.textContent = '저장';
        }
      } else {
        // Update existing tank (UPDATE)
        const res = await fetch(`/api/tanks/${config.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          showToast('수조 설정이 성공적으로 저장되었습니다.');
        } else {
          showToast(data.error || '수정 저장에 실패했습니다.', true);
        }
        btnSave.disabled = false;
        btnSave.textContent = '저장';
      }
    } catch (err) {
      console.error('Save failed:', err);
      showToast('서버 통신 오류가 발생했습니다.', true);
      btnSave.disabled = false;
      btnSave.textContent = '저장';
    }
  });

  // --- Delete Tank (Delete button inside left settings panel) ---
  const btnDelete = document.getElementById('btnDeleteTank');
  if (btnDelete) {
    btnDelete.addEventListener('click', async () => {
      const confirmed = confirm('정말 이 수조를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.');
      if (!confirmed) return;

      btnDelete.disabled = true;
      btnDelete.textContent = '삭제 중...';

      try {
        const res = await fetch(`/api/tanks/${config.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          alert('수조가 삭제되었습니다. 메인 페이지로 이동합니다.');
          window.location.href = '/';
        } else {
          alert(data.error || '수조 삭제에 실패했습니다.');
          btnDelete.disabled = false;
          btnDelete.textContent = '수조 삭제';
        }
      } catch (err) {
        console.error('Delete failed:', err);
        alert('서버와 통신 중 오류가 발생했습니다.');
        btnDelete.disabled = false;
        btnDelete.textContent = '수조 삭제';
      }
    });
  }

  // --- Real-time Info Dashboard Telemetry Elements ---
  const infoFlowMode = document.getElementById('infoFlowMode');
  const infoFlowAngle = document.getElementById('infoFlowAngle');
  const infoFlowVector = document.getElementById('infoFlowVector');
  const flowNeedle = document.getElementById('flowCompassNeedle');

  const infoFinAngle = document.getElementById('infoFinAngle');
  const infoFinSpeed = document.getElementById('infoFinSpeed');
  const infoFinVector = document.getElementById('infoFinVector');
  const finNeedle = document.getElementById('finDirectionNeedle');

  const infoFpsVal = document.getElementById('infoFpsVal');

  function updateTelemetry() {
    // 1. Flow Vector Telemetry (North is 0° / UP)
    const flow = waveEngine.flowVelocity;
    infoFlowMode.textContent = waveEngine.flowDirection;
    if (infoFlowSpeed) {
      infoFlowSpeed.textContent = `${waveEngine.flowSpeed}%`;
    }
    infoFlowAngle.textContent = `${flow.angleDeg}°`;
    infoFlowVector.textContent = `(${flow.x.toFixed(2)}, ${flow.y.toFixed(2)})`;
    if (flowNeedle) {
      flowNeedle.style.transform = `rotate(${flow.angleDeg}deg)`;
    }

    // 2. Fin Heading & Velocity Telemetry (North is 0° / UP)
    const finHeading = Math.round(finRenderer.headingAngleDeg);
    const speedPxPerSec = Math.round(finRenderer.speed * 60);

    const finRad = (finHeading * Math.PI) / 180;
    const finVx = (Math.sin(finRad) * finRenderer.speed).toFixed(1);
    const finVy = (-Math.cos(finRad) * finRenderer.speed).toFixed(1);

    infoFinAngle.textContent = `${finHeading}°`;
    infoFinSpeed.textContent = `${speedPxPerSec} px/s`;
    infoFinVector.textContent = `(${finVx}, ${finVy})`;
    if (finNeedle) {
      finNeedle.style.transform = `rotate(${finHeading}deg)`;
    }

    // 3. FPS counter
    frameCount++;
    const now = performance.now();
    if (now - lastTime >= 1000) {
      fps = Math.round((frameCount * 1000) / (now - lastTime));
      infoFpsVal.textContent = fps;
      frameCount = 0;
      lastTime = now;
    }
  }

  // --- Main Simulation Loop (60 FPS) ---
  function simulationLoop() {
    // 1. Step wave physics
    waveEngine.step();

    // 2. Transmit flow velocity to fin for dynamic stream flutter
    finRenderer.setFlow(waveEngine.flowVelocity);

    // 3. Continuous Wave Splitting & Fin Obstacle Interaction
    // Runs EVERY FRAME: Incoming water hits the fin, splits around its flanks, and casts a downstream wake!
    waveEngine.interactWithFin(
      finRenderer.x,
      finRenderer.y,
      finRenderer.headingAngleDeg,
      finRenderer.speed,
      finRenderer.size
    );

    // 4. Render wave heightfield
    waveEngine.render();

    // 5. Update & render 2.5D dorsal fin
    finRenderer.update();
    finRenderer.render();

    // 6. Update real-time overview info panel
    updateTelemetry();

    requestAnimationFrame(simulationLoop);
  }

  // Start Simulation
  requestAnimationFrame(simulationLoop);
});
