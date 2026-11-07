/* ===================================================================
   AquaConnect – Smart Campus Water Management
   Pure HTML/CSS/JS demo. Data is stored in the browser (localStorage).
   To go live: replace load()/save() with Firebase Firestore calls.
   =================================================================== */

const ADMIN_PASSWORD = "admin123";   // demo only – use Firebase Auth in production
const STORE_KEY = "aquaconnect_v1";

/* ---------- Campus data ---------- */
const BLOCKS = {
  A:       { name: "Block A",  x: 130, y: 110, fac: ["Classrooms", "Washrooms", "Drinking water", "Bottle bin"] },
  B:       { name: "Block B",  x: 340, y: 90,  fac: ["Labs", "Washrooms", "Drinking water", "Bottle bin", "Seminar hall"] },
  C:       { name: "Block C",  x: 570, y: 110, fac: ["Classrooms", "Admin office", "Drinking water", "Bottle bin"] },
  D:       { name: "Block D",  x: 140, y: 310, fac: ["Workshops", "Washrooms", "Drinking water"] },
  LIB:     { name: "Library",  x: 350, y: 270, fac: ["Reading hall", "Washrooms", "Drinking water", "Bottle bin"] },
  CANTEEN: { name: "Canteen",  x: 590, y: 300, fac: ["Food court", "Washrooms", "Drinking water", "Bottle bin"] },
  HOSTEL:  { name: "Hostel",   x: 360, y: 430, fac: ["Rooms", "Mess", "Drinking water", "Bottle bin"] }
};
const EDGES = [["A","B"],["B","C"],["A","D"],["B","LIB"],["C","CANTEEN"],["D","LIB"],["LIB","CANTEEN"],["D","HOSTEL"],["LIB","HOSTEL"],["CANTEEN","HOSTEL"]];

const DEFAULT_WPS = [
  { id:"WP1", name:"Block A – Ground Floor Cooler", block:"A",       dx:-35, dy:38, status:"working",     avail:"High",   type:"Cold water cooler" },
  { id:"WP2", name:"Block A – First Floor Cooler",  block:"A",       dx:40,  dy:38, status:"notworking",  avail:"Empty",  type:"Water cooler" },
  { id:"WP3", name:"Block B – Corridor Cooler",     block:"B",       dx:0,   dy:42, status:"working",     avail:"Medium", type:"Cold water cooler" },
  { id:"WP4", name:"Block C – Entrance Cooler",     block:"C",       dx:-30, dy:40, status:"maintenance", avail:"Empty",  type:"Water cooler" },
  { id:"WP5", name:"Library – Reading Hall Cooler", block:"LIB",     dx:0,   dy:42, status:"working",     avail:"High",   type:"RO + Cold water" },
  { id:"WP6", name:"Canteen – Water Station",       block:"CANTEEN", dx:-35, dy:40, status:"working",     avail:"Low",    type:"RO tap station" },
  { id:"WP7", name:"Hostel – Mess Cooler",          block:"HOSTEL",  dx:-40, dy:-38,status:"working",     avail:"High",   type:"Cold water cooler" },
  { id:"WP8", name:"Block D – Workshop Cooler",     block:"D",       dx:0,   dy:42, status:"working",     avail:"Medium", type:"Water cooler" }
];
const DEFAULT_BINS = [
  { id:"BN1", name:"Block A Bottle Bin",  block:"A",       dx:48,  dy:-30, fill:30 },
  { id:"BN2", name:"Block B Bottle Bin",  block:"B",       dx:48,  dy:-30, fill:60 },
  { id:"BN3", name:"Block C Bottle Bin",  block:"C",       dx:48,  dy:-30, fill:92 },
  { id:"BN4", name:"Library Bottle Bin",  block:"LIB",     dx:48,  dy:-30, fill:20 },
  { id:"BN5", name:"Canteen Bottle Bin",  block:"CANTEEN", dx:48,  dy:-30, fill:85 },
  { id:"BN6", name:"Hostel Bottle Bin",   block:"HOSTEL",  dx:48,  dy:-30, fill:45 }
];
const TIPS = [
  "Turn off taps fully after use – a dripping tap wastes up to 20 litres a day.",
  "Carry a reusable bottle and fill only what you can drink.",
  "Report leaks immediately – small leaks become big losses.",
  "Don't pour leftover drinking water on the floor; water plants instead.",
  "Use the bottle bins – recycling plastic saves energy and water.",
  "Avoid using drinking-water taps for washing hands or cleaning."
];
const JOURNEY = [
  "Opens AquaConnect.", "Clicks on Find Water.", "Sees nearby water points.", "Checks their working status.",
  "Gets directions to the nearest available point.", "Notices a leaking tap.", "Scans its QR code.",
  "Reports the leakage.", "Receives a complaint ID.", "Later checks whether the issue is resolved."
];
const TYPES = {
  damaged:  { label: "Damaged water cooler",         priority: "Medium" },
  leak:     { label: "Water leakage",                priority: "High" },
  dirty:    { label: "Dirty drinking water facility",priority: "High" },
  nosupply: { label: "No water supply",              priority: "High" },
  tap:      { label: "Tap left running (water waste)",priority: "Low" },
  bin:      { label: "Overflowing bottle bin",       priority: "Medium" }
};
const PRIORITY_RANK = { High: 0, Medium: 1, Low: 2 };
const STATUS_LABEL = { working: "Working", notworking: "Not Working", maintenance: "Under Maintenance" };

/* ---------- Storage ---------- */
let db;
function load() {
  try { db = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { db = null; }
  if (!db) {
    db = { wps: DEFAULT_WPS, bins: DEFAULT_BINS, complaints: [], notifications: [], feedback: [], ratings: {}, votes: {}, eco: {} };
    save();
  }
}
function save() { localStorage.setItem(STORE_KEY, JSON.stringify(db)); }

/* ---------- Helpers ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
const fmtDate = t => new Date(t).toLocaleString();
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.add("hidden"), 3200);
}
const ptOf = o => ({ x: BLOCKS[o.block].x + o.dx, y: BLOCKS[o.block].y + o.dy });
const avgRating = id => { const r = db.ratings[id] || []; return r.length ? r.reduce((a, b) => a + b, 0) / r.length : 0; };
const starsHtml = v => { const n = Math.round(v); return `<span class="stars">${"★".repeat(n)}${"☆".repeat(5 - n)}</span>`; };
const locationName = id => (db.wps.find(w => w.id === id) || db.bins.find(b => b.id === id) || {}).name || id;

/* ---------- Routing (Dijkstra over the block graph) ---------- */
const bdist = (a, b) => Math.hypot(BLOCKS[a].x - BLOCKS[b].x, BLOCKS[a].y - BLOCKS[b].y);
function route(from, to) {
  if (from === to) return { dist: 0, path: [from] };
  const d = {}, prev = {}, todo = new Set(Object.keys(BLOCKS));
  todo.forEach(k => d[k] = Infinity); d[from] = 0;
  while (todo.size) {
    let u = null; todo.forEach(k => { if (u === null || d[k] < d[u]) u = k; });
    todo.delete(u); if (u === to) break;
    EDGES.forEach(([a, b]) => {
      const v = a === u ? b : b === u ? a : null;
      if (v && todo.has(v) && d[u] + bdist(u, v) < d[v]) { d[v] = d[u] + bdist(u, v); prev[v] = u; }
    });
  }
  const path = []; for (let n = to; n; n = prev[n]) path.unshift(n);
  return { dist: d[to], path };
}
const metres = u => Math.round(u * 0.5);
const walkMin = u => Math.max(1, Math.round(metres(u) / 80));

/* ---------- App state ---------- */
const state = { block: "A", route: null, selectedWp: null, search: "", filter: "all", heat: false, fbRating: 5, adminOk: false };

/* ---------- Navigation ---------- */
function go(page, q) {
  if (page === "admin" && !state.adminOk) {
    const p = prompt("Admin password (demo: " + ADMIN_PASSWORD + ")");
    if (p !== ADMIN_PASSWORD) { if (p !== null) toast("Wrong password"); return; }
    state.adminOk = true;
  }
  $$(".page").forEach(p => p.classList.toggle("active", p.id === "page-" + page));
  $$("#nav a").forEach(a => a.classList.toggle("active", a.dataset.go === page));
  $("#nav").classList.remove("open");
  location.hash = page + (q ? "?" + q : "");
  window.scrollTo(0, 0);
  render(page, q);
}
function render(page, q) {
  ({ home: renderHome, find: renderFind, bottle: renderBottle, report: () => renderReport(q),
     feedback: renderFeedback, about: renderAbout, admin: renderAdmin }[page] || (() => {}))();
}

/* ---------- Map (SVG) ---------- */
function mapSvg(mode) {
  const W = 800, H = 520;
  let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g-heat"><stop offset="0" stop-color="currentColor" stop-opacity=".55"/><stop offset="1" stop-color="currentColor" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#dff1e2"/>
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="18" fill="#eaf6ec" stroke="#b9dcc0" stroke-width="2"/>`;

  // heatmap
  if (state.heat && mode === "water") {
    Object.keys(BLOCKS).forEach(k => {
      const list = db.wps.filter(w => w.block === k);
      const score = list.length ? list.filter(w => w.status === "working").length / list.length : 0;
      const col = `hsl(${Math.round(score * 120)},80%,45%)`;
      s += `<g style="color:${col}"><circle cx="${BLOCKS[k].x}" cy="${BLOCKS[k].y}" r="110" fill="url(#g-heat)"/></g>`;
    });
  }
  // paths
  EDGES.forEach(([a, b]) => s += `<line x1="${BLOCKS[a].x}" y1="${BLOCKS[a].y}" x2="${BLOCKS[b].x}" y2="${BLOCKS[b].y}" stroke="#cfd8c7" stroke-width="14" stroke-linecap="round"/>`);
  EDGES.forEach(([a, b]) => s += `<line x1="${BLOCKS[a].x}" y1="${BLOCKS[a].y}" x2="${BLOCKS[b].x}" y2="${BLOCKS[b].y}" stroke="#fff" stroke-width="2" stroke-dasharray="6 6"/>`);
  // blocks
  Object.entries(BLOCKS).forEach(([k, b]) => {
    const me = k === state.block;
    s += `<g><rect x="${b.x - 42}" y="${b.y - 26}" width="84" height="52" rx="10" fill="${me ? "#cfe8ff" : "#fff"}" stroke="${me ? "#0b72c9" : "#9fb4c4"}" stroke-width="${me ? 3 : 1.5}"/>
    <text x="${b.x}" y="${b.y + 5}" text-anchor="middle" font-size="14" font-weight="700" fill="#16324a">${b.name}</text></g>`;
  });
  // route
  if (state.route && state.route.mode === mode) {
    const r = state.route;
    const pts = r.path.map(k => `${BLOCKS[k].x},${BLOCKS[k].y}`);
    pts.push(`${r.target.x},${r.target.y}`);
    s += `<polyline points="${pts.join(" ")}" fill="none" stroke="#0b72c9" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="10 8" class="pulse"/>`;
  }
  // points
  if (mode === "water") {
    db.wps.forEach(w => {
      const p = ptOf(w), col = { working: "#2a9d54", notworking: "#d9382f", maintenance: "#e0b100" }[w.status];
      const sel = state.selectedWp === w.id;
      s += `<g class="wp-pt" data-wp="${w.id}"><circle cx="${p.x}" cy="${p.y}" r="${sel ? 17 : 14}" fill="${col}" stroke="#fff" stroke-width="3"/>
      <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14">💧</text></g>`;
    });
  } else {
    db.bins.forEach(b => {
      const p = ptOf(b), col = b.fill >= 80 ? "#d9382f" : b.fill >= 50 ? "#e0b100" : "#2a9d54";
      s += `<g class="wp-pt" data-bin="${b.id}"><circle cx="${p.x}" cy="${p.y}" r="14" fill="${col}" stroke="#fff" stroke-width="3"/>
      <text x="${p.x}" y="${p.y + 5}" text-anchor="middle" font-size="14">♻️</text></g>`;
    });
  }
  // you are here
  const me = BLOCKS[state.block];
  s += `<g><circle cx="${me.x}" cy="${me.y - 34}" r="9" fill="#0b72c9" stroke="#fff" stroke-width="3"/><text x="${me.x}" y="${me.y - 48}" text-anchor="middle" font-size="12" font-weight="700" fill="#0b72c9">You are here</text></g>`;
  return s + "</svg>";
}
function drawMap(containerId, mode) {
  const el = $("#" + containerId);
  el.innerHTML = mapSvg(mode);
  $$("[data-wp]", el).forEach(g => g.onclick = () => { state.selectedWp = g.dataset.wp; renderFind(); });
  $$("[data-bin]", el).forEach(g => g.onclick = () => toast(locationName(g.dataset.bin) + " – " + db.bins.find(b => b.id === g.dataset.bin).fill + "% full"));
}

/* ---------- HOME ---------- */
function renderHome() {
  const working = db.wps.filter(w => w.status === "working").length;
  const open = db.complaints.filter(c => c.status !== "Resolved").length;
  const res = db.complaints.filter(c => c.status === "Resolved").length;
  $("#heroStats").innerHTML = `
    <div class="stat"><b>${working}/${db.wps.length}</b>Water points working</div>
    <div class="stat"><b>${open}</b>Open complaints</div>
    <div class="stat"><b>${res}</b>Issues resolved</div>`;
  $("#journey").innerHTML = JOURNEY.map((t, i) => `<div class="step"><b>${i + 1}</b>${t}</div>`).join("");
  $("#tipsHome").innerHTML = TIPS.slice(0, 4).map(t => `<div class="tip">💧 ${t}</div>`).join("");
}

/* ---------- FIND WATER ---------- */
function blockOptions(sel) {
  sel.innerHTML = Object.entries(BLOCKS).map(([k, b]) => `<option value="${k}">${b.name}</option>`).join("");
  sel.value = state.block;
}
function wpInfo(w) {
  const r = route(state.block, w.block);
  const extra = state.block === w.block ? 20 : 0;
  return { ...w, r, dist: r.dist + (extra ? 20 : 0) };
}
function nearestAvailable() {
  return db.wps.filter(w => w.status === "working" && w.avail !== "Empty").map(wpInfo).sort((a, b) => a.dist - b.dist)[0];
}
function directionsTo(kind, item) {
  const r = route(state.block, item.block);
  const total = r.dist + 20;
  state.route = { mode: kind, path: r.path, target: ptOf(item), item, total };
}
function routeText(kind) {
  const r = state.route; if (!r) return "";
  const steps = r.path.map(k => BLOCKS[k].name);
  const stepHtml = steps.length === 1
    ? `<li>You are already in <b>${steps[0]}</b> – it's right there.</li>`
    : steps.map((n, i) => `<li>${i === 0 ? "Start at" : i === steps.length - 1 ? "Arrive at" : "Walk through"} <b>${n}</b></li>`).join("");
  return `<b>Directions to ${esc(r.item.name)}</b><br>🚶 about ${metres(r.total)} m • ${walkMin(r.total)} min walk
    <ol>${stepHtml}<li>${kind === "water" ? "Water point" : "Bin"} is near the block entrance.</li></ol>
    <button class="btn sm ghost" onclick="clearRoute()">Clear route</button>`;
}
function clearRoute() { state.route = null; renderFind(); renderBottle(); }

function renderFind() {
  blockOptions($("#myBlock"));
  $("#wpSearch").value = state.search; $("#wpFilter").value = state.filter; $("#heatToggle").checked = state.heat;
  drawMap("map-find", "water");

  const q = state.search.toLowerCase();
  const list = db.wps.map(wpInfo)
    .filter(w => (state.filter === "all" || w.status === state.filter) &&
      (!q || (w.name + BLOCKS[w.block].name + w.type + w.status).toLowerCase().includes(q)))
    .sort((a, b) => a.dist - b.dist);
  $("#wpList").innerHTML = list.length ? list.map(w => `
    <div class="item ${w.status}">
      <div class="row"><b>${esc(w.name)}</b><span class="badge ${w.status}">${STATUS_LABEL[w.status]}</span></div>
      <div class="muted small">${BLOCKS[w.block].name} • ${metres(w.dist)} m away • Water: <span class="badge ${w.avail}">${w.avail}</span> • ${starsHtml(avgRating(w.id))}</div>
      <div class="acts">
        <button class="btn sm ghost" data-detail="${w.id}">Details</button>
        <button class="btn sm" data-dir="${w.id}">Directions</button>
        <button class="btn sm orange" data-rep="${w.id}">Report</button>
      </div>
    </div>`).join("") : `<p class="muted">No water points match.</p>`;
  $$("[data-detail]").forEach(b => b.onclick = () => { state.selectedWp = b.dataset.detail; renderFind(); });
  $$("[data-dir]").forEach(b => b.onclick = () => { directionsTo("water", db.wps.find(w => w.id === b.dataset.dir)); renderFind(); });
  $$("[data-rep]").forEach(b => b.onclick = () => go("report", "wp=" + b.dataset.rep));

  // route box
  const ri = $("#routeInfo");
  if (state.route && state.route.mode === "water") { ri.innerHTML = routeText("water"); ri.classList.remove("hidden"); } else ri.classList.add("hidden");

  // detail
  const d = $("#wpDetail"), w = db.wps.find(x => x.id === state.selectedWp);
  if (!w) d.innerHTML = `<p class="muted">Click a water point on the map or in the list to see details.</p>`;
  else {
    const v = db.votes[w.id] || { w: 0, n: 0 };
    const url = location.href.split("#")[0] + "#report?wp=" + w.id;
    d.innerHTML = `
      <h3>${esc(w.name)}</h3>
      <p><span class="badge ${w.status}">${STATUS_LABEL[w.status]}</span> ${w.crowd ? '<span class="muted small">(updated by students)</span>' : ""}</p>
      <p>🏢 ${BLOCKS[w.block].name} • 🚰 ${esc(w.type)}<br>💧 Water availability: <span class="badge ${w.avail}">${w.avail}</span><br>⭐ ${starsHtml(avgRating(w.id))} <span class="muted small">(${(db.ratings[w.id] || []).length} ratings)</span></p>
      <p class="small"><b>Crowd update:</b> students say ✅ ${v.w} working / ❌ ${v.n} not working</p>
      <div class="acts" style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn sm green" id="cw">✅ It's working</button>
        <button class="btn sm red" id="cn">❌ Not working</button>
        <button class="btn sm" id="cd">Directions</button>
        <button class="btn sm orange" id="cr">Report problem</button>
      </div>
      <p class="small" style="margin-bottom:4px"><b>Rate:</b> <span class="stars-input" id="rateStars">${[1,2,3,4,5].map(i => `<span data-s="${i}">★</span>`).join("")}</span></p>
      <div class="qr"><img alt="QR" width="130" height="130" src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(url)}">
      <div class="muted small">QR identity: ${w.id}<br>Scan to report a problem</div></div>`;
    $("#cw").onclick = () => crowdVote(w.id, "w");
    $("#cn").onclick = () => crowdVote(w.id, "n");
    $("#cd").onclick = () => { directionsTo("water", w); renderFind(); };
    $("#cr").onclick = () => go("report", "wp=" + w.id);
    $$("#rateStars span").forEach(s => {
      s.style.fontSize = "1.5rem";
      s.onclick = () => { (db.ratings[w.id] = db.ratings[w.id] || []).push(+s.dataset.s); save(); toast("Thanks for rating!"); renderFind(); };
    });
  }

  // block facilities table
  $("#blockTable").innerHTML = `<tr><th>Block</th><th>Facilities</th><th>Water points</th><th>Working</th></tr>` +
    Object.entries(BLOCKS).map(([k, b]) => {
      const l = db.wps.filter(w => w.block === k);
      return `<tr><td><b>${b.name}</b></td><td>${b.fac.join(" • ")}</td><td>${l.length}</td><td>${l.filter(w => w.status === "working").length}</td></tr>`;
    }).join("");
}
function crowdVote(id, which) {
  const v = db.votes[id] = db.votes[id] || { w: 0, n: 0 };
  v[which]++;
  const w = db.wps.find(x => x.id === id);
  if (v.n >= 3 && v.n > v.w && w.status === "working") { w.status = "notworking"; w.crowd = true; toast("Marked Not Working based on student reports"); }
  else if (v.w >= 3 && v.w > v.n && w.status === "notworking" && w.crowd) { w.status = "working"; toast("Marked Working based on student reports"); }
  else toast("Thanks for the update!");
  save(); renderFind();
}

/* ---------- BOTTLE ---------- */
function renderBottle() {
  if (!$("#myBlock2")) return;
  blockOptions($("#myBlock2"));
  drawMap("map-bottle", "bin");
  const list = db.bins.map(b => ({ ...b, dist: route(state.block, b.block).dist + (state.block === b.block ? 20 : 0) })).sort((a, b) => a.dist - b.dist);
  $("#binList").innerHTML = list.map(b => {
    const cls = b.fill >= 80 ? "full" : b.fill >= 50 ? "half" : "ok", col = b.fill >= 80 ? "#d9382f" : b.fill >= 50 ? "#e0b100" : "#2a9d54";
    return `<div class="item ${cls === "full" ? "notworking" : cls === "half" ? "maintenance" : "working"}">
      <div class="row"><b>${esc(b.name)}</b><span class="badge ${cls}">${b.fill >= 80 ? "Full" : b.fill >= 50 ? "Half full" : "OK"} • ${b.fill}%</span></div>
      <div class="fillbar"><i style="width:${b.fill}%;background:${col}"></i></div>
      <div class="muted small">${BLOCKS[b.block].name} • ${metres(b.dist)} m away</div>
      <div class="acts"><button class="btn sm green" data-bdir="${b.id}">Directions</button>
      <button class="btn sm orange" data-bover="${b.id}">Report overflowing</button></div></div>`;
  }).join("");
  $$("[data-bdir]").forEach(b => b.onclick = () => { directionsTo("bin", db.bins.find(x => x.id === b.dataset.bdir)); renderBottle(); });
  $$("[data-bover]").forEach(b => b.onclick = () => go("report", "bin=" + b.dataset.bover));
  const ri = $("#routeInfo2");
  if (state.route && state.route.mode === "bin") { ri.innerHTML = routeText("bin"); ri.classList.remove("hidden"); } else ri.classList.add("hidden");

  const board = Object.entries(db.eco).sort((a, b) => b[1] - a[1]).slice(0, 8);
  $("#ecoBoard").innerHTML = board.length ? board.map(([n, p]) => `<li><b>${esc(n)}</b> – ${p} pts</li>`).join("") : `<li class="muted">No entries yet – be the first!</li>`;
}

/* ---------- REPORT ---------- */
let photoData = null;
function renderReport(q) {
  const loc = $("#rLocation");
  loc.innerHTML = `<optgroup label="Water points">${db.wps.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("")}</optgroup>
                   <optgroup label="Bottle bins">${db.bins.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join("")}</optgroup>`;
  const params = new URLSearchParams(q || "");
  if (params.get("wp")) { loc.value = params.get("wp"); toast("Opened from QR: " + locationName(params.get("wp"))); }
  if (params.get("bin")) { loc.value = params.get("bin"); $("#rType").value = "bin"; }
}
function resizeImage(file, cb) {
  const fr = new FileReader();
  fr.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 600, k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas"); c.width = img.width * k; c.height = img.height * k;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL("image/jpeg", 0.6));
    };
    img.src = fr.result;
  };
  fr.readAsDataURL(file);
}
function newComplaintId() {
  const d = new Date(), md = String(d.getDate()).padStart(2, "0") + String(d.getMonth() + 1).padStart(2, "0");
  let id; do { id = `AQ-${md}-${Math.floor(1000 + Math.random() * 9000)}`; } while (db.complaints.some(c => c.id === id));
  return id;
}
function trackComplaint(id) {
  const c = db.complaints.find(x => x.id.toLowerCase() === id.trim().toLowerCase());
  const out = $("#trackResult");
  if (!c) { out.innerHTML = `<p class="muted">No complaint found with that ID.</p>`; return; }
  const idx = ["Pending", "In Progress", "Resolved"].indexOf(c.status);
  out.innerHTML = `<p><b>${c.id}</b> – ${TYPES[c.type].label}<br>📍 ${esc(locationName(c.location))}<br>Priority: <span class="badge ${{High:"hi",Medium:"med",Low:"lo"}[c.priority]}">${c.priority}</span><br>
    <span class="muted small">Filed ${fmtDate(c.created)}${c.updated ? " • Updated " + fmtDate(c.updated) : ""}</span></p>
    <div class="timeline">${["Pending", "In Progress", "Resolved"].map((s, i) => `<div class="${i < idx || (i === idx && idx === 2) ? "done" : i === idx ? "cur" : ""}">${s}</div>`).join("")}</div>`;
}

/* ---------- FEEDBACK ---------- */
function renderFeedback() {
  $("#fbWp").innerHTML = db.wps.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  const draw = () => $("#fbStars").innerHTML = [1,2,3,4,5].map(i => `<span data-s="${i}" class="${i <= state.fbRating ? "on" : ""}">★</span>`).join("");
  draw();
  $$("#fbStars span").forEach(s => s.onclick = () => { state.fbRating = +s.dataset.s; renderFeedback(); });
  $("#fbList").innerHTML = db.feedback.length ? db.feedback.slice().reverse().slice(0, 8).map(f => `
    <div class="fb"><b>${esc(locationName(f.wp))}</b> ${starsHtml(f.rating)}<br>
    <span class="muted small">${f.clean} • ${f.taste} • ${fmtDate(f.date)}</span>${f.text ? `<br>${esc(f.text)}` : ""}</div>`).join("")
    : `<p class="muted">No feedback yet.</p>`;
}

/* ---------- ABOUT ---------- */
function renderAbout() { $("#tipsAbout").innerHTML = TIPS.map(t => `<div class="tip">💧 ${t}</div>`).join(""); }

/* ---------- ADMIN ---------- */
function renderAdmin() {
  if (!state.adminOk) return;
  const cs = db.complaints.slice().sort((a, b) => (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]) || (b.created - a.created));
  const cnt = s => db.complaints.filter(c => c.status === s).length;
  const qrBase = location.href.split("#")[0];
  $("#adminBody").innerHTML = `
    <div class="admin-stats">
      <div class="stat"><b>${db.complaints.length}</b>Total complaints</div>
      <div class="stat"><b>${cnt("Pending")}</b>Pending</div>
      <div class="stat"><b>${cnt("In Progress")}</b>In progress</div>
      <div class="stat"><b>${cnt("Resolved")}</b>Resolved</div>
      <div class="stat"><b>${db.bins.filter(b => b.fill >= 80).length}</b>Bins nearly full</div>
    </div>

    <h2 class="section-title">Complaints (urgent first)</h2>
    <div class="table-wrap"><table>
      <tr><th>ID</th><th>Priority</th><th>Problem</th><th>Location</th><th>Details</th><th>Photo</th><th>Status</th></tr>
      ${cs.length ? cs.map(c => `<tr>
        <td><b>${c.id}</b><br><span class="muted small">${fmtDate(c.created)}</span></td>
        <td><span class="badge ${{High:"hi",Medium:"med",Low:"lo"}[c.priority]}">${c.priority}</span></td>
        <td>${TYPES[c.type].label}</td><td>${esc(locationName(c.location))}</td>
        <td>${esc(c.desc) || "—"}<br><span class="muted small">${esc(c.name || "Anonymous")}</span></td>
        <td>${c.photo ? `<img class="thumb" src="${c.photo}" onclick="window.open(this.src)">` : "—"}</td>
        <td><select data-cs="${c.id}">${["Pending", "In Progress", "Resolved"].map(s => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")
        : `<tr><td colspan="7" class="muted">No complaints yet.</td></tr>`}
    </table></div>

    <h2 class="section-title">Manage water points</h2>
    <div class="table-wrap"><table>
      <tr><th>Water point</th><th>Status</th><th>Availability</th></tr>
      ${db.wps.map(w => `<tr><td>${esc(w.name)}<br><span class="muted small">${w.id}</span></td>
        <td><select data-ws="${w.id}">${Object.entries(STATUS_LABEL).map(([k, v]) => `<option value="${k}" ${k === w.status ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td><select data-wa="${w.id}">${["High", "Medium", "Low", "Empty"].map(a => `<option ${a === w.avail ? "selected" : ""}>${a}</option>`).join("")}</select></td></tr>`).join("")}
    </table></div>

    <h2 class="section-title">Manage bottle bins</h2>
    <div class="table-wrap"><table>
      <tr><th>Bin</th><th>Fill level</th><th>Action</th></tr>
      ${db.bins.map(b => `<tr><td>${esc(b.name)}</td><td>${b.fill}%</td><td><button class="btn sm green" data-empty="${b.id}">Mark emptied</button></td></tr>`).join("")}
    </table></div>

    <h2 class="section-title">Printable QR codes (one per water point)</h2>
    <div class="qr-grid">${db.wps.map(w => `<div class="panel"><img width="130" height="130" alt="QR ${w.id}" src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(qrBase + "#report?wp=" + w.id)}"><br><b>${w.id}</b><br>${esc(w.name)}</div>`).join("")}</div>
    <p class="muted small">Tip: for phones to open these QR codes, host the site online (e.g. Firebase Hosting or GitHub Pages).</p>
    <p><button class="btn red sm" id="resetDemo">Reset all demo data</button> <button class="btn ghost sm" id="logout">Log out</button></p>`;

  $$("[data-cs]").forEach(s => s.onchange = () => setComplaintStatus(s.dataset.cs, s.value));
  $$("[data-ws]").forEach(s => s.onchange = () => { const w = db.wps.find(x => x.id === s.dataset.ws); w.status = s.value; w.crowd = false; db.votes[w.id] = { w: 0, n: 0 }; save(); toast("Status updated"); });
  $$("[data-wa]").forEach(s => s.onchange = () => { db.wps.find(x => x.id === s.dataset.wa).avail = s.value; save(); toast("Availability updated"); });
  $$("[data-empty]").forEach(b => b.onclick = () => { db.bins.find(x => x.id === b.dataset.empty).fill = 0; save(); renderAdmin(); });
  $("#resetDemo").onclick = () => { if (confirm("Delete all data and restore demo defaults?")) { localStorage.removeItem(STORE_KEY); load(); renderAdmin(); updateBell(); toast("Reset done"); } };
  $("#logout").onclick = () => { state.adminOk = false; go("home"); };
}
function setComplaintStatus(id, status) {
  const c = db.complaints.find(x => x.id === id); c.status = status; c.updated = Date.now();
  if (status === "Resolved") {
    db.notifications.push({ id: Date.now(), text: `✅ Your complaint ${c.id} (${TYPES[c.type].label}) at ${locationName(c.location)} has been resolved.`, date: Date.now(), read: false });
    if (c.type === "bin") { const b = db.bins.find(x => x.id === c.location); if (b) b.fill = 0; }
  }
  save(); updateBell(); renderAdmin(); toast("Complaint " + id + " → " + status);
}

/* ---------- Notifications ---------- */
function updateBell() {
  const n = db.notifications.filter(x => !x.read).length;
  const el = $("#bellCount"); el.textContent = n; el.classList.toggle("hidden", !n);
  $("#notifPanel").innerHTML = db.notifications.length
    ? db.notifications.slice().reverse().map(x => `<div class="n ${x.read ? "" : "unread"}">${esc(x.text)}<div class="muted small">${fmtDate(x.date)}</div></div>`).join("")
    : `<div class="n muted">No notifications yet. You'll be notified when your complaint is resolved.</div>`;
}

/* ---------- Init & events ---------- */
function init() {
  load();
  $$("[data-go]").forEach(a => a.addEventListener("click", () => go(a.dataset.go)));
  $("#burger").onclick = () => $("#nav").classList.toggle("open");
  $("#bell").onclick = () => {
    const p = $("#notifPanel"); p.classList.toggle("hidden");
    if (!p.classList.contains("hidden")) { db.notifications.forEach(n => n.read = true); save(); setTimeout(() => { $("#bellCount").classList.add("hidden"); }, 50); }
    else updateBell();
  };

  $("#myBlock").onchange = e => { state.block = e.target.value; state.route = null; renderFind(); };
  $("#myBlock2").onchange = e => { state.block = e.target.value; state.route = null; renderBottle(); };
  $("#wpSearch").oninput = e => { state.search = e.target.value; renderFind(); $("#wpSearch").focus(); };
  $("#wpFilter").onchange = e => { state.filter = e.target.value; renderFind(); };
  $("#heatToggle").onchange = e => { state.heat = e.target.checked; renderFind(); };
  $("#nearestBtn").onclick = () => {
    const n = nearestAvailable();
    if (!n) return toast("No working water point available right now 😟");
    state.selectedWp = n.id; directionsTo("water", n); renderFind(); toast("Nearest available: " + n.name);
  };
  $("#nearestBinBtn").onclick = () => {
    const ok = db.bins.filter(b => b.fill < 80).map(b => ({ ...b, d: route(state.block, b.block).dist })).sort((a, b) => a.d - b.d)[0];
    if (!ok) return toast("All bins are full!");
    directionsTo("bin", ok); renderBottle();
  };

  $("#ecoForm").onsubmit = e => {
    e.preventDefault();
    const name = $("#ecoName").value.trim(), n = +$("#ecoCount").value;
    db.eco[name] = (db.eco[name] || 0) + n * 2;
    // bottles go into the nearest bin
    const bin = db.bins.filter(b => b.block === state.block)[0] || db.bins[0];
    bin.fill = Math.min(100, bin.fill + n * 2);
    save(); toast(`🌱 +${n * 2} eco points for ${name}!`); e.target.reset(); renderBottle();
  };

  $("#rPhoto").onchange = e => {
    const f = e.target.files[0]; photoData = null; $("#rPreview").classList.add("hidden");
    if (f) resizeImage(f, d => { photoData = d; $("#rPreview").src = d; $("#rPreview").classList.remove("hidden"); });
  };
  $("#reportForm").onsubmit = e => {
    e.preventDefault();
    const type = $("#rType").value, id = newComplaintId();
    db.complaints.push({ id, type, location: $("#rLocation").value, name: $("#rName").value.trim(), desc: $("#rDesc").value.trim(),
      photo: photoData, priority: TYPES[type].priority, status: "Pending", created: Date.now() });
    if (type === "bin") { const b = db.bins.find(x => x.id === $("#rLocation").value); if (b) b.fill = Math.max(b.fill, 95); }
    save();
    const r = $("#reportResult");
    r.innerHTML = `<div>✅ Complaint submitted</div><div class="cid">${id}</div><div class="small">Priority: <b>${TYPES[type].priority}</b>. Save this ID to track your complaint.</div>`;
    r.classList.remove("hidden");
    $("#trackId").value = id; trackComplaint(id);
    e.target.reset(); photoData = null; $("#rPreview").classList.add("hidden");
  };
  $("#trackForm").onsubmit = e => { e.preventDefault(); trackComplaint($("#trackId").value); };

  $("#fbForm").onsubmit = e => {
    e.preventDefault();
    const wp = $("#fbWp").value;
    db.feedback.push({ wp, rating: state.fbRating, clean: $("#fbClean").value, taste: $("#fbTaste").value, text: $("#fbText").value.trim(), date: Date.now() });
    (db.ratings[wp] = db.ratings[wp] || []).push(state.fbRating);
    save(); toast("Thanks for your feedback!"); e.target.reset(); state.fbRating = 5; renderFeedback();
  };

  window.addEventListener("storage", () => { load(); updateBell(); });   // sync between tabs
  updateBell();

  const [p, q] = location.hash.slice(1).split("?");
  go(["home","find","bottle","report","feedback","about","admin"].includes(p) ? p : "home", q);
}
document.addEventListener("DOMContentLoaded", init);