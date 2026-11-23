// Лайтли: чат, кнопка «Спросить Лайтли» в логе, подбор настроек и подсказки при загрузке.
(() => {
  const $ = (id) => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';

  /* ---- пиксельный образ Лайтли ---- */
  const MAP = [
    '...pp......pp...', 'y.pppp....pppp.y', '..pppppppppppp..', '.ppqqpppppppppp.',
    '.pppssssssssppp.', '.pssssssssssssp.', '.psswessssswesp.', '.psseessssseesp.',
    '.psbssssssssbsp.', '.psssssmmsssssp.', '..pssssssssssp..', '...pssssssssp...',
    '....dddddddd....', '...dddddddddd...', '..dddddyyddddd..', '..dddddddddddd..'
  ];
  const PAL = { p: '#ff7ab8', q: '#ffc2e0', s: '#ffe3d2', e: '#3a2a6a', w: '#ffffff', b: '#ff9ec4', m: '#c2456e', d: '#7b6bd6', y: '#ffd84d' };
  const sprite = (svg) => {
    svg.setAttribute('viewBox', '0 0 16 16'); svg.setAttribute('shape-rendering', 'crispEdges');
    MAP.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === '.') return;
      const r = document.createElementNS(NS, 'rect');
      r.setAttribute('x', x); r.setAttribute('y', y); r.setAttribute('width', 1); r.setAttribute('height', 1); r.setAttribute('fill', PAL[ch]);
      svg.appendChild(r);
    }));
    return svg;
  };
  sprite($('mascot'));

  /* ---- чат ---- */
  const chat = $('chat'), input = $('ai-in'), sendBtn = $('ai-send');
  const hist = [];
  let waiting = false, lastSend = 0;
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const showTab = (v) => document.querySelector(`.tabs [data-view="${v}"]`).click();

  const ERR = {
    not_configured: 'Я пока не подключена к серверу ответов. Загляни в Discord, там помогут ✨',
    limit: 'Ой, мы слишком много болтаем! Давай продолжим чуть позже — минут через десять.',
    timeout: 'Я задумалась и не успела ответить. Попробуй спросить ещё раз.',
    network: 'Не получается связаться с сервером. Проверь интернет и VPN или спроси в Discord.',
    server: 'У меня что-то пошло не так. Попробуй позже или спроси в Discord.'
  };

  const ACTIONS = {
    repair: ['Починить клиент', async () => {
      if (!confirm('Удалить скачанную Java и файлы игры (библиотеки, версии)? Они скачаются заново при запуске. Миры и настройки игры не затрагиваются.')) return;
      const r = await api.repair();
      add('ai', r.ok ? 'Готово! Теперь нажми «Играть» — всё скачается заново.' : 'Сначала закрой игру, потом повторим.');
    }],
    settings: ['Открыть настройки', () => showTab('set')],
    discord: ['Открыть Discord', () => window.open('https://discord.gg/mNmaKxPdGQ', '_blank')]
  };

  function add(role, text, actions = [], cls = '') {
    const row = el('div', 'msg ' + (role === 'me' ? 'me' : 'ai'));
    if (role !== 'me') { const av = document.createElementNS(NS, 'svg'); av.setAttribute('class', 'av'); row.append(sprite(av)); }
    const bub = el('div', 'bub ' + cls, text);
    if (actions.length) {
      const box = el('div', 'acts');
      actions.forEach((a) => { const b = el('button', null, ACTIONS[a][0]); b.onclick = ACTIONS[a][1]; box.append(b); });
      bub.append(box);
    }
    row.append(bub); chat.append(row); chat.scrollTop = chat.scrollHeight;
    return row;
  }

  async function ask(text, { withLog = false } = {}) {
    text = String(text || '').trim().slice(0, 500);
    if (!text || waiting) return;
    if (Date.now() - lastSend < 1200) return;
    lastSend = Date.now();
    add('me', text); hist.push({ role: 'user', content: text });
    waiting = true; sendBtn.disabled = true;
    const typing = add('ai', 'Лайтли печатает…', [], 'typing');
    const r = await api.lightleeAsk({ messages: hist.slice(-8), withLog });
    typing.remove();
    if (r.ok) {
      const acts = [...r.reply.matchAll(/\[\[(repair|settings|discord)\]\]/g)].map((m) => m[1]);
      const clean = r.reply.replace(/\[\[[a-z]+\]\]/g, '').trim();
      hist.push({ role: 'assistant', content: clean });
      add('ai', clean, [...new Set(acts)].slice(0, 1));
    } else add('ai', ERR[r.error] || ERR.server);
    waiting = false; sendBtn.disabled = false; input.focus();
  }

  sendBtn.onclick = () => { const t = input.value; input.value = ''; ask(t); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); sendBtn.click(); } });
  $('chips').querySelectorAll('button').forEach((b) => { b.onclick = () => ask(b.textContent); });
  add('ai', 'Привет! Я Лайтли ✨ Расскажу про правила сервера, помогу зайти и разобраться с ошибками. Спрашивай!');

  /* ---- «Спросить Лайтли» из лога ---- */
  $('log-ask').onclick = () => {
    if (!confirm('Отправить Лайтли последние строки лога для разбора? Токены, имя пользователя Windows, почта и IP-адреса из них вырезаются.')) return;
    showTab('ai');
    ask('Игра не запускается или вылетает. Посмотри лог и подскажи, что делать.', { withLog: true });
  };

  /* ---- подбор настроек ---- */
  $('ai-tune').onclick = async () => {
    const s = await api.sysinfo();
    let ram = s.totalGb >= 16 ? 6 : s.totalGb >= 12 ? 5 : s.totalGb >= 8 ? 4 : s.totalGb >= 6 ? 3 : 2;
    ram = Math.max(2, Math.min(ram, Math.floor(s.totalGb / 2)));
    const optimize = s.totalGb <= 8 || s.cpus <= 4;
    showTab('ai');
    const bub = add('ai', `Смотрю на твой компьютер: ${s.totalGb} ГБ памяти (свободно ${s.freeGb} ГБ), ${s.cpus} потоков. Советую выделить ${ram} ГБ${optimize ? ' и держать оптимизацию включённой — так будет больше FPS' : ''}. Применить?`);
    const box = el('div', 'acts'), yes = el('button', null, 'Применить');
    yes.onclick = () => {
      const r = $('ram'); r.value = ram;
      r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change'));
      if (optimize && $('opt').getAttribute('aria-checked') !== 'true') $('opt').click();
      yes.disabled = true; yes.textContent = 'Готово ✓';
    };
    box.append(yes); bub.querySelector('.bub').append(box);
  };

  /* ---- подсказки при загрузке ---- */
  const TIPS = [
    'Лайтли: первый запуск самый долгий, потом всё будет быстро ✨',
    'Лайтли: под игру хватит 3–4 ГБ, больше половины памяти компьютера лучше не отдавать.',
    'Лайтли: если игра вылетела, загляни во вкладку «Лог» и нажми «Спросить Лайтли».',
    'Лайтли: правила сервера можно узнать у меня во вкладке «Лайтли».',
    'Лайтли: свой скин загружается во вкладке «Скин» — не забудь выбрать тип рук.',
    'Лайтли: если качается слишком долго, попробуй выключить VPN.'
  ];
  let timer, ti = 0;
  api.onState((st) => {
    clearInterval(timer);
    if (st === 'busy') { const t = () => { $('tip').textContent = TIPS[ti++ % TIPS.length]; }; t(); timer = setInterval(t, 6000); }
    else $('tip').textContent = '';
  });
  api.onError(() => { $('tip').textContent = ''; });
})();
