(function () {
  const $ = id => document.getElementById(id);
  const KEY_ENTRIES = 'qt.entries', KEY_PROFILE = 'qt.profile', KEY_CURRENT = 'qt.current';
  const KEY_TRASH = 'qt.trash', KEY_BACKUP = 'qt.backup';
  const DAY = 24 * 60 * 60 * 1000;
  const TRASH_DAYS = 30, BACKUP_REMIND_DAYS = 14, SNOOZE_DAYS = 7;
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
  let profile = Object.assign({ group: '', name: '', weekStart: 1, retentionDays: 0 }, load(KEY_PROFILE, {}));
  let current = null;

  // 휴지통: 30일 지난 항목은 자동으로 비운다
  let trash = load(KEY_TRASH, []).filter(e => Date.now() - e.deletedAt < TRASH_DAYS * DAY);
  store(KEY_TRASH, trash);

  // 백업 기록: { at: 마지막 백업 시각, snoozeUntil: '나중에'를 누른 경우 다시 알릴 시각 }
  let backupInfo = Object.assign({ at: 0, snoozeUntil: 0 }, load(KEY_BACKUP, {}));

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
          if (!confirm(`${short(e.date)} 큐티를 휴지통으로 옮길까요?\n(30일 안에 복원할 수 있어요)`)) return;
          moveToTrash([e]);
          renderList();
        });
        row.append(main, del);
        card.appendChild(row);
      });
      box.appendChild(card);
    }
    renderTrash();
  }

  // ---------- 휴지통 ----------
  function moveToTrash(list) {
    const now = Date.now();
    list.forEach(e => { e.deletedAt = now; });
    entries = entries.filter(x => !list.includes(x));
    trash = trash.concat(list.filter(hasContent));
    store(KEY_ENTRIES, entries);
    store(KEY_TRASH, trash);
    if (list.includes(current)) openEntry(newDraft());
  }

  function renderTrash() {
    const box = $('trash-list');
    box.innerHTML = '';
    $('trash').hidden = trash.length === 0;
    $('trash-count').textContent = `${trash.length}개`;
    [...trash].sort((a, b) => b.deletedAt - a.deletedAt).forEach(e => {
      const row = document.createElement('div');
      row.className = 'entry-row';
      const info = document.createElement('div');
      info.className = 'entry-main';
      info.innerHTML = '<span class="d"></span><span class="t"></span>';
      const left = Math.max(1, Math.ceil((e.deletedAt + TRASH_DAYS * DAY - Date.now()) / DAY));
      info.querySelector('.d').textContent = `${short(e.date)} · ${left}일 후 삭제`;
      info.querySelector('.t').textContent = e.title || e.passage || '(제목 없음)';
      const restore = document.createElement('button');
      restore.className = 'ghost small';
      restore.textContent = '복원';
      restore.addEventListener('click', () => {
        trash = trash.filter(x => x !== e);
        delete e.deletedAt;
        entries.push(e);
        store(KEY_ENTRIES, entries);
        store(KEY_TRASH, trash);
        renderList();
      });
      const del = document.createElement('button');
      del.className = 'icon';
      del.setAttribute('aria-label', '영구 삭제');
      del.textContent = '✕';
      del.addEventListener('click', () => {
        if (!confirm(`${short(e.date)} 큐티를 영구 삭제할까요?\n되돌릴 수 없어요.`)) return;
        trash = trash.filter(x => x !== e);
        store(KEY_TRASH, trash);
        renderList();
      });
      row.append(info, restore, del);
      box.appendChild(row);
    });
  }

  // ---------- 보관 기간 ----------
  // 큐티 날짜와 마지막 수정이 모두 기간 밖이면 만료 (예전 날짜로 새로 쓴 글이 바로 지워지지 않도록)
  function isExpired(e, days) {
    if (!days) return false;
    const limit = Date.now() - days * DAY;
    return parseIso(e.date).getTime() < limit && (e.updatedAt || 0) < limit;
  }
  // 만료된 큐티는 휴지통을 거치지 않고 바로 지운다
  function purgeExpired() {
    const days = profile.retentionDays;
    entries = entries.filter(e => !isExpired(e, days));
    trash = trash.filter(e => !isExpired(e, days));
    store(KEY_ENTRIES, entries);
    store(KEY_TRASH, trash);
  }
  const retentionLabel = days => days ? `${days / 7}주` : '계속 보관';
  const retentionWithRo = days => days ? `${days / 7}주로` : '계속 보관으로';

  $('btn-empty-trash').addEventListener('click', () => {
    if (!confirm(`휴지통의 큐티 ${trash.length}개를 영구 삭제할까요?\n되돌릴 수 없어요.`)) return;
    trash = [];
    store(KEY_TRASH, trash);
    renderList();
  });

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

  $('s-retention').value = String(profile.retentionDays);
  $('s-retention').addEventListener('change', ev => {
    saveCurrent();
    const days = Number(ev.target.value);
    const n = entries.concat(trash).filter(e => isExpired(e, days)).length;
    if (n && !confirm(`보관 기간을 ${retentionWithRo(days)} 바꾸면 그보다 오래된 큐티 ${n}개가 지금 바로 영구 삭제돼요.\n계속할까요?`)) {
      ev.target.value = String(profile.retentionDays);
      return;
    }
    profile.retentionDays = days;
    store(KEY_PROFILE, profile);
    purgeExpired();
    if (current && !entries.includes(current) && current.updatedAt) openEntry(newDraft());
    updateBackupUI();
  });

  $('notice-ok').addEventListener('click', () => {
    store('qt.noticeSeen', true);
    $('notice').hidden = true;
  });

  function doBackup() {
    saveCurrent();
    const data = JSON.stringify({ app: 'qt-diary', version: 1, profile, entries, trash }, null, 1);
    download(new File([data], `큐티일기_백업_${today()}.json`, { type: 'application/json' }));
    backupInfo = { at: Date.now(), snoozeUntil: 0 };
    store(KEY_BACKUP, backupInfo);
    updateBackupUI();
  }
  $('btn-backup').addEventListener('click', doBackup);
  $('banner-backup').addEventListener('click', doBackup);
  $('banner-later').addEventListener('click', () => {
    backupInfo.snoozeUntil = Date.now() + SNOOZE_DAYS * DAY;
    store(KEY_BACKUP, backupInfo);
    updateBackupUI();
  });

  // 마지막 백업(없으면 첫 큐티) 이후 14일이 지났고, 그 뒤로 새로 쓰거나 고친 큐티가 있으면 알린다
  function updateBackupUI() {
    const fmt = t => { const d = new Date(t); return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`; };
    $('last-backup').textContent = backupInfo.at ? `마지막 백업: ${fmt(backupInfo.at)}` : '아직 백업한 적이 없어요.';

    const saved = entries.filter(e => e.updatedAt);
    const changed = saved.filter(e => e.updatedAt > backupInfo.at);
    const since = backupInfo.at || Math.min(...saved.map(e => e.updatedAt));
    const days = Math.floor((Date.now() - since) / DAY);
    const show = changed.length > 0 && days >= BACKUP_REMIND_DAYS && Date.now() > backupInfo.snoozeUntil;
    $('backup-banner').hidden = !show;
    if (show) {
      $('backup-banner-text').textContent = backupInfo.at
        ? `마지막 백업 후 ${days}일이 지났어요. 그 뒤로 쓴 큐티 ${changed.length}개를 백업해 둘까요?`
        : `큐티 ${changed.length}개가 이 기기에만 저장돼 있어요. 백업 파일을 한 번 저장해 둘까요?`;
    }
  }

  $('btn-delete-all').addEventListener('click', () => {
    saveCurrent();
    const n = entries.filter(hasContent).length;
    if (!n) return alert('삭제할 큐티가 없어요.');
    if (!confirm(`모든 큐티 ${n}개를 휴지통으로 옮길까요?\n30일 안에는 모아보기 > 휴지통에서 복원할 수 있어요.`)) return;
    moveToTrash([...entries]);
    updateBackupUI();
    alert(`${n}개를 휴지통으로 옮겼어요.`);
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
      // 백업의 휴지통은 목록·휴지통 어디에도 없는 것만 휴지통으로, 목록으로 돌아온 건 휴지통에서 뺀다
      const ids = new Set(entries.map(e => e.id));
      const trashIds = new Set(trash.map(e => e.id));
      (data.trash || []).forEach(e => { if (!ids.has(e.id) && !trashIds.has(e.id)) trash.push(e); });
      trash = trash.filter(e => !ids.has(e.id));
      store(KEY_ENTRIES, entries);
      store(KEY_TRASH, trash);
      updateBackupUI();
      alert(`불러오기 완료: 새 큐티 ${added}개`);
    } catch {
      alert('백업 파일을 읽지 못했어요.');
    }
  });

  // ---------- 시작 ----------
  purgeExpired();
  if (!load('qt.noticeSeen', false)) {
    $('notice-retention').textContent = `지금은 '${retentionLabel(profile.retentionDays)}'${profile.retentionDays ? '로' : '으로'} 설정돼 있고,`;
    $('notice').hidden = false;
  }

  const lastId = load(KEY_CURRENT, null);
  const t = today();
  const start = entries.find(e => e.id === lastId && e.date === t) || entries.find(e => e.date === t) || newDraft();
  openEntry(start);
  updateBackupUI();

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
