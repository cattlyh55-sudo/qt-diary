(function () {
  const $ = id => document.getElementById(id);
  const KEY_ENTRIES = 'qt.entries', KEY_PROFILE = 'qt.profile', KEY_CURRENT = 'qt.current';
  const FIELDS = ['group', 'name', 'date', 'passage', 'title', 'summary', 'meditation', 'application', 'prayer'];
  const CONTENT_FIELDS = ['passage', 'title', 'summary', 'meditation', 'application', 'prayer'];

  // ---------- 저장소 ----------
  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
  }
  function store(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
  }

  let entries = load(KEY_ENTRIES, []);
  let profile = Object.assign({ group: '', name: '', weekStart: 1 }, load(KEY_PROFILE, {}));
  let current = null;

  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

  // ---------- 날짜 ----------
  const pad = n => String(n).padStart(2, '0');
  const isoOf = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseIso = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const today = () => isoOf(new Date());
  const WD = ['일', '월', '화', '수', '목', '금', '토'];
  function weekStartOf(iso) {
    const d = parseIso(iso);
    const diff = (d.getDay() - profile.weekStart + 7) % 7;
    d.setDate(d.getDate() - diff);
    return isoOf(d);
  }
  function addDays(iso, n) { const d = parseIso(iso); d.setDate(d.getDate() + n); return isoOf(d); }
  const short = iso => { const d = parseIso(iso); return `${d.getMonth() + 1}/${d.getDate()} (${WD[d.getDay()]})`; };

  // ---------- 작성 ----------
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const hasContent = e => CONTENT_FIELDS.some(f => (e[f] || '').trim());

  function newDraft(date) {
    return { id: uid(), group: profile.group, name: profile.name, date: date || today(),
      passage: '', title: '', summary: '', meditation: '', application: '', prayer: '' };
  }

  function openEntry(e) {
    current = e;
    FIELDS.forEach(f => { $('f-' + f).value = e[f] || ''; });
    document.querySelectorAll('textarea').forEach(autosize);
    store(KEY_CURRENT, e.id);
    setStatus(entries.includes(e) ? '' : '새 큐티');
  }

  let saveTimer = null;
  function onEdit(ev) {
    const f = ev.target.id.slice(2);
    current[f] = ev.target.value;
    if (f === 'group' || f === 'name') {
      profile[f] = ev.target.value;
      store(KEY_PROFILE, profile);
      $('s-' + f).value = ev.target.value;
    }
    if (ev.target.tagName === 'TEXTAREA') autosize(ev.target);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrent, 400);
  }

  function saveCurrent() {
    if (!current) return;
    if (!entries.includes(current)) {
      if (!hasContent(current)) return;
      entries.push(current);
    }
    current.updatedAt = Date.now();
    const ok = store(KEY_ENTRIES, entries);
    const t = new Date();
    setStatus(ok ? `자동 저장됨 ${pad(t.getHours())}:${pad(t.getMinutes())}` : '저장 실패: 브라우저 저장공간을 확인해 주세요');
  }

  function setStatus(s) { $('save-status').textContent = s; }

  function autosize(t) {
    t.style.height = 'auto';
    t.style.height = t.scrollHeight + 2 + 'px';
  }

  FIELDS.forEach(f => $('f-' + f).addEventListener('input', onEdit));
  window.addEventListener('pagehide', saveCurrent);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(); });

  $('btn-new').addEventListener('click', () => {
    saveCurrent();
    const t = today();
    const existing = entries.find(e => e.date === t && e !== current);
    if (existing && confirm('오늘 날짜로 쓴 큐티가 이미 있어요. 그걸 열까요?\n(취소를 누르면 새로 씁니다)')) return openEntry(existing);
    openEntry(newDraft());
  });

  $('btn-export').addEventListener('click', () => {
    saveCurrent();
    if (!hasContent(current)) return alert('내용을 먼저 작성해 주세요.');
    openExport([current], `${current.date}`);
  });

  // ---------- 탭 ----------
  function showTab(name) {
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.tab').forEach(s => { s.hidden = s.id !== 'tab-' + name; });
    if (name === 'list') renderList();
    if (name === 'write') document.querySelectorAll('textarea').forEach(autosize);
    window.scrollTo(0, 0);
  }
  document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => { saveCurrent(); showTab(b.dataset.tab); }));

  // ---------- 모아보기 ----------
  function renderList() {
    const box = $('week-list');
    box.innerHTML = '';
    const sorted = entries.filter(hasContent).sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0));
    $('list-empty').hidden = sorted.length > 0;
    const weeks = new Map();
    sorted.forEach(e => {
      const k = weekStartOf(e.date);
      if (!weeks.has(k)) weeks.set(k, []);
      weeks.get(k).push(e);
    });
    for (const [start, list] of weeks) {
      const end = addDays(start, 6);
      const card = document.createElement('div');
      card.className = 'card week';
      const head = document.createElement('div');
      head.className = 'week-head';
      head.innerHTML = `<div><strong>${short(start)} ~ ${short(end)}</strong><span class="count">${list.length}개</span></div>`;
      const btn = document.createElement('button');
      btn.className = 'primary small';
      btn.textContent = '이 주 내보내기';
      btn.addEventListener('click', () => {
        openExport([...list].sort((a, b) => a.date.localeCompare(b.date)), `${start}~${end}`);
      });
      head.appendChild(btn);
      card.appendChild(head);

      list.forEach(e => {
        const row = document.createElement('div');
        row.className = 'entry-row';
        const main = document.createElement('button');
        main.className = 'entry-main';
        const title = e.title || e.passage || '(제목 없음)';
        main.innerHTML = `<span class="d"></span><span class="t"></span>`;
        main.querySelector('.d').textContent = short(e.date);
        main.querySelector('.t').textContent = title;
        main.addEventListener('click', () => { openEntry(e); showTab('write'); });
        const del = document.createElement('button');
        del.className = 'icon';
        del.setAttribute('aria-label', '삭제');
        del.textContent = '✕';
        del.addEventListener('click', () => {
          if (!confirm(`${short(e.date)} 큐티를 삭제할까요?`)) return;
          entries = entries.filter(x => x !== e);
          store(KEY_ENTRIES, entries);
          if (current === e) openEntry(newDraft());
          renderList();
        });
        row.append(main, del);
        card.appendChild(row);
      });
      box.appendChild(card);
    }
  }

  // ---------- 내보내기 ----------
  const canShareFiles = (() => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] })); }
    catch { return false; }
  })();
  if (!canShareFiles) document.querySelectorAll('.share-btn').forEach(b => b.hidden = true);

  const safe = s => String(s || '').replace(/[\\/:*?"<>|\s]+/g, '').slice(0, 30);
  function baseName(e) {
    return ['큐티일기', e.group && `${safe(e.group)}조`, safe(e.name)].filter(Boolean).join('_');
  }

  let prepared = null; // { pdf: File, png: File[] }

  async function openExport(list, rangeLabel) {
    prepared = null;
    $('modal').hidden = false;
    document.body.classList.add('noscroll');
    $('modal-title').textContent = list.length > 1 ? `주간 묶음 · ${list.length}개` : '미리보기';
    $('preview').innerHTML = '<p class="hint">만드는 중…</p>';
    $('export-buttons').classList.add('disabled');
    $('modal-status').textContent = '';

    try {
      const rendered = await QTRender.renderMany(list);
      $('preview').innerHTML = '';
      rendered.forEach(r => r.pages.forEach(c => { c.className = 'page'; $('preview').appendChild(c); }));

      const base = baseName(list[0]);
      const pngs = [];
      for (const r of rendered) {
        for (let i = 0; i < r.pages.length; i++) {
          const blob = await QTRender.canvasToBlob(r.pages[i], 'image/png');
          const suffix = r.pages.length > 1 ? `_${i + 1}` : '';
          pngs.push(new File([blob], `${baseName(r.entry)}_${r.entry.date}${suffix}.png`, { type: 'image/png' }));
        }
      }
      const pdfBlob = await QTRender.buildPdf(rendered);
      const pdf = new File([pdfBlob], `${base}_${rangeLabel}.pdf`, { type: 'application/pdf' });
      prepared = { pdf, png: pngs };
      $('export-buttons').classList.remove('disabled');
    } catch (err) {
      console.error(err);
      $('preview').innerHTML = '<p class="hint">미리보기를 만들지 못했어요. 다시 시도해 주세요.</p>';
    }
  }

  function closeModal() {
    $('modal').hidden = true;
    document.body.classList.remove('noscroll');
    $('preview').innerHTML = '';
    prepared = null;
  }
  $('modal-close').addEventListener('click', closeModal);
  $('modal').addEventListener('click', ev => { if (ev.target === $('modal')) closeModal(); });

  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  document.querySelectorAll('#export-buttons button').forEach(b => b.addEventListener('click', async () => {
    if (!prepared) return;
    const files = b.dataset.kind === 'pdf' ? [prepared.pdf] : prepared.png;
    if (b.dataset.act === 'share') {
      try {
        await navigator.share({ files, title: files[0].name });
      } catch (err) {
        if (err.name !== 'AbortError') $('modal-status').textContent = '공유에 실패했어요. "저장"을 이용해 주세요.';
      }
    } else {
      files.forEach((f, i) => setTimeout(() => download(f), i * 400));
      $('modal-status').textContent = `${files.length}개 파일을 저장했어요.`;
    }
  }));

  // ---------- 설정 ----------
  $('s-group').value = profile.group;
  $('s-name').value = profile.name;
  $('s-weekstart').value = String(profile.weekStart);
  ['group', 'name'].forEach(f => $('s-' + f).addEventListener('input', ev => {
    profile[f] = ev.target.value;
    store(KEY_PROFILE, profile);
    // 아직 저장 전인 새 글에는 바로 반영
    if (current && !entries.includes(current)) { current[f] = ev.target.value; $('f-' + f).value = ev.target.value; }
  }));
  $('s-weekstart').addEventListener('change', ev => { profile.weekStart = Number(ev.target.value); store(KEY_PROFILE, profile); });

  $('btn-backup').addEventListener('click', () => {
    saveCurrent();
    const data = JSON.stringify({ app: 'qt-diary', version: 1, profile, entries }, null, 1);
    download(new File([data], `큐티일기_백업_${today()}.json`, { type: 'application/json' }));
  });
  $('btn-restore').addEventListener('click', () => $('restore-file').click());
  $('restore-file').addEventListener('change', async ev => {
    const file = ev.target.files[0];
    ev.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (data.app !== 'qt-diary' || !Array.isArray(data.entries)) throw new Error('형식 오류');
      const byId = new Map(entries.map(e => [e.id, e]));
      let added = 0;
      for (const e of data.entries) {
        const mine = byId.get(e.id);
        if (!mine) { entries.push(e); added++; }
        else if ((e.updatedAt || 0) > (mine.updatedAt || 0)) Object.assign(mine, e);
      }
      store(KEY_ENTRIES, entries);
      alert(`불러오기 완료: 새 큐티 ${added}개`);
    } catch {
      alert('백업 파일을 읽지 못했어요.');
    }
  });

  // ---------- 시작 ----------
  const lastId = load(KEY_CURRENT, null);
  const t = today();
  const start = entries.find(e => e.id === lastId && e.date === t) || entries.find(e => e.date === t) || newDraft();
  openEntry(start);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
