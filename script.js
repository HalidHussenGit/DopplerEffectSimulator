// script.js — Enhanced Doppler effect with VERY noticeable sound changes
document.addEventListener('DOMContentLoaded', ()=> {
  const id = document.body.id;
  if(id === 'page-sound') initSoundSim();
  if(id === 'page-light') initLightSim();
});

// --------------------------- SOUND SIMULATOR ---------------------------
function initSoundSim(){
  // DOM
  const canvas = document.getElementById('soundCanvas');
  const ctx = canvas.getContext('2d');
  const emittedFreq = document.getElementById('emittedFreq');
  const emittedFreqVal = document.getElementById('emittedFreqVal');
  const waveSpeed = document.getElementById('waveSpeed');
  const waveSpeedVal = document.getElementById('waveSpeedVal');
  const sourceSpeed = document.getElementById('sourceSpeed');
  const sourceSpeedVal = document.getElementById('sourceSpeedVal');
  const observerSpeed = document.getElementById('observerSpeed');
  const observerSpeedVal = document.getElementById('observerSpeedVal');
  const startSim = document.getElementById('startSim');
  const stopSim = document.getElementById('stopSim');
  const resetSim = document.getElementById('resetSim');
  const soundType = document.getElementById('soundType');

  function resize(){ canvas.width = Math.min(1000, window.innerWidth - 40); canvas.height = 280; }
  window.addEventListener('resize', resize); resize();

  // ENHANCED: Longer track for extended Doppler effect
  const metersTrack = 200; // increased from 80 to 200 meters
  const scale = ()=> canvas.width / metersTrack;
  const source = { x: 20, y: canvas.height/2, r: 12, vx: 0 }; // start further left
  const observer = { x: 100, y: canvas.height/2, r: 12, vx: 0 }; // center position
  let wavefronts = [];
  let running = false;
  let lastTime = 0;

  // audio
  let audioCtx = null;
  let osc = null;
  let osc2 = null; // ENHANCED: second oscillator for richer sounds
  let lfo = null;
  let noiseSource = null;
  let noiseFilter = null;
  let carBeepTimer = null;
  let mainGain = null;
  let mainGain2 = null; // for second oscillator

  function ensureAudio(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  // UI labels
  function setLabels(){
    emittedFreqVal.textContent = emittedFreq.value;
    waveSpeedVal.textContent = waveSpeed.value;
    sourceSpeedVal.textContent = sourceSpeed.value;
    observerSpeedVal.textContent = observerSpeed.value;
  }
  [emittedFreq, waveSpeed, sourceSpeed, observerSpeed].forEach(i => i.addEventListener('input', setLabels));
  setLabels();

  // Utility: stop all audio nodes
  function stopAudio(){
    try{ if(osc){ osc.stop(); osc.disconnect(); osc=null; } }catch(e){}
    try{ if(osc2){ osc2.stop(); osc2.disconnect(); osc2=null; } }catch(e){}
    try{ if(lfo){ lfo.stop(); lfo.disconnect(); lfo=null; } }catch(e){}
    try{ if(noiseSource){ noiseSource.stop(); noiseSource.disconnect(); noiseSource=null; } }catch(e){}
    try{ if(noiseFilter){ noiseFilter.disconnect(); noiseFilter=null; } }catch(e){}
    try{ if(mainGain){ mainGain.disconnect(); mainGain=null; } }catch(e){}
    try{ if(mainGain2){ mainGain2.disconnect(); mainGain2=null; } }catch(e){}
    try{ if(carBeepTimer){ clearInterval(carBeepTimer); carBeepTimer=null; } }catch(e){}
  }

  // Create a noise source
  function createNoise(filterFreq = 800, volume = 0.3){
    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for(let i=0;i<bufferSize;i++) output[i] = (Math.random()*2-1) * volume;
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = audioCtx.createGain();
    gain.gain.value = volume;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);
    src.start(0);
    return { src, filter, gain };
  }

  // create oscillator + gain wrapper
  function createOscWrapper(freq){
    stopAudio();
    osc = audioCtx.createOscillator();
    mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.2; // ENHANCED: slightly louder
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(mainGain);
    mainGain.connect(audioCtx.destination);
    osc.start();
    return { osc, gain: mainGain };
  }

  // police: modulated two-tone siren
  function startPolice(baseFreq){
    stopAudio();
    osc = audioCtx.createOscillator(); osc.type = 'sine';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.18;
    osc.connect(mainGain).connect(audioCtx.destination);
    lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 1.6;
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 50; // ENHANCED: more modulation
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.frequency.value = baseFreq;
    lfo.start(); osc.start();
  }

  // ambulance: slower wobble
  function startAmbulance(baseFreq){
    stopAudio();
    osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.15;
    osc.connect(mainGain).connect(audioCtx.destination);
    lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.8;
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 100; // ENHANCED: more modulation
    lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
    osc.frequency.value = baseFreq;
    lfo.start(); osc.start();
  }

  // car: periodic beep
  function startCar(baseFreq){
    stopAudio();
    startCar._currentFreq = baseFreq;
    function makeBeep(){
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'square';
      o.frequency.value = startCar._currentFreq || baseFreq;
      g.gain.value = 0;
      o.connect(g).connect(audioCtx.destination);
      o.start();
      const t = audioCtx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.45, t + 0.02); // ENHANCED: louder
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      setTimeout(()=>{ try{ o.stop(); o.disconnect(); }catch(e){} }, 420);
    }
    makeBeep();
    carBeepTimer = setInterval(makeBeep, 700);
  }

  // jet: low noise + low oscillator
  function startJet(baseFreq){
    stopAudio();
    const noise = createNoise(800, 0.35); // ENHANCED: louder
    noiseSource = noise.src;
    noiseFilter = noise.filter;
    osc = audioCtx.createOscillator(); osc.type = 'sine';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.12;
    osc.frequency.value = baseFreq;
    osc.connect(mainGain).connect(audioCtx.destination);
    osc.start();
  }

  // ENHANCED: F1 Car - high-pitched scream with harmonics
  function startF1(baseFreq){
    stopAudio();
    // Main engine note (high frequency)
    osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.15;
    osc.frequency.value = baseFreq * 3; // high pitched
    osc.connect(mainGain).connect(audioCtx.destination);
    osc.start();
    
    // Second harmonic for richness
    osc2 = audioCtx.createOscillator(); osc2.type = 'square';
    mainGain2 = audioCtx.createGain(); mainGain2.gain.value = 0.08;
    osc2.frequency.value = baseFreq * 4.5;
    osc2.connect(mainGain2).connect(audioCtx.destination);
    osc2.start();
    
    // Add some noise for realism
    const noise = createNoise(3000, 0.15);
    noiseSource = noise.src;
    noiseFilter = noise.filter;
  }

  // ENHANCED: Motorcycle - throaty rumble
  function startMotorcycle(baseFreq){
    stopAudio();
    // Low rumble
    osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.18;
    osc.frequency.value = baseFreq * 0.8;
    osc.connect(mainGain).connect(audioCtx.destination);
    osc.start();
    
    // Higher harmonic
    osc2 = audioCtx.createOscillator(); osc2.type = 'square';
    mainGain2 = audioCtx.createGain(); mainGain2.gain.value = 0.1;
    osc2.frequency.value = baseFreq * 2;
    osc2.connect(mainGain2).connect(audioCtx.destination);
    osc2.start();
  }

  // ENHANCED: Train horn - deep and loud
  function startTrain(baseFreq){
    stopAudio();
    // Low fundamental
    osc = audioCtx.createOscillator(); osc.type = 'sine';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.2;
    osc.frequency.value = baseFreq * 0.5;
    osc.connect(mainGain).connect(audioCtx.destination);
    osc.start();
    
    // Higher harmonic for train horn character
    osc2 = audioCtx.createOscillator(); osc2.type = 'sine';
    mainGain2 = audioCtx.createGain(); mainGain2.gain.value = 0.15;
    osc2.frequency.value = baseFreq * 0.75;
    osc2.connect(mainGain2).connect(audioCtx.destination);
    osc2.start();
  }

  // ENHANCED: Race car - aggressive engine
  function startRaceCar(baseFreq){
    stopAudio();
    // Engine roar
    osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.16;
    osc.frequency.value = baseFreq * 2;
    osc.connect(mainGain).connect(audioCtx.destination);
    osc.start();
    
    // Exhaust note
    osc2 = audioCtx.createOscillator(); osc2.type = 'square';
    mainGain2 = audioCtx.createGain(); mainGain2.gain.value = 0.12;
    osc2.frequency.value = baseFreq * 3;
    osc2.connect(mainGain2).connect(audioCtx.destination);
    osc2.start();
    
    // Engine noise
    const noise = createNoise(2000, 0.2);
    noiseSource = noise.src;
    noiseFilter = noise.filter;
  }

  // ENHANCED: Helicopter - rhythmic chop
  function startHelicopter(baseFreq){
    stopAudio();
    // Rotor blade chop (modulated low frequency)
    osc = audioCtx.createOscillator(); osc.type = 'sawtooth';
    mainGain = audioCtx.createGain(); mainGain.gain.value = 0.14;
    osc.connect(mainGain).connect(audioCtx.destination);
    
    // LFO for blade chop
    lfo = audioCtx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 12; // 12 Hz chop
    const lfoGain = audioCtx.createGain(); lfoGain.gain.value = 30;
    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);
    osc.frequency.value = baseFreq * 0.6;
    lfo.start(); osc.start();
    
    // Turbine noise
    const noise = createNoise(1200, 0.25);
    noiseSource = noise.src;
    noiseFilter = noise.filter;
  }

  // REALISTIC Doppler frequency calculation
  function observedFrequency(f, c, sourcePos, observerPos, sourceVel, observerVel){
    const dx = observerPos.x - sourcePos.x;
    const dy = observerPos.y - sourcePos.y;
    const distance = Math.sqrt(dx*dx + dy*dy);
    
    if(distance < 0.1) return f;
    
    const ux = dx / distance;
    const uy = dy / distance;
    
    const v_source_radial = sourceVel.x * ux + sourceVel.y * uy;
    const v_observer_radial = observerVel.x * ux + observerVel.y * uy;
    
    const denominator = c - v_source_radial;
    
    if(Math.abs(denominator) < 1e-6) return NaN;
    
    const fObs = f * (c + v_observer_radial) / denominator;
    
    return fObs;
  }

  // emit wavefront
  function emitWave(tMs, xMeters){
    wavefronts.push({ x: xMeters, t: tMs, r: 0 });
  }

  // ENHANCED: smooth frequency transition with adjustable ramp
  function smoothFrequencyUpdate(targetFreq, rampTime = 0.08){
    if(!osc || !isFinite(targetFreq) || targetFreq < 20 || targetFreq > 20000) return;
    const now = audioCtx.currentTime;
    try{
      osc.frequency.cancelScheduledValues(now);
      osc.frequency.setValueAtTime(osc.frequency.value, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), now + rampTime);
    }catch(e){}
  }

  // ENHANCED: smooth frequency for second oscillator
  function smoothFrequencyUpdate2(targetFreq, rampTime = 0.08){
    if(!osc2 || !isFinite(targetFreq) || targetFreq < 20 || targetFreq > 20000) return;
    const now = audioCtx.currentTime;
    try{
      osc2.frequency.cancelScheduledValues(now);
      osc2.frequency.setValueAtTime(osc2.frequency.value, now);
      osc2.frequency.exponentialRampToValueAtTime(Math.max(20, targetFreq), now + rampTime);
    }catch(e){}
  }

  // main update/draw
  function update(now){
    if(!lastTime) lastTime = now;
    const dt = (now - lastTime) / 1000;
    lastTime = now;

    const f = Number(emittedFreq.value);
    const c = Number(waveSpeed.value);
    const v_src = Number(sourceSpeed.value);
    const v_obs = Number(observerSpeed.value);

    source.vx = v_src;
    observer.vx = v_obs;

    if(running){
      source.x += source.vx * dt;
      observer.x += observer.vx * dt;
    }

    // ENHANCED: wrapping for longer track
    if(source.x > metersTrack + 20) source.x = -20;
    if(source.x < -20) source.x = metersTrack + 20;
    if(observer.x > metersTrack - 10) observer.x = metersTrack - 10;
    if(observer.x < 10) observer.x = 10;

    if(running){
      if(!update._lastEmit) update._lastEmit = now;
      const period = 1000 / f;
      if(now - update._lastEmit >= period){
        emitWave(now, source.x);
        update._lastEmit = now;
      }
    }

    for(let w of wavefronts) w.r += c * dt;
    wavefronts = wavefronts.filter(w => w.r * scale() < Math.max(canvas.width, canvas.height) * 1.5);

    // draw
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = '#f6f8fb'; ctx.lineWidth = 1;
    for(let gx=0; gx<canvas.width; gx+=40){ ctx.beginPath(); ctx.moveTo(gx,0); ctx.lineTo(gx,canvas.height); ctx.stroke(); }

    ctx.globalAlpha = 0.9;
    for(let w of wavefronts){
      ctx.beginPath();
      ctx.strokeStyle = '#d8edff';
      ctx.lineWidth = 2;
      ctx.arc(w.x * scale(), source.y, w.r * scale(), 0, Math.PI*2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    const sx = source.x * scale();
    const ox = observer.x * scale();
    ctx.fillStyle = '#ff8a28'; ctx.beginPath(); ctx.arc(sx, source.y, source.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '11px system-ui'; ctx.fillText('Source', sx - 20, source.y - 18);

    ctx.fillStyle = '#3355ff'; ctx.beginPath(); ctx.arc(ox, observer.y, observer.r, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText('Observer', ox - 28, observer.y - 18);

    const sourceVel = { x: source.vx, y: 0 };
    const observerVel = { x: observer.vx, y: 0 };
    const fObs = observedFrequency(f, c, source, observer, sourceVel, observerVel);
    
    // ENHANCED: Show frequency shift percentage
    const freqShift = isFinite(fObs) ? ((fObs - f) / f * 100) : 0;
    
    ctx.fillText(`Emitted f = ${f.toFixed(1)} Hz`, 12, 18);
    ctx.fillText(`Observed f ≈ ${isFinite(fObs) ? fObs.toFixed(1) : '—'} Hz`, 12, 36);
    ctx.fillText(`Shift: ${freqShift > 0 ? '+' : ''}${freqShift.toFixed(1)}%`, 12, 54);
    ctx.fillText(`Source x = ${source.x.toFixed(1)} m`, 12, 72);
    ctx.fillText(`Observer x = ${observer.x.toFixed(1)} m`, 12, 90);

    // ENHANCED: audio update with better handling for each sound type
    if(audioCtx && running && isFinite(fObs)){
      const sel = soundType.value;
      
      if(sel === 'osc'){
        smoothFrequencyUpdate(fObs, 0.08);
      } 
      else if(sel === 'police' || sel === 'ambulance'){
        smoothFrequencyUpdate(fObs, 0.08);
      } 
      else if(sel === 'car'){
        if(fObs > 20 && fObs < 20000){
          startCar._currentFreq = fObs;
        }
      } 
      else if(sel === 'jet'){
        const jetFreq = Math.max(40, Math.min(250, fObs * 0.35));
        smoothFrequencyUpdate(jetFreq, 0.12);
        if(noiseFilter){
          const filterFreq = Math.max(400, Math.min(2500, 800 + (fObs - f) * 3));
          try{
            const now = audioCtx.currentTime;
            noiseFilter.frequency.cancelScheduledValues(now);
            noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 0.12);
          }catch(e){}
        }
      }
      else if(sel === 'f1'){
        // F1 car - very high frequency with dramatic shift
        smoothFrequencyUpdate(fObs * 3, 0.06); // main engine scream
        smoothFrequencyUpdate2(fObs * 4.5, 0.06); // harmonic
        if(noiseFilter){
          const filterFreq = Math.max(2000, Math.min(8000, 3000 + (fObs - f) * 8));
          try{
            const now = audioCtx.currentTime;
            noiseFilter.frequency.cancelScheduledValues(now);
            noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 0.06);
          }catch(e){}
        }
      }
      else if(sel === 'motorcycle'){
        smoothFrequencyUpdate(fObs * 0.8, 0.08);
        smoothFrequencyUpdate2(fObs * 2, 0.08);
      }
      else if(sel === 'train'){
        smoothFrequencyUpdate(fObs * 0.5, 0.1);
        smoothFrequencyUpdate2(fObs * 0.75, 0.1);
      }
      else if(sel === 'racecar'){
        smoothFrequencyUpdate(fObs * 2, 0.07);
        smoothFrequencyUpdate2(fObs * 3, 0.07);
        if(noiseFilter){
          const filterFreq = Math.max(1500, Math.min(5000, 2000 + (fObs - f) * 5));
          try{
            const now = audioCtx.currentTime;
            noiseFilter.frequency.cancelScheduledValues(now);
            noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 0.07);
          }catch(e){}
        }
      }
      else if(sel === 'helicopter'){
        smoothFrequencyUpdate(fObs * 0.6, 0.1);
        if(noiseFilter){
          const filterFreq = Math.max(800, Math.min(2500, 1200 + (fObs - f) * 2));
          try{
            const now = audioCtx.currentTime;
            noiseFilter.frequency.cancelScheduledValues(now);
            noiseFilter.frequency.setValueAtTime(noiseFilter.frequency.value, now);
            noiseFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 0.1);
          }catch(e){}
        }
      }
    }

    if(running) requestAnimationFrame(update);
  }

  // handlers
  startSim.addEventListener('click', async ()=>{
    if(running) return;
    ensureAudio();
    running = true;
    lastTime = performance.now();
    update._lastEmit = lastTime;
    const sel = soundType.value;
    const base = Number(emittedFreq.value);
    
    if(sel === 'osc') createOscWrapper(base);
    else if(sel === 'police') startPolice(base);
    else if(sel === 'ambulance') startAmbulance(base);
    else if(sel === 'car') startCar(base);
    else if(sel === 'jet') startJet(Math.max(60, base * 0.5));
    else if(sel === 'f1') startF1(base);
    else if(sel === 'motorcycle') startMotorcycle(base);
    else if(sel === 'train') startTrain(base);
    else if(sel === 'racecar') startRaceCar(base);
    else if(sel === 'helicopter') startHelicopter(base);
    
    requestAnimationFrame(update);
  });
  
  stopSim.addEventListener('click', ()=>{
    running = false;
    stopAudio();
  });

  resetSim.addEventListener('click', ()=>{
    running = false;
    stopAudio();
    wavefronts = [];
    source.x = 20;
    observer.x = 100;
    source.vx = 0;
    observer.vx = 0;
    lastTime = performance.now();
    update(lastTime);
  });

  // initial draw
  source.y = canvas.height/2;
  observer.y = canvas.height/2;
  lastTime = performance.now();
  update(lastTime);
}

// --------------------------- LIGHT SIMULATOR (UNCHANGED) ---------------------------
function initLightSim(){
  const canvas = document.getElementById('lightCanvas');
  const ctx = canvas.getContext('2d');
  const betaControl = document.getElementById('beta');
  const betaVal = document.getElementById('betaVal');
  const emitLambda = document.getElementById('emitLambda');
  const emitLambdaVal = document.getElementById('emitLambdaVal');
  const emitColor = document.getElementById('emitColor');
  const obsColor = document.getElementById('obsColor');
  const startLight = document.getElementById('startLight');
  const stopLight = document.getElementById('stopLight');

  function resize(){ canvas.width = Math.min(1000, window.innerWidth - 40); canvas.height = 280; }
  window.addEventListener('resize', resize); resize();

  function setLabels(){ betaVal.textContent = Number(betaControl.value).toFixed(2); emitLambdaVal.textContent = emitLambda.value; }
  [betaControl, emitLambda].forEach(i => i.addEventListener('input', setLabels));
  setLabels();

  function observedLambda(lambda_nm, beta){
    if(beta <= -0.999) beta = -0.999; if(beta >= 0.999) beta = 0.999;
    const factor = Math.sqrt((1 - beta)/(1 + beta));
    return lambda_nm * factor;
  }

  function wavelengthToRGB(wl){
    let R=0,G=0,B=0;
    if(wl >= 380 && wl < 440){ R = -(wl - 440)/(440-380); G=0; B=1; }
    else if(wl >= 440 && wl < 490){ R=0; G=(wl-440)/(490-440); B=1; }
    else if(wl >= 490 && wl < 510){ R=0; G=1; B=-(wl-510)/(510-490); }
    else if(wl >= 510 && wl < 580){ R=(wl-510)/(580-510); G=1; B=0; }
    else if(wl >= 580 && wl < 645){ R=1; G=-(wl-645)/(645-580); B=0; }
    else if(wl >= 645 && wl <= 780){ R=1; G=0; B=0; }
    let factor = 1;
    if(wl < 380 || wl > 780) factor = 0;
    else if(wl < 420) factor = 0.3 + 0.7*(wl-380)/(420-380);
    else if(wl > 700) factor = 0.3 + 0.7*(780-wl)/(780-700);
    R = Math.pow(R*factor, 0.8)*255; G = Math.pow(G*factor, 0.8)*255; B = Math.pow(B*factor, 0.8)*255;
    return { r: Math.round(R), g: Math.round(G), b: Math.round(B) };
  }

  let anim = false;
  let last = 0;
  let phase = 0;

  function draw(t){
    if(!last) last = t;
    const dt = (t - last)/1000; last = t;
    const beta = Number(betaControl.value);
    const emitL = Number(emitLambda.value);
    const obsL = observedLambda(emitL, beta);

    const eRgb = wavelengthToRGB(emitL);
    const oRgb = wavelengthToRGB(obsL);
    emitColor.style.background = `rgb(${eRgb.r},${eRgb.g},${eRgb.b})`;
    obsColor.style.background = `rgb(${oRgb.r},${oRgb.g},${oRgb.b})`;

    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = '#fff'; ctx.fillRect(0,0,canvas.width,canvas.height);

    const cx = canvas.width/2; const cy = canvas.height/2;
    const factor = Math.sqrt((1 - beta)/(1 + beta));
    const baseWavelengthPx = 28;
    const wavelength = baseWavelengthPx * factor;
    phase += dt * 120;

    const lines = 8;
    for(let L = 0; L < lines; L++){
      const offsetY = (L - (lines/2)) * 10;
      ctx.beginPath();
      const amp = 12;
      for(let x = -50; x <= canvas.width + 50; x += 2){
        const t = (x / wavelength) + (phase/ wavelength * 0.05);
        const y = cy + offsetY + Math.sin(t * Math.PI * 2) * amp * (1 - Math.abs(L - lines/2)/lines);
        if(x === -50) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      const grad = ctx.createLinearGradient(0,cy, canvas.width, cy);
      grad.addColorStop(0, `rgba(${eRgb.r},${eRgb.g},${eRgb.b},0.95)`);
      grad.addColorStop(1, `rgba(${oRgb.r},${oRgb.g},${oRgb.b},0.95)`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 3 - (L*0.25);
      ctx.stroke();
    }

    ctx.beginPath(); ctx.arc(cx-160, cy, 20, 0, Math.PI*2); ctx.fillStyle = `rgb(${eRgb.r},${eRgb.g},${eRgb.b})`; ctx.fill();
    ctx.beginPath(); ctx.arc(cx+160, cy, 20, 0, Math.PI*2); ctx.fillStyle = `rgb(${oRgb.r},${oRgb.g},${oRgb.b})`; ctx.fill();

    ctx.fillStyle = '#222'; ctx.font = '13px system-ui';
    ctx.fillText(`β = ${beta.toFixed(3)}`, 12, 18);
    ctx.fillText(`Emitted λ = ${emitL.toFixed(1)} nm`, 12, 36);
    ctx.fillText(`Observed λ ≈ ${obsL.toFixed(2)} nm`, 12, 54);

    if(anim) requestAnimationFrame(draw);
  }

  startLight.addEventListener('click', ()=>{
    if(anim) return;
    anim = true; last = 0;
    requestAnimationFrame(draw);
  });
  stopLight.addEventListener('click', ()=> anim = false);

  requestAnimationFrame((t)=>{ last = t; draw(t); anim = false; });
}
