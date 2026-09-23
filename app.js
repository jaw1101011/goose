(() => {
  'use strict';

  const layer = document.getElementById('duckLayer');
  const workspace = document.getElementById('workspace');
  const controlPanel = document.getElementById('controlPanel');
  const panelToggle = document.getElementById('panelToggle');
  const petCountEl = document.getElementById('petCount');
  const snackCountEl = document.getElementById('snackCount');
  const noteCountEl = document.getElementById('noteCount');
  const modeSelect = document.getElementById('modeSelect');
  const speedRange = document.getElementById('speedRange');
  const talkToggle = document.getElementById('talkToggle');
  const starToggle = document.getElementById('starToggle');
  const statusDot = document.getElementById('statusDot');
  const compatText = document.getElementById('compatText');
  const installBtn = document.getElementById('installBtn');
  let deferredInstallPrompt = null;

  const SVG = `
  <svg class="duck-svg" viewBox="0 0 220 180" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <ellipse cx="114" cy="158" rx="54" ry="8" fill="#000" opacity=".16"/>
    <g class="legs" stroke="#df8937" stroke-width="5.5" stroke-linecap="round">
      <path d="M103 129 L101 151"/><path d="M136 129 L138 151"/>
    </g>
    <ellipse cx="92" cy="151" rx="18" ry="7" fill="#ffa845"/>
    <ellipse cx="135" cy="151" rx="18" ry="7" fill="#ffa845"/>
    <ellipse cx="64" cy="112" rx="19" ry="18" fill="#fbfcff" stroke="#a3b7cf" stroke-width="2"/>
    <ellipse cx="111" cy="112" rx="61" ry="38" fill="#fbfcff" stroke="#a3b7cf" stroke-width="2.3"/>
    <ellipse cx="146" cy="89" rx="24" ry="41" fill="#fbfcff" stroke="#a3b7cf" stroke-width="2.2"/>
    <ellipse cx="151" cy="67" rx="31" ry="28" fill="#fbfcff" stroke="#a3b7cf" stroke-width="2.2"/>
    <ellipse cx="93" cy="117" rx="31" ry="16" fill="#e4ecf9" stroke="#b2c7e0" stroke-width="1.5"/>
    <ellipse cx="152" cy="114" rx="23" ry="7" fill="#5198da"/>
    <rect x="54" y="119" width="23" height="27" rx="9" fill="#5198da" stroke="#2f66a0" stroke-width="2"/>
    <ellipse cx="65.5" cy="132" rx="7" ry="6" fill="#a7d9ff"/>
    <path d="M170 76 L205 82 L174 96 L165 88 Z" fill="#ffbe5b" stroke="#df8b44" stroke-width="1.8"/>
    <ellipse cx="168" cy="91" rx="8" ry="4" fill="#ffccd3"/>
    <ellipse cx="160" cy="69" rx="3.8" ry="5.5" fill="#2a3956"/>
    <circle cx="161" cy="68" r="1.4" fill="#fff"/>
    <path d="M148 41 L148 27" stroke="#5ba6db" stroke-width="3" stroke-linecap="round"/>
    <path d="M148 15 L152 24 L162 24 L154 30 L157 40 L148 34 L139 40 L142 30 L134 24 L144 24 Z" fill="#ffcc54" stroke="#eeb245" stroke-width="1.5"/>
    <path d="M124 48 Q148 30 176 51" fill="none" stroke="#7cc0ea" stroke-width="3" opacity=".65"/>
  </svg>`;

  const state = Object.assign({
    mode: 'roam', speed: 1, talk: true, stars: true, paused: false,
    pets: 0, snacks: 0, notes: 0
  }, JSON.parse(localStorage.getItem('starduck-state') || '{}'));

  const duck = document.createElement('div');
  duck.className = 'duck-buddy';
  duck.innerHTML = SVG;
  layer.appendChild(duck);

  let x = 40, y = Math.max(40, innerHeight - 210), tx = x, ty = y, vx = 0, vy = 0;
  let targetAt = 0, nextTalk = performance.now() + 12000, lastTrail = 0;
  let mouseX = innerWidth / 2, mouseY = innerHeight / 2;
  let bubbleTimer = null, collectStar = null, starTimer = null;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const save = () => localStorage.setItem('starduck-state', JSON.stringify(state));
  const bounds = () => ({w: duck.offsetWidth || 178, h: duck.offsetHeight || 154});

  function refreshUI() {
    petCountEl.textContent = state.pets;
    snackCountEl.textContent = state.snacks;
    noteCountEl.textContent = state.notes;
    modeSelect.value = state.mode;
    speedRange.value = state.speed;
    talkToggle.checked = state.talk;
    starToggle.checked = state.stars;
    statusDot.style.background = state.paused ? '#ffcd72' : '#7effaa';
    statusDot.style.boxShadow = state.paused ? '0 0 16px #ffcd72' : '0 0 16px #7effaa';
    const pauseBtn = document.querySelector('[data-action="pause"]');
    if (pauseBtn) pauseBtn.textContent = state.paused ? '▶ 다시 산책' : 'Ⅱ 잠깐 쉬기';
  }

  function bubble(text, note = false, ms = 2800) {
    duck.querySelector('.bubble')?.remove();
    const el = document.createElement('div');
    el.className = 'bubble' + (note ? ' note' : '');
    el.textContent = text;
    duck.appendChild(el);
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => el.remove(), ms);
  }

  function chooseTarget() {
    const {w, h} = bounds();
    const pad = 12;
    tx = pad + Math.random() * Math.max(0, innerWidth - w - pad * 2);
    const maxY = Math.max(pad, innerHeight - h - pad);
    ty = Math.random() < .68
      ? clamp(maxY - Math.random() * Math.min(220, maxY), pad, maxY)
      : pad + Math.random() * Math.max(0, maxY - pad);
    targetAt = performance.now() + 4500 + Math.random() * 5000;
  }

  function note(prank = true) {
    const texts = [
      '업무 방해 담당: 나', '지금 오리 보셨죠?', '할 일: 오리 무시하기', '잠깐, 귀여움 검사!',
      '오늘도 별처럼 빛나', '주의: 꽥 주의보', '이 화면은 내 거야!', '수상한 오리 출몰 중',
      '집중력 97%… 오리 3%', '이 쪽지는 스스로 나타났습니다'
    ];
    const text = texts[Math.floor(Math.random() * texts.length)];
    bubble(text, true, 3800);
    if (prank) {
      const p = document.createElement('div');
      p.className = 'postit';
      p.style.left = clamp(x + 45, 10, innerWidth - 170) + 'px';
      p.style.top = clamp(y + 40, 10, innerHeight - 110) + 'px';
      p.style.setProperty('--rot', `${-5 + Math.random() * 10}deg`);
      p.innerHTML = `<button title="쪽지 치우기">×</button>${text}`;
      p.querySelector('button').addEventListener('click', () => p.remove());
      workspace.appendChild(p);
      setTimeout(() => p.remove(), 18000);
      state.notes += 1; save(); refreshUI();
    }
  }

  function pet() {
    state.pets += 1; save(); refreshUI();
    const lines = ['꽥! 한 번 더!', '쓰다듬기 +1 ♡', '나 오늘 귀엽지?', '좋아, 친해졌어!'];
    bubble(lines[Math.floor(Math.random() * lines.length)]);
    duck.animate([{transform:'scale(.96) rotate(-2deg)'},{transform:'scale(1.05) rotate(2deg)'},{transform:'scale(1)'}], {duration:380});
  }

  function snack() {
    state.snacks += 1; save(); refreshUI();
    const lines = ['별사탕 냠냠!', '이거 어디서 샀어?', '간식은 언제나 옳아', '반짝반짝 맛있다!'];
    bubble(lines[Math.floor(Math.random() * lines.length)]);
    for (let i=0;i<7;i++) setTimeout(() => spawnTrail(x + 100, y + 70, true), i * 55);
  }

  function spawnTrail(px, py, gold = false) {
    const s = document.createElement('div'); s.className = 'trail-star';
    s.style.left = `${px + (Math.random() - .5) * 30}px`; s.style.top = `${py + (Math.random() - .5) * 25}px`;
    if (gold) s.style.background = '#ffd86b';
    layer.appendChild(s); setTimeout(() => s.remove(), 900);
  }

  function spawnCollectStar() {
    collectStar?.remove();
    if (!state.stars) return;
    const s = document.createElement('div'); s.className = 'collect-star';
    s.style.left = `${24 + Math.random() * Math.max(10, innerWidth - 70)}px`;
    s.style.top = `${80 + Math.random() * Math.max(10, innerHeight - 180)}px`;
    layer.appendChild(s); collectStar = s;
    starTimer = setTimeout(spawnCollectStar, 12000 + Math.random() * 12000);
  }

  function checkStar() {
    if (!collectStar) return;
    const sx = parseFloat(collectStar.style.left), sy = parseFloat(collectStar.style.top);
    if (Math.hypot((x+90)-sx, (y+75)-sy) < 65) {
      collectStar.remove(); collectStar = null;
      state.snacks += 1; save(); refreshUI();
      bubble('별 조각 획득! ★');
      setTimeout(spawnCollectStar, 5000 + Math.random() * 7000);
    }
  }

  function setMode(mode) {
    state.mode = mode; state.paused = false; save(); refreshUI();
    if (mode === 'roam') { bubble('자유 산책 출발!'); chooseTarget(); }
    if (mode === 'follow') bubble('따라갈게! 꽥꽥');
    if (mode === 'focus') bubble('집중! 조용히 있을게');
  }

  function tick(now) {
    const {w, h} = bounds();
    if (!state.paused) {
      if (state.mode === 'follow') {
        tx = clamp(mouseX + 55, 6, innerWidth - w - 6);
        ty = clamp(mouseY + 42, 6, innerHeight - h - 6);
      } else if (state.mode === 'focus') {
        tx = Math.max(6, innerWidth - w - 18); ty = Math.max(6, innerHeight - h - 18);
      } else if (now > targetAt || Math.hypot(tx-x, ty-y) < 7) chooseTarget();

      if (state.stars && collectStar && state.mode === 'roam' && Math.random() < .007) {
        tx = clamp(parseFloat(collectStar.style.left)-60, 6, innerWidth-w-6);
        ty = clamp(parseFloat(collectStar.style.top)-45, 6, innerHeight-h-6);
      }

      const dx = tx - x, dy = ty - y, d = Math.hypot(dx,dy);
      const maxSpeed = (state.mode === 'follow' ? 7.1 : state.mode === 'focus' ? 5.4 : 3.9) * Number(state.speed || 1);
      const desiredX = d > .1 ? dx / d * Math.min(maxSpeed, d * .09) : 0;
      const desiredY = d > .1 ? dy / d * Math.min(maxSpeed, d * .09) : 0;
      vx = vx * .82 + desiredX * .18; vy = vy * .82 + desiredY * .18;
      x = clamp(x + vx, 0, Math.max(0, innerWidth - w)); y = clamp(y + vy, 0, Math.max(0, innerHeight - h));
      duck.classList.toggle('walking', Math.abs(vx)+Math.abs(vy) > .8);
      duck.classList.toggle('flip', vx < -.22);
      duck.style.transform = `translate3d(${x}px,${y}px,0)`;
      if (Math.abs(vx)+Math.abs(vy) > 1.4 && now-lastTrail > 260) { spawnTrail(x + (vx>0?40:145), y+120); lastTrail = now; }
      checkStar();
      if (state.talk && state.mode === 'roam' && now > nextTalk) { note(false); nextTalk = now + 24000 + Math.random()*28000; }
    }
    requestAnimationFrame(tick);
  }

  window.addEventListener('pointermove', e => { mouseX = e.clientX; mouseY = e.clientY; }, {passive:true});
  window.addEventListener('resize', () => { const {w,h}=bounds(); x=clamp(x,0,innerWidth-w); y=clamp(y,0,innerHeight-h); });
  duck.addEventListener('click', pet);

  document.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', () => {
    const a = btn.dataset.action;
    if (a === 'pet') pet();
    if (a === 'snack') snack();
    if (a === 'note') note(true);
    if (a === 'pause') { state.paused = !state.paused; save(); refreshUI(); bubble(state.paused ? 'zzz... 잠깐 쉬는 중' : '다시 출발!'); }
  }));
  modeSelect.addEventListener('change', e => setMode(e.target.value));
  speedRange.addEventListener('input', e => { state.speed = Number(e.target.value); save(); });
  talkToggle.addEventListener('change', e => { state.talk = e.target.checked; save(); });
  starToggle.addEventListener('change', e => { state.stars = e.target.checked; save(); if (state.stars) spawnCollectStar(); else collectStar?.remove(); });

  panelToggle.addEventListener('click', () => {
    const hidden = controlPanel.classList.toggle('collapsed');
    panelToggle.setAttribute('aria-expanded', String(!hidden));
    panelToggle.textContent = hidden ? '★' : '☰';
  });
  document.getElementById('fullscreenBtn').addEventListener('click', async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.(); else await document.exitFullscreen?.();
  });

  function floatingMarkup(doc) {
    doc.head.innerHTML = `<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
      html,body{margin:0;width:100%;height:100%;overflow:hidden;background:linear-gradient(145deg,#0d1731,#09101f);font-family:system-ui,sans-serif;color:white}
      body{position:relative}.hint{position:absolute;left:12px;top:10px;color:#8da3c8;font-size:11px;letter-spacing:.08em}.duck{position:absolute;width:160px;height:132px;cursor:pointer;filter:drop-shadow(0 12px 12px #0005);user-select:none}.duck svg{width:100%;height:100%}.bubble{position:absolute;top:-26px;left:50%;transform:translateX(-50%);white-space:nowrap;background:#fff;color:#253651;padding:7px 10px;border-radius:12px;border:2px solid #8ec5ff;font-weight:800;font-size:12px}
    </style>`;
    doc.body.innerHTML = `<div class="hint">별덕이 · 클릭하면 쓰다듬기</div><div class="duck">${SVG}</div>`;
  }
  function startFloating(win) {
    const d = win.document.querySelector('.duck'); let fx=20, fy=70, ftx=100, fty=80, fvx=0, fvy=0, next=0;
    const say = t => { d.querySelector('.bubble')?.remove(); const b=win.document.createElement('div'); b.className='bubble'; b.textContent=t; d.appendChild(b); setTimeout(()=>b.remove(),1800); };
    d.addEventListener('click',()=>say('꽥 ♡'));
    const go = () => { const w=d.offsetWidth||160,h=d.offsetHeight||132; ftx=Math.random()*Math.max(1,win.innerWidth-w); fty=45+Math.random()*Math.max(1,win.innerHeight-h-45); next=performance.now()+3500+Math.random()*3500; };
    go();
    const frame = n => { const w=d.offsetWidth||160,h=d.offsetHeight||132; if(n>next||Math.hypot(ftx-fx,fty-fy)<5)go(); const dx=ftx-fx,dy=fty-fy,dist=Math.hypot(dx,dy); const sx=dist?dx/dist*Math.min(3.1,dist*.08):0, sy=dist?dy/dist*Math.min(3.1,dist*.08):0; fvx=fvx*.8+sx*.2;fvy=fvy*.8+sy*.2;fx=Math.max(0,Math.min(win.innerWidth-w,fx+fvx));fy=Math.max(0,Math.min(win.innerHeight-h,fy+fvy));d.style.transform=`translate(${fx}px,${fy}px) scaleX(${fvx<0?-1:1})`;win.requestAnimationFrame(frame); };
    win.requestAnimationFrame(frame);
  }
  document.getElementById('floatingBtn').addEventListener('click', async () => {
    try {
      if ('documentPictureInPicture' in window) {
        const pip = await documentPictureInPicture.requestWindow({width: 390, height: 280});
        floatingMarkup(pip.document); startFloating(pip);
      } else {
        const pop = window.open('', 'starduck-float', 'popup=yes,width=390,height=280');
        if (!pop) throw new Error('popup blocked');
        floatingMarkup(pop.document); startFloating(pop);
      }
    } catch (e) { bubble('작은 창을 열 수 없었어 :('); }
  });

  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstallPrompt = e; installBtn.classList.remove('hidden'); });
  installBtn.addEventListener('click', async () => { if (!deferredInstallPrompt) return; deferredInstallPrompt.prompt(); await deferredInstallPrompt.userChoice; deferredInstallPrompt = null; installBtn.classList.add('hidden'); });

  if ('documentPictureInPicture' in window) compatText.textContent = '학교 크롬북 모드 사용 가능: 버튼을 누르면 별덕이가 작은 항상-위 창에서 돌아다녀. 별도 확장 프로그램은 필요 없어.';
  else compatText.textContent = 'Picture-in-Picture가 막혀 있거나 지원되지 않으면 일반 작은 창으로 열려. 학교 정책이 팝업까지 막으면 현재 탭 안에서만 사용할 수 있어.';

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
  refreshUI(); chooseTarget(); if (state.stars) setTimeout(spawnCollectStar, 1800); requestAnimationFrame(tick);
})();
