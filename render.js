// 큐티일기 양식(A4)을 캔버스에 그린다. 좌표 단위는 PDF와 같은 pt(1/72인치).
(function () {
  const PAGE_W = 595, PAGE_H = 842;
  const SCALE = 3; // 1pt = 3px → 약 216dpi
  const FONT = '"Malgun Gothic","맑은 고딕","Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Nanum Gothic",sans-serif';
  const INK = '#231f20';

  // 원본 양식에서 잘라낸 헤더 이미지(y=60pt부터 196pt 높이)
  const HEADER_Y = 60, HEADER_H = 196;
  const headerImg = new Image();
  const headerReady = new Promise((res, rej) => {
    headerImg.onload = res;
    headerImg.onerror = rej;
  });
  headerImg.src = 'assets/header.png';

  // 헤더 칸 위치 (x 시작, x 끝, 글자 기준선 y)
  const FIELDS = {
    group:   { x0: 237, x1: 304, y: 146.5, center: true },
    name:    { x0: 362, x1: 496, y: 146.5 },
    date:    { x0: 266, x1: 496, y: 176 },
    passage: { x0: 261, x1: 496, y: 205.5 },
    title:   { x0: 261, x1: 496, y: 235 },
  };

  const SECTIONS = [
    { key: 'summary',     label: '요약', min: 127 },
    { key: 'meditation',  label: '묵상', min: 152 },
    { key: 'application', label: '적용', min: 127 },
    { key: 'prayer',      label: '기도', min: 130 },
  ];
  const X0 = 98, X1 = 493.5;
  const BODY_TOP = 270, BODY_BOTTOM = 806;
  const CONT_TOP = 60;
  const LABEL_BLOCK = 24; // 라벨 + 밑줄 + 여백
  const SECTION_PAD = 8;

  const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

  function formatDateKo(iso) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    const wd = WEEKDAYS[new Date(y, m - 1, d).getDay()];
    return `${y}년 ${m}월 ${d}일 (${wd})`;
  }

  function setFont(ctx, size, bold) {
    ctx.font = `${bold ? 'bold ' : ''}${size * SCALE}px ${FONT}`;
  }

  function measure(ctx, text) {
    return ctx.measureText(text).width / SCALE;
  }

  // 단어 단위로 줄바꿈, 한 단어가 너무 길면 글자 단위로 자른다.
  function wrap(ctx, text, width) {
    const lines = [];
    for (const para of String(text || '').replace(/\r/g, '').split('\n')) {
      const tokens = para.match(/\s+|\S+/g) || [''];
      let line = '';
      for (let tok of tokens) {
        if (measure(ctx, line + tok) <= width) { line += tok; continue; }
        if (/^\s+$/.test(tok)) { lines.push(line); line = ''; continue; }
        if (line.trim()) { lines.push(line.replace(/\s+$/, '')); line = ''; }
        while (measure(ctx, tok) > width) {
          let i = 1;
          while (i < tok.length && measure(ctx, tok.slice(0, i + 1)) <= width) i++;
          lines.push(tok.slice(0, i));
          tok = tok.slice(i);
        }
        line = tok;
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    // 끝의 빈 줄 제거
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    return lines;
  }

  function newPage() {
    const c = document.createElement('canvas');
    c.width = PAGE_W * SCALE;
    c.height = PAGE_H * SCALE;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = INK;
    ctx.strokeStyle = INK;
    ctx.textBaseline = 'alphabetic';
    return { canvas: c, ctx };
  }

  function text(ctx, s, x, y) {
    ctx.fillText(s, x * SCALE, y * SCALE);
  }

  // 칸 너비에 맞게 글자 크기를 줄이고, 그래도 넘치면 말줄임
  function drawField(ctx, value, f) {
    if (!value) return;
    const width = f.x1 - f.x0;
    let size = 10.5;
    setFont(ctx, size);
    while (measure(ctx, value) > width && size > 7) { size -= 0.5; setFont(ctx, size); }
    let s = value;
    if (measure(ctx, s) > width) {
      while (s.length && measure(ctx, s + '…') > width) s = s.slice(0, -1);
      s += '…';
    }
    const x = f.center ? f.x0 + (width - measure(ctx, s)) / 2 : f.x0;
    text(ctx, s, x, f.y);
  }

  function drawLabel(ctx, label, y) {
    setFont(ctx, 10, true);
    text(ctx, label, X0, y + 11);
    ctx.lineWidth = 0.5 * SCALE;
    ctx.beginPath();
    ctx.moveTo(X0 * SCALE, (y + 16) * SCALE);
    ctx.lineTo(X1 * SCALE, (y + 16) * SCALE);
    ctx.stroke();
  }

  function layoutSections(ctx, entry, size) {
    setFont(ctx, size);
    const lh = size * 1.65;
    return SECTIONS.map(s => {
      const lines = wrap(ctx, entry[s.key], X1 - X0 - 4);
      return { ...s, lines, lh, need: LABEL_BLOCK + lines.length * lh + SECTION_PAD };
    });
  }

  function drawLines(ctx, lines, size, lh, x, y) {
    setFont(ctx, size);
    lines.forEach((ln, i) => text(ctx, ln, x, y + size + i * lh));
  }

  function renderEntry(entry) {
    const pages = [];
    const first = newPage();
    pages.push(first.canvas);
    const { ctx } = first;

    ctx.drawImage(headerImg, 0, HEADER_Y * SCALE, PAGE_W * SCALE, HEADER_H * SCALE);
    drawField(ctx, entry.group, FIELDS.group);
    drawField(ctx, entry.name, FIELDS.name);
    drawField(ctx, formatDateKo(entry.date), FIELDS.date);
    drawField(ctx, entry.passage, FIELDS.passage);
    drawField(ctx, entry.title, FIELDS.title);

    const avail = BODY_BOTTOM - BODY_TOP;

    // 1) 한 페이지에 들어가는 가장 큰 글자 크기를 찾는다
    for (let size = 10.5; size >= 8.5; size -= 0.5) {
      const secs = layoutSections(ctx, entry, size);
      const totalNeed = secs.reduce((a, s) => a + s.need, 0);
      if (totalNeed > avail) continue;
      // 남는 공간은 원래 양식 칸 높이에 모자란 만큼 비례 배분
      const deficits = secs.map(s => Math.max(0, s.min - s.need));
      const defSum = deficits.reduce((a, b) => a + b, 0);
      const spare = avail - totalNeed;
      let y = BODY_TOP;
      secs.forEach((s, i) => {
        const h = s.need + (defSum ? spare * deficits[i] / defSum : spare / secs.length);
        drawLabel(ctx, s.label, y);
        drawLines(ctx, s.lines, size, s.lh, X0 + 2, y + LABEL_BLOCK);
        y += h;
      });
      return pages;
    }

    // 2) 너무 길면 여러 페이지로 이어서 쓴다
    const size = 9.5;
    const secs = layoutSections(ctx, entry, size);
    let cur = ctx;
    let y = BODY_TOP;
    const contPage = () => {
      const p = newPage();
      pages.push(p.canvas);
      cur = p.ctx;
      setFont(cur, 8);
      cur.fillStyle = '#777';
      const info = [entry.group && `${entry.group}조`, entry.name, formatDateKo(entry.date)].filter(Boolean).join(' · ');
      text(cur, `큐티일기  ${info}  (계속)`, X0, 42);
      cur.fillStyle = INK;
      y = CONT_TOP;
    };
    for (const s of secs) {
      if (y + LABEL_BLOCK + s.lh > BODY_BOTTOM) contPage();
      drawLabel(cur, s.label, y);
      y += LABEL_BLOCK;
      for (const ln of s.lines) {
        if (y + s.lh > BODY_BOTTOM) {
          contPage();
          drawLabel(cur, `${s.label} (계속)`, y);
          y += LABEL_BLOCK;
        }
        drawLines(cur, [ln], size, s.lh, X0 + 2, y);
        y += s.lh;
      }
      y += SECTION_PAD + 10;
    }
    return pages;
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(res => canvas.toBlob(res, type, quality));
  }

  async function renderMany(entries) {
    await headerReady;
    return entries.map(e => ({ entry: e, pages: renderEntry(e) }));
  }

  async function buildPdf(rendered) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true });
    let firstPage = true;
    for (const r of rendered) {
      for (const c of r.pages) {
        if (!firstPage) doc.addPage('a4');
        firstPage = false;
        doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
      }
    }
    return doc.output('blob');
  }

  window.QTRender = { renderMany, buildPdf, canvasToBlob, formatDateKo };
})();
