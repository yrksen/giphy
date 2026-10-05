import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, RefreshCw, Ticket } from 'lucide-react';
import { Movie } from './MovieCard';

interface TicketGeneratorProps {
  movies: Movie[];
  isDark?: boolean;
}

// ── Data pools ────────────────────────────────────────────────────────────────

const GREEK_GODS = [
  'Zeus','Hera','Poseidon','Demeter','Athena',
  'Apollo','Artemis','Ares','Hephaestus','Aphrodite','Hermes','Dionysus',
];
const ROWS  = ['A','B','C','D','E','F','G','H','J','K','L','M'];
const TIMES = ['10:15','12:30','14:45','17:00','19:30','21:15','22:00','11:00','16:20','20:45'];

function rand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(lo: number, hi: number) { return Math.floor(Math.random() * (hi - lo + 1)) + lo; }

function messyPrice(): number {
  const d = randInt(6, 9);
  let c = randInt(1, 99);
  while (c === 0 || c === 50) c = randInt(1, 99);
  return d + c / 100;
}

interface TicketData {
  hall: string; row: string; seat: number;
  price: number; time: string; date: string; ref: string;
}

function makeData(): TicketData {
  return {
    hall:  `Dumpster Hall ${rand(GREEK_GODS)}`,
    row:   rand(ROWS),
    seat:  randInt(1, 22),
    price: messyPrice(),
    time:  rand(TIMES),
    date:  new Date().toLocaleDateString('en-GB', { weekday:'short', day:'2-digit', month:'short', year:'numeric' }),
    ref:   `TRB-${Math.random().toString(36).substring(2,8).toUpperCase()}`,
  };
}

// ── Canvas helpers ────────────────────────────────────────────────────────────

const F = '"Atkinson Hyperlegible", Arial, sans-serif';

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number,number,number,number]) {
  const [tl,tr,br,bl] = typeof r === 'number' ? [r,r,r,r] : r;
  ctx.beginPath();
  ctx.moveTo(x+tl, y); ctx.lineTo(x+w-tr, y); ctx.quadraticCurveTo(x+w,y,x+w,y+tr);
  ctx.lineTo(x+w,y+h-br); ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
  ctx.lineTo(x+bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-bl);
  ctx.lineTo(x,y+tl); ctx.quadraticCurveTo(x,y,x+tl,y);
  ctx.closePath();
}

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src.includes('?') ? `${src}&_xo=1` : `${src}?_xo=1`;
  });
}

function vBarcode(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const seq = [3,1,2,1,4,1,2,3,1,2,1,3,2,1,4,1,2,1,3,1,2,4,1,3,2,1,2,1,3,2,4,1,2,1,3,1,4,2,1,3,2,1,1,3,2,4];
  let cy = y;
  for (let i = 0; i < seq.length; i++) {
    if (i % 2 === 0) ctx.fillRect(x, cy, w, seq[i]);
    cy += seq[i] + (i % 3 === 0 ? 2 : 1);
  }
  while (cy < y + h - 3) {
    const bh = ((cy * 7 + 3) % 3) + 1;
    if ((cy * 11) % 3 !== 0) ctx.fillRect(x, cy, w, bh);
    cy += bh + 1;
  }
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (ctx.measureText(t+'…').width > maxW && t.length > 0) t = t.slice(0,-1);
  return t+'…';
}

// Wrap title to at most 2 lines, returns [line1, line2?]
function wrapTitle(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  let l1 = '', l2 = '';
  let broke = false;
  for (const w of words) {
    if (!broke && ctx.measureText(l1 + w + ' ').width < maxW) { l1 += w + ' '; }
    else { broke = true; l2 += w + ' '; }
  }
  return [l1.trim(), fit(ctx, l2.trim(), maxW)];
}

// ── Main draw ─────────────────────────────────────────────────────────────────

async function draw(canvas: HTMLCanvasElement, movie: Movie, data: TicketData) {
  const W = 1020, H = 420;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Palette
  const BEIGE    = '#ede8d8';
  const STUB_BG  = '#e4deca';
  const INK      = '#1c1710';
  const DIM      = 'rgba(28,23,16,0.40)';
  const RULE_C   = 'rgba(28,23,16,0.09)';
  const ACCENT   = '#c8652c';

  const PAD      = 20;
  const POSTER_W = 320;           // left ~1/3
  const TEAR_X   = W - PAD - 190;
  const STUB_SW  = W - PAD - TEAR_X;

  // ── White canvas bg
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // ── Ticket shadow
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.12)'; ctx.shadowBlur = 28; ctx.shadowOffsetY = 5;
  ctx.fillStyle = BEIGE;
  rr(ctx, PAD, PAD, W-PAD*2, H-PAD*2, 16);
  ctx.fill();
  ctx.restore();

  // ── Ticket body
  ctx.fillStyle = BEIGE;
  rr(ctx, PAD, PAD, W-PAD*2, H-PAD*2, 16);
  ctx.fill();

  // ── Poster clip + draw
  const PX = PAD, PY = PAD, PW = POSTER_W, PH = H-PAD*2;
  try {
    const img = await loadImg(movie.image);
    ctx.save();
    rr(ctx, PX, PY, PW, PH, [16,0,0,16]);
    ctx.clip();
    ctx.fillStyle = '#111'; ctx.fillRect(PX,PY,PW,PH);
    const iAR = img.naturalWidth / img.naturalHeight, cAR = PW / PH;
    let sx=0,sy=0,sw=img.naturalWidth,sh=img.naturalHeight;
    if (iAR > cAR) { sw = sh*cAR; sx = (img.naturalWidth-sw)/2; }
    else            { sh = sw/cAR; sy = (img.naturalHeight-sh)/2; }
    ctx.drawImage(img, sx,sy,sw,sh, PX,PY,PW,PH);
    ctx.restore();
    // fade right edge into beige
    const fg = ctx.createLinearGradient(PX+PW-64,0,PX+PW+1,0);
    fg.addColorStop(0, 'rgba(237,232,216,0)');
    fg.addColorStop(1, BEIGE);
    ctx.fillStyle = fg;
    ctx.fillRect(PX+PW-64, PY, 66, PH);
  } catch {
    ctx.fillStyle = '#d8d2c0';
    rr(ctx, PX,PY,PW,PH,[16,0,0,16]); ctx.fill();
    ctx.fillStyle = DIM; ctx.font = `700 12px ${F}`; ctx.textAlign = 'center';
    ctx.fillText('NO POSTER', PX+PW/2, PY+PH/2);
  }

  // ── Stub background (slightly darker beige)
  ctx.save();
  // Clip to ticket card shape, then fill stub area with darker beige
  rr(ctx, PAD, PAD, W-PAD*2, H-PAD*2, 16);
  ctx.clip();
  ctx.fillStyle = STUB_BG;
  ctx.fillRect(TEAR_X+1, PAD, STUB_SW+2, H-PAD*2);
  ctx.restore();

  // ── Middle content — fixed y coordinates ──────────────────────────────────
  const MX = PX + PW + 30;          // left edge of middle text
  const MW = TEAR_X - MX - 18;      // available width

  const rule = (y: number) => {
    ctx.strokeStyle = RULE_C; ctx.lineWidth = 1; ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(MX,y); ctx.lineTo(MX+MW,y); ctx.stroke();
  };
  const lbl = (text: string, x: number, y: number) => {
    ctx.fillStyle = DIM; ctx.font = `400 9px ${F}`; ctx.textAlign = 'left';
    ctx.fillText(text.toUpperCase(), x, y);
  };
  const val = (text: string, x: number, y: number, size: number, color = INK) => {
    ctx.fillStyle = color; ctx.font = `700 ${size}px ${F}`; ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
  };

  // — Title (y=58, size 25 or smaller for long titles)
  const titleRaw = movie.title.toUpperCase();
  const tSize = titleRaw.length > 26 ? 19 : titleRaw.length > 18 ? 22 : 25;
  ctx.font = `700 ${tSize}px ${F}`;
  const titleLines = wrapTitle(ctx, titleRaw, MW);
  ctx.fillStyle = INK; ctx.textAlign = 'left';
  ctx.fillText(titleLines[0], MX, 62);
  if (titleLines[1]) {
    ctx.font = `700 ${Math.round(tSize*0.84)}px ${F}`;
    ctx.fillText(titleLines[1], MX, 62 + tSize + 4);
  }

  // — Meta line: genres · year · runtime · ★ imdb  (y≈92 or after title)
  const metaY = titleLines[1] ? 62 + tSize + 4 + Math.round(tSize*0.84) + 20 : 62 + tSize + 22;
  const genres  = (movie.genre||'Film').split(',').map(g=>g.trim()).filter(Boolean).join(' · ');
  const rt      = movie.runtime ?? '';
  const imdb    = (movie.imdbRating||movie.rating||0).toFixed(1);
  const metaStr = [String(movie.year), rt, genres, `★ ${imdb}`].filter(Boolean).join('  ·  ');
  ctx.fillStyle = DIM; ctx.font = `400 12px ${F}`; ctx.textAlign = 'left';
  ctx.fillText(fit(ctx, metaStr, MW), MX, metaY);

  // — Fixed section grid below meta
  // We'll place 4 rows with rules between them, evenly filling from metaY+20 to H-PAD-28
  const gridTop = metaY + 42;
  const gridBot = H - PAD - 30;
  const gridH   = gridBot - gridTop;    // total available

  // 4 rows + 3 rules. Each rule = 1px. Gap after rule = 10px. Label = 13px. Value = 16px → row = ~13+16+gap = 44
  // Manually: divide gridH into 4 equal slots
  const slotH = gridH / 4;

  const rowY = (i: number) => gridTop + i * slotH;

  // rule above each row except first
  for (let i = 1; i < 4; i++) rule(rowY(i) - 8);

  const col2 = MX + MW * 0.48;
  const col3a = MX + MW * 0.33;
  const col3b = MX + MW * 0.66;

  // Row 0: Date / Time
  lbl('Date', MX,   rowY(0) + 4);
  lbl('Time', col2, rowY(0) + 4);
  val(data.date, MX,   rowY(0) + 4 + 18, 13);
  val(data.time, col2, rowY(0) + 4 + 18, 13);

  // Row 1: Cinema
  lbl('Cinema', MX, rowY(1) + 4);
  val('Trash Bin Cinema', MX, rowY(1) + 4 + 18, 13);

  // Row 2: Hall
  lbl('Hall', MX, rowY(2) + 4);
  val(data.hall, MX, rowY(2) + 4 + 18, 13);

  // Row 3: Row / Seat / Price
  lbl('Row',   MX,    rowY(3) + 4);
  lbl('Seat',  col3a, rowY(3) + 4);
  lbl('Price', col3b, rowY(3) + 4);
  val(data.row,                    MX,    rowY(3) + 4 + 20, 19);
  val(String(data.seat),           col3a, rowY(3) + 4 + 20, 19);
  val(`$${data.price.toFixed(2)}`, col3b, rowY(3) + 4 + 20, 19, ACCENT);

  // ── Tear line
  ctx.save();
  ctx.strokeStyle = 'rgba(28,23,16,0.16)'; ctx.lineWidth = 1.5; ctx.setLineDash([5,5]);
  ctx.beginPath(); ctx.moveTo(TEAR_X,PAD+16); ctx.lineTo(TEAR_X,H-PAD-16); ctx.stroke();
  ctx.restore();

  // Punched notches
  for (const cy of [PAD, H-PAD]) {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(TEAR_X, cy, 14, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ── Stub content
  const SX  = TEAR_X + 14;
  const SW  = W - PAD - SX;
  const SCX = SX + SW/2;

  // Booking ref
  ctx.textAlign = 'center';
  ctx.fillStyle = DIM; ctx.font = `400 8px ${F}`;
  ctx.fillText('BOOKING REF', SCX, PAD+28);
  ctx.fillStyle = INK; ctx.font = `700 10px ${F}`;
  ctx.fillText(data.ref, SCX, PAD+44);

  ctx.strokeStyle = RULE_C; ctx.lineWidth = 1; ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(SX+6,PAD+52); ctx.lineTo(SX+SW-6,PAD+52); ctx.stroke();

  // Vertical barcode
  const BC_X = SX + 10;
  const BC_Y = PAD + 60;
  const BC_W = SW - 20;
  const BC_H = H - PAD - BC_Y - 30;
  ctx.fillStyle = INK;
  vBarcode(ctx, BC_X, BC_Y, BC_W, BC_H);

  ctx.fillStyle = DIM; ctx.font = `400 7px ${F}`; ctx.textAlign = 'center';
  ctx.fillText(data.ref.replace('TRB-','')+'00', SCX, BC_Y+BC_H+12);

  ctx.fillStyle = DIM; ctx.font = `700 8px ${F}`;
  ctx.fillText('ADMIT ONE', SCX, H-PAD-8);
}

// ── React component ───────────────────────────────────────────────────────────

export function TicketGenerator({ movies, isDark = false }: TicketGeneratorProps) {
  const [open, setOpen]     = useState(false);
  const [selectedId, setId] = useState<number | null>(null);
  const [busy, setBusy]     = useState(false);
  const [ticketData, setTD] = useState<TicketData | null>(null);
  const canvasRef           = useRef<HTMLCanvasElement>(null);

  const chosen = movies.find(m => m.id === selectedId) ?? null;

  const generate = useCallback(async (movie: Movie, data: TicketData) => {
    if (!canvasRef.current) return;
    setBusy(true);
    try { await draw(canvasRef.current, movie, data); }
    finally { setBusy(false); }
  }, []);

  useEffect(() => {
    if (!open || !chosen) return;
    const t = setTimeout(() => {
      const data = makeData();
      setTD(data);
      generate(chosen, data);
    }, 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, selectedId]);

  const openModal = () => {
    const first = movies[0];
    setId(first?.id ?? null);
    setOpen(true);
  };

  const regenerate = () => {
    if (!chosen) return;
    const data = makeData();
    setTD(data);
    generate(chosen, data);
  };

  const download = () => {
    if (!canvasRef.current || !chosen) return;
    const src = canvasRef.current;
    const pad = 20, r = 16;
    const ow = src.width  - pad * 2;
    const oh = src.height - pad * 2;
    const out = document.createElement('canvas');
    out.width = ow; out.height = oh;
    const octx = out.getContext('2d')!;
    // Clip to rounded rect — corners become transparent in the PNG
    octx.beginPath();
    octx.moveTo(r, 0); octx.lineTo(ow-r, 0); octx.quadraticCurveTo(ow, 0, ow, r);
    octx.lineTo(ow, oh-r); octx.quadraticCurveTo(ow, oh, ow-r, oh);
    octx.lineTo(r, oh); octx.quadraticCurveTo(0, oh, 0, oh-r);
    octx.lineTo(0, r); octx.quadraticCurveTo(0, 0, r, 0);
    octx.closePath();
    octx.clip();
    // Draw source offset by -pad to strip the white margin
    octx.drawImage(src, -pad, -pad);
    const a = document.createElement('a');
    a.download = `ticket-${chosen.title.toLowerCase().replace(/[^a-z0-9]+/g,'-')}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };

  const ff = '"Atkinson Hyperlegible",sans-serif';
  const bg     = isDark ? '#18120a' : '#fdfaf7';
  const bdr    = isDark ? 'rgba(200,101,44,0.18)' : 'rgba(28,23,16,0.08)';
  const div    = isDark ? 'rgba(200,101,44,0.10)' : 'rgba(28,23,16,0.07)';
  const ink    = isDark ? '#f0ead8' : '#1c1710';
  const dim    = isDark ? 'rgba(240,234,216,0.35)' : 'rgba(28,23,16,0.32)';
  const lbl    = isDark ? 'rgba(240,234,216,0.42)' : 'rgba(28,23,16,0.42)';
  const selBg  = isDark ? '#120d09' : '#fff';
  const selBdr = isDark ? 'rgba(200,101,44,0.25)' : 'rgba(28,23,16,0.14)';
  const cvsBg  = isDark ? '#0e0905' : '#fff';
  const spin   = isDark ? 'rgba(14,9,5,0.7)'  : 'rgba(255,255,255,0.7)';
  const over   = isDark ? 'rgba(0,0,0,0.75)'  : 'rgba(0,0,0,0.55)';

  const modal = open ? (
    <div
      style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:16, background:over, backdropFilter:'blur(8px)' }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div style={{ background:bg, borderRadius:18, boxShadow:'0 28px 70px rgba(0,0,0,0.4)', width:'100%', maxWidth:860, display:'flex', flexDirection:'column', maxHeight:'95dvh', overflow:'hidden', border:`1px solid ${bdr}`, fontFamily:ff }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 22px', borderBottom:`1px solid ${div}`, flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Ticket size={17} color="#c8652c" />
            <span style={{ fontWeight:700, fontSize:15, color:ink }}>Generate Movie Ticket</span>
          </div>
          <button onClick={() => setOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:dim, padding:4, display:'flex' }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding:'14px 22px 10px', flexShrink:0 }}>
          <label style={{ display:'block', fontSize:10, fontWeight:700, letterSpacing:'0.07em', textTransform:'uppercase', color:lbl, marginBottom:6 }}>
            Choose a movie
          </label>
          <select
            value={selectedId ?? ''}
            onChange={e => setId(Number(e.target.value))}
            style={{ width:'100%', height:38, padding:'0 10px', borderRadius:8, border:`1px solid ${selBdr}`, fontSize:13, color:ink, background:selBg, cursor:'pointer', outline:'none', fontFamily:ff }}
          >
            {movies.map(m => <option key={m.id} value={m.id}>{m.title} ({m.year})</option>)}
          </select>
        </div>

        <div style={{ flex:1, overflowY:'auto', padding:'4px 22px 8px', minHeight:0 }}>
          <div style={{ position:'relative', borderRadius:10, overflow:'hidden', background:cvsBg, boxShadow:'0 2px 12px rgba(0,0,0,0.15)' }}>
            {busy && (
              <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:spin, zIndex:2 }}>
                <RefreshCw size={22} color="#c8652c" style={{ animation:'tg-spin 1s linear infinite' }} />
              </div>
            )}
            <canvas ref={canvasRef} style={{ width:'100%', height:'auto', display:'block' }} />
          </div>
        </div>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, padding:'14px 22px', borderTop:`1px solid ${div}`, flexShrink:0 }}>
          <span style={{ fontSize:11, color:dim, fontFamily:ff }}>
            {ticketData ? `${ticketData.ref}  ·  Row ${ticketData.row} Seat ${ticketData.seat}  ·  $${ticketData.price.toFixed(2)}` : ' '}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={regenerate} disabled={busy||!chosen}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid rgba(200,101,44,0.35)', background:'none', color:'#c8652c', fontSize:13, fontWeight:600, cursor:busy||!chosen?'not-allowed':'pointer', opacity:busy||!chosen?0.4:1, fontFamily:ff }}>
              <RefreshCw size={13} /> New ticket
            </button>
            <button onClick={download} disabled={busy||!chosen}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 20px', borderRadius:8, border:'none', background:'#c8652c', color:'#fff', fontSize:13, fontWeight:600, cursor:busy||!chosen?'not-allowed':'pointer', opacity:busy||!chosen?0.4:1, fontFamily:ff }}>
              <Download size={13} /> Download PNG
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes tg-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : null;

  return (
    <>
      <button onClick={openModal} className="text-sm font-medium cursor-pointer transition-colors tracking-tight whitespace-nowrap text-[rgba(16,11,9,0.6)] hover:text-[#d07339] dark:text-[rgba(247,241,237,0.6)] dark:hover:text-[#c36a32]">
        🎟️ Ticket
      </button>
      {createPortal(modal, document.body)}
    </>
  );
}
