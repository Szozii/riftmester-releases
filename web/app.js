"use strict";
/* ================================================================ RiftMester felület */

const DD = "https://ddragon.leagueoflegends.com";
const CDRAGON = "https://raw.communitydragon.org/latest/plugins";
const CDRAGON_SHARD = CDRAGON + "/rcp-be-lol-game-data/global/default/v1/perk-images/statmods/";
const RANK_EMBLEM = (t) => `${CDRAGON}/rcp-fe-lol-static-assets/global/default/images/ranked-emblem/emblem-${t.toLowerCase()}.png`;

const SHARDS = {
  5008: ["Adaptív erő", "statmodsadaptiveforceicon.png", "AE"], 5005: ["Támadási sebesség", "statmodsattackspeedicon.png", "TS"],
  5007: ["Képességgyorsítás", "statmodscdrscalingicon.png", "KGy"], 5010: ["Mozgási sebesség", "statmodsmovementspeedicon.png", "MS"],
  5001: ["Skálázódó életerő", "statmodshealthscalingicon.png", "ÉE+"], 5011: ["Életerő", "statmodshealthplusicon.png", "ÉE"],
  5013: ["Szívósság és lassításellenállás", "statmodstenacityicon.png", "SZ"], 5002: ["Páncél", "statmodsarmoricon.png", "P"],
  5003: ["Mágiaellenállás", "statmodsmagicresicon.magicresist_fix.png", "MR"],
};
const TREE_COLOR = { 8000: "#e4c46b", 8100: "#ef5b5b", 8200: "#9aa8ff", 8300: "#4fd1e0", 8400: "#9be07a" };
const ROLES = { top: "Felső", jungle: "Dzsungel", mid: "Középső", adc: "Alsó (ADC)", support: "Support", aram: "ARAM" };
const RANKS = { emerald_plus: "Smaragd+", platinum_plus: "Platina+", diamond_plus: "Gyémánt+", master_plus: "Mester+", overall: "Összes rang" };
const MODES = { auto: "Auto", solo: "Solo/Duo", flex: "Flex", aram: "ARAM", mayhem: "Mayhem" };
const MODE_LONG = { solo: "Ranked Solo/Duo", flex: "Ranked Flex", aram: "ARAM", mayhem: "ARAM Mayhem" };
const TIERS = { IRON: "Vas", BRONZE: "Bronz", SILVER: "Ezüst", GOLD: "Arany", PLATINUM: "Platina", EMERALD: "Smaragd",
  DIAMOND: "Gyémánt", MASTER: "Mester", GRANDMASTER: "Nagymester", CHALLENGER: "Kihívó" };
const PHASES = { None: "Kliens csatlakozva", Lobby: "Lobbiban", Matchmaking: "Meccskeresés…", ReadyCheck: "Meccs elfogadása",
  ChampSelect: "Hősválasztás", InProgress: "Meccs folyamatban", Reconnect: "Újracsatlakozás", WaitingForStats: "Meccs vége",
  PreEndOfGame: "Meccs vége", EndOfGame: "Meccs vége" };
const SOURCES = { ugg: "U.GG", cache: "Mentett U.GG adat", riot: "Riot kliens ajánlás" };

const ROLE_SVG = {
  top: '<path d="M3 3h13l-4 4H7v5l-4 4z"/><path d="M21 8v13H8l4-4h5v-5z" opacity=".35"/>',
  jungle: '<path d="M12 2c3 4 6 8 3 13-1 2-3 3-3 7-1-4-3-5-4-7C6 10 9 6 12 2z"/>',
  mid: '<path d="M3 17l14-14h4v4L7 21H3z"/><path d="M3 3h8L3 11zM21 21h-8l8-8z" opacity=".35"/>',
  adc: '<path d="M21 21H8l4-4h5v-5l4-4z"/><path d="M3 16V3h13l-4 4H7v5z" opacity=".35"/>',
  support: '<path d="M12 2l8 4v6c0 5-4 9-8 10-4-1-8-5-8-10V6z"/>',
  aram: '<path d="M12 2l10 10-10 10L2 12z"/>',
};
const roleIco = (r) => `<svg class="role-ico" viewBox="0 0 24 24" fill="currentColor">${ROLE_SVG[r] || ROLE_SVG.aram}</svg>`;

const HEALERS = new Set(["Aatrox", "Soraka", "Yuumi", "Vladimir", "Sylas", "Warwick", "DrMundo", "Swain", "Illaoi", "Briar",
  "Olaf", "Nami", "Sona", "Seraphine", "Milio", "Fiora", "Volibear", "Trundle", "Senna", "Gwen", "Viego", "Belveth", "Zac",
  "Fiddlesticks", "Nidalee", "Maokai", "Kayn", "Renekton", "Samira", "Ambessa", "Udyr", "Darius", "Irelia"]);
const SUGGEST = {
  mr: { Marksman: [3156, 3139, 3091], Mage: [3102, 3157], Assassin: [3156, 3814], Fighter: [3156, 3065, 6665, 2504], Tank: [4401, 2504, 3065], Support: [3190, 3222, 3102] },
  armor: { Marksman: [3026, 6333], Mage: [3157, 3026], Assassin: [6333, 3026], Fighter: [6333, 3053, 3742], Tank: [3075, 3143, 3110], Support: [3109, 3110, 3190] },
  heal: { Marksman: [3033, 3123], Mage: [3165, 3916], Assassin: [6609, 3123], Fighter: [6609, 3123, 3075], Tank: [3075, 3076], Support: [3165, 3916] },
  tank: { Marksman: [3036, 3153], Mage: [3135, 6653, 4010], Assassin: [6694, 3071], Fighter: [3071, 6694, 3153], Tank: [6653, 3068], Support: [6653, 3135] },
  bootsAP: [3111], bootsAD: [3047],
};

/* ================================================================ állapot */
const S = {
  st: null, lcu: null, appVersion: null, page: "build", champKey: null, fromClient: false, lastClientChamp: null,
  role: "auto", rank: load("rank", "emerald_plus"), mode: load("mode", "auto"), build: null, detail: null,
  collapsed: load("collapsed", {}), gameCollapse: null, req: 0, shownUpdate: false,
  stats: null, statsQueue: load("statsQueue", "all"), settings: null, itemView: load("itemView", "both"),
};
function load(k, d) { try { const v = localStorage.getItem("rm_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
function save(k, v) { try { localStorage.setItem("rm_" + k, JSON.stringify(v)); } catch (e) { /* nem baj */ } }
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => Number(n || 0).toLocaleString(LANG === "en" ? "en-US" : "hu-HU");
const wrCls = (w) => (w >= 52 ? "g" : w >= 49 ? "m" : "b");
const wrHtml = (w) => (w ? `<span class="wr ${wrCls(w)}">${Number(w).toFixed(1)}%</span>` : `<span class="wr">–</span>`);
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");
const champ = (key) => (S.st && S.st.champions[key]) || null;

class ApiError extends Error { constructor(j) { super(j.error || t("Ismeretlen hiba")); this.info = j; } }
async function api(path, opts) {
  const r = await fetch(path, opts);
  const j = await r.json();
  if (!r.ok) throw new ApiError(j);
  return j;
}
const post = (path, body) => api(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) });

/* ================================================================ képek */
const V = () => S.st.version;
const champImg = (id) => `${DD}/cdn/${V()}/img/champion/${id}.png`;
const splashImg = (id) => `${DD}/cdn/img/champion/splash/${id}_0.jpg`;
const itemImg = (id) => `${DD}/cdn/${V()}/img/item/${id}.png`;
const spellImg = (f) => `${DD}/cdn/${V()}/img/spell/${f}`;
const passiveImg = (f) => `${DD}/cdn/${V()}/img/passive/${f}`;
const runeImg = (icon) => `${DD}/cdn/img/${icon}`;
const profileImg = (id) => `${DD}/cdn/${V()}/img/profileicon/${id}.png`;

/* ================================================================ élő meccs segédek */
const inGame = () => !!(S.lcu && S.lcu.inGame);
const owned = () => new Set((S.lcu && S.lcu.myItems) || []);

function itemIc(id, cls = "", extra = "") {
  const own = inGame() && owned().has(String(id)) ? " owned" : "";
  return `<div class="ic ${cls}${own}" data-tt="item:${id}"><img src="${itemImg(id)}" alt="" loading="lazy">${extra}</div>`;
}

/* ================================================================ indulás */
function translateConsts() {
  for (const o of [ROLES, RANKS, TIERS, PHASES, SOURCES, ITEM_VIEWS]) for (const k in o) o[k] = t(o[k]);
  for (const k in SHARDS) SHARDS[k][0] = t(SHARDS[k][0]);
}

async function init() {
  try { const s = await api("/api/settings"); LANG = s.ui_lang === "en" ? "en" : "hu"; } catch (e) { /* alap: magyar */ }
  translateConsts();
  applyStaticI18n();
  setupLang();
  setupNav();
  setupDropdowns();
  setupTooltip();
  setupSettings();
  renderModeTabs();
  try { S.st = await api("/api/static"); } catch (e) {
    $("#placeholderText").innerHTML = `<span class="err">${t("Nem sikerült letölteni az alapadatokat.")}</span><br>${t("Van internet?")} (${esc(e.message)})<br>${t("Újrapróbálom…")}`;
    setTimeout(() => location.reload(), 5000);
    return;
  }
  S.runeById = {}; S.treeById = {};
  for (const t of S.st.runes) { S.treeById[t.id] = t; t.slots.forEach((sl) => sl.forEach((r) => (S.runeById[r.id] = r))); }
  S.champList = Object.entries(S.st.champions).map(([key, c]) => ({ key, ...c })).sort((a, b) => a.name.localeCompare(b.name, LANG));
  renderChampList("");
  renderStaticMenus();
  $("#placeholderText").textContent = t("Lépj be a hősválasztásba, vagy válassz hőst – akár a kedvenceid közül.");
  $("#placeholder .spinner").style.display = "none";
  showPage("stats");
  pollState();
  setInterval(pollState, 1500);
  setInterval(() => { if (S.page === "cs") pollCS(); }, 1000);
  setInterval(() => { if (S.page === "ingame" || (S.lcu && S.lcu.inGame)) pollIG(); }, 2500);
  setInterval(tickTimer, 250);
  loadStats();
  setInterval(loadStats, 120000);
}

function setupLang() {
  const b = $("#langBtn");
  if (!b) return;
  b.textContent = LANG === "en" ? "EN" : "HU";
  b.title = LANG === "en" ? "Magyar nyelvre váltás" : "Switch to English";
  b.onclick = () => switchLang(LANG === "en" ? "hu" : "en");
}
async function switchLang(l) {
  if (l === LANG) return;
  try { await post("/api/settings", { ui_lang: l }); } catch (e) { toast(e.message, true); return; }
  location.reload();
}

function setupNav() {
  document.querySelectorAll(".nav-btn").forEach((b) => (b.onclick = () => showPage(b.dataset.page)));
}
function showPage(p) {
  S.page = p;
  document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("on", b.dataset.page === p));
  $("#page-build").hidden = p !== "build";
  $("#page-stats").hidden = p !== "stats";
  $("#page-cs").hidden = p !== "cs";
  $("#page-ingame").hidden = p !== "ingame";
  if (p === "ingame") { renderIG(); pollIG(); }
  if (p === "stats") { renderStats(); loadStats(); }
  if (p === "cs") { renderCS(); pollCS(); }
  window.scrollTo(0, 0);
}

/* ================================================================ kliens állapot */
async function pollState() {
  let st;
  try { st = await api("/api/state"); S.downSince = 0; } catch (e) {
    S.downSince = S.downSince || Date.now();
    const long = Date.now() - S.downSince > 60000;
    setStatus("off", t(long ? "A program nem indult újra – indítsd el újra (INDITAS.bat vagy a LoL indítása)." : S.updating ? "Frissítés: újraindulás…" : "A háttérprogram nem fut / újraindul…"));
    return;
  }
  const prev = S.lcu;
  S.lcu = st;
  const ver = st.app && st.app.version;
  if (S.appVersion && ver && ver !== S.appVersion) { location.reload(); return; }
  S.appVersion = ver;
  renderUpdateBanner(st.app && st.app.update);

  if (!st.connected) setStatus("off", t("Várakozás a LoL kliensre…"));
  else if (st.phase === "ChampSelect") setStatus("select", t("Hősválasztás") + (st.queueMode ? " · " + MODE_LONG[st.queueMode] : ""));
  else if (st.inGame) setStatus("game", t("Meccs folyamatban") + (st.level ? " · " + t("{n}. szint", { n: st.level }) : ""));
  else setStatus("on", PHASES[st.phase] || t("Kliens csatlakozva"));
  renderModeTabs();
  updateIgTab(st);

  let reload = false;
  if (st.championKey && st.championKey !== S.lastClientChamp) {
    S.lastClientChamp = st.championKey; S.champKey = st.championKey; S.fromClient = true; S.role = "auto"; reload = true;
  }
  if (S.fromClient && prev && prev.position !== st.position && S.role === "auto") reload = true;
  if (S.mode === "auto" && prev && prev.queueMode !== st.queueMode && st.queueMode) reload = true;

  // automatikus fülváltás:
  //  - az app indulásakor: Statisztika (hősválasztásban: Hősválasztás, lezárt hősnél vagy meccs közben: Build)
  //  - hősválasztás kezdetén: Hősválasztás
  //  - amikor lezárod a hősödet (Summoner's Riften): Build
  //  - meccs kezdetén: Build
  const aramLike = ["aram", "mayhem"].includes(st.queueMode);
  if (!S.firstPageDone) {
    S.firstPageDone = true;
    if (st.inGame) showPage("ingame");
    else if (st.phase === "ChampSelect" && st.lockedKey && !aramLike) showPage("build");
    else if (st.phase === "ChampSelect") showPage("cs");
  } else {
    if (st.phase === "ChampSelect" && (!prev || prev.phase !== "ChampSelect") && load("autoCsTab", true)) showPage("cs");
    if (st.phase === "ChampSelect" && st.lockedKey && (!prev || prev.lockedKey !== st.lockedKey) && !aramLike && S.page === "cs") showPage("build");
    if (st.inGame && (!prev || !prev.inGame)) showPage("ingame");
  }
  const wasIn = !!(prev && prev.inGame), isIn = !!st.inGame;
  if (wasIn !== isIn) {
    S.gameCollapse = isIn && st.app && st.app.autoCollapse ? { runes: true, tips: true, items: false, enemy: false } : null;
    if (!isIn) setTimeout(loadStats, 15000);
    if (S.build && !reload) rerender();
  }
  if (reload) { loadBuild(); return; }
  if (!S.build) return;

  const ch = (k) => JSON.stringify((prev && prev[k]) || null) !== JSON.stringify(st[k] || null);
  if (ch("myItems") || ch("level") || ch("autoImport") || ch("enemies")) rerender();
}

function updateIgTab(st) {
  const b = document.querySelector(".nav-btn.ig");
  const show = !!(st && st.inGame);
  if (b) b.hidden = !show;
  if (!show && S.page === "ingame") showPage(S.build ? "build" : "stats");
}

function setStatus(cls, text) {
  $("#status").className = "status " + cls;
  $("#statusText").innerHTML = `<span>${esc(text)}</span>`;
}

/* ================================================================ build betöltés */
function effRole() { return S.role !== "auto" ? S.role : (S.fromClient && S.lcu && S.lcu.position) || "auto"; }
function effMode() { return S.mode !== "auto" ? S.mode : (S.lcu && S.lcu.queueMode) || "solo"; }

async function loadBuild() {
  if (!S.champKey || !S.st) return;
  const c = champ(S.champKey);
  if (!c) return;
  const my = ++S.req;
  renderHero(c);
  renderFavs();
  $("#content").innerHTML = `<div class="placeholder"><div class="spinner"></div><p>${esc(t("{champ} · {mode} build betöltése…", { champ: c.name, mode: MODE_LONG[effMode()] }))}</p></div>`;
  try {
    const q = new URLSearchParams({ champ: S.champKey, role: effRole(), rank: S.rank, mode: effMode() });
    const [b, d] = await Promise.all([api("/api/build?" + q), api("/api/champion?id=" + encodeURIComponent(c.id)).catch(() => null)]);
    if (my !== S.req) return;
    S.build = b; S.detail = d;
    render();
  } catch (e) {
    if (my !== S.req) return;
    S.build = null;
    showError(e);
  }
}

function showError(e) {
  const info = e.info || { error: e.message };
  const text = [`${t("Hiba")}: ${info.error || e.message}`,
    `${t("Verzió")}: ${info.version || S.appVersion || "?"}  Patch: ${info.patch || (S.st && S.st.version) || "?"}`,
    `${t("Hős")}: ${S.champKey}  ${t("Mód")}: ${effMode()}  ${t("Pozíció")}: ${effRole()}  ${t("Rang")}: ${S.rank}`,
    info.path ? `${t("Kérés")}: ${info.path}` : "", info.detail ? `${t("Részletek")}:\n${info.detail}` : ""].filter(Boolean).join("\n");
  $("#content").innerHTML = `<div class="errbox glass"><h3>⚠ ${t("Nem jött le a build")}</h3>
    <div style="font-size:12px;margin-bottom:6px">${esc(info.error || e.message)}</div><pre>${esc(text)}</pre>
    <div class="row"><button class="btn small" id="copyErr">📋 ${t("Hiba másolása")}</button><button class="btn small" id="retryErr">↻ ${t("Újra")}</button></div>
    <div style="font-size:11px;color:var(--muted);margin-top:8px">${t("A másolt szöveget küldd el, és könnyen javítható.")}</div></div>`;
  $("#retryErr").onclick = loadBuild;
  $("#copyErr").onclick = () => copyText(text);
}
async function copyText(txt) {
  try { await navigator.clipboard.writeText(txt); toast(t("Kimásolva a vágólapra ✔")); }
  catch (e) {
    const ta = document.createElement("textarea"); ta.value = txt; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast(t("Kimásolva ✔")); } catch (e2) { toast(t("Nem sikerült másolni"), true); }
    ta.remove();
  }
}

/* ================================================================ megjelenítés */
const proxied = (u) => "/api/img?u=" + encodeURIComponent(u);
const loadingImg = (id) => `${DD}/cdn/img/champion/loading/${id}_0.jpg`;
function setAccent(color) { /* régi: rúnafa szín – a hős színe felülírja */ }

/** A hős splash képéből kiszámolja a két legjellemzőbb élénk színt, és ezekkel színezi a felületet. */
const THEME_CACHE = {};
function applyTheme(t) {
  const r = document.documentElement.style;
  r.setProperty("--champ", t.a); r.setProperty("--champ2", t.b);
  r.setProperty("--champ-rgb", t.argb); r.setProperty("--accent", t.a);
}
function themeFor(c) {
  if (THEME_CACHE[c.id]) return applyTheme(THEME_CACHE[c.id]);
  const img = new Image();
  img.onload = () => {
    try {
      const cv = document.createElement("canvas"); cv.width = 64; cv.height = 38;
      const x = cv.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0, 64, 38);
      const d = x.getImageData(0, 0, 64, 38).data, bins = Array.from({ length: 24 }, () => [0, 0, 0, 0]);
      for (let i = 0; i < d.length; i += 4) {
        const R = d[i] / 255, G = d[i + 1] / 255, B = d[i + 2] / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), v = mx, sat = mx ? (mx - mn) / mx : 0;
        if (sat < 0.3 || v < 0.3) continue;
        let h = 0; const dd = mx - mn;
        if (dd) h = mx === R ? ((G - B) / dd) % 6 : mx === G ? (B - R) / dd + 2 : (R - G) / dd + 4;
        const bin = Math.floor((((h * 60) + 360) % 360) / 15), w = sat * sat * v;
        bins[bin][0] += d[i] * w; bins[bin][1] += d[i + 1] * w; bins[bin][2] += d[i + 2] * w; bins[bin][3] += w;
      }
      const order = bins.map((b, i) => [i, b[3]]).sort((a, b) => b[1] - a[1]);
      const col = (i) => { const b = bins[i]; return b[3] ? [b[0] / b[3], b[1] / b[3], b[2] / b[3]] : [200, 170, 110]; };
      const lift = ([r, g, b]) => { const m = Math.max(r, g, b) || 1, k = Math.min(1.6, 235 / m); return [r * k, g * k, b * k].map((v) => Math.round(Math.min(255, v))); };
      const a = lift(col(order[0][0]));
      const second = order.find(([i, w]) => w > 0 && Math.min(Math.abs(i - order[0][0]), 24 - Math.abs(i - order[0][0])) >= 4);
      const b = second ? lift(col(second[0])) : [10, 200, 185];
      const t = { a: `rgb(${a})`, b: `rgb(${b})`, argb: a.join(",") };
      THEME_CACHE[c.id] = t; applyTheme(t);
    } catch (e) { /* ha nem sikerül, marad az alap arany */ }
  };
  img.src = proxied(splashImg(c.id));
}
function renderHero(c) {
  const sp = `url("${proxied(splashImg(c.id))}")`;
  $("#heroImg").style.backgroundImage = sp;
  $("#bgImg").style.backgroundImage = sp;
  $("#champName").textContent = c.name;
  $("#champTitle").textContent = c.title;
  $("#ddChampVal").innerHTML = `<img src="${champImg(c.id)}" alt="">${esc(c.name)}`;
  $("#badges").innerHTML = "";
  $("#heroAbil").innerHTML = "";
  themeFor(c);
}
function renderAbilities() {
  const d = S.detail, el = $("#heroAbil");
  if (!d) { el.innerHTML = ""; return; }
  const maxed = (S.build && S.build.skills && S.build.skills.max) || [];
  const pas = `<div class="ab" data-tt="passive:P"><img src="${passiveImg(d.passive.image)}" alt=""><i>P</i></div>`;
  el.innerHTML = pas + d.spells.map((sp) => {
    const rank = maxed.indexOf(sp.key);
    return `<div class="ab ${sp.key === "R" ? "ult" : ""} ${rank === 0 ? "first" : ""}" data-tt="skill:${sp.key}"><img src="${spellImg(sp.image)}" alt=""><i>${sp.key}</i>${rank >= 0 ? `<b>${rank + 1}.</b>` : ""}</div>`;
  }).join("");
}
function rerender() { const y = window.scrollY; render(); window.scrollTo(0, y); }

function render() {
  const b = S.build, c = champ(S.champKey);
  if (!b || !c) return;
  renderHero(c);
  renderAbilities();
  const badges = [`<span class="badge acc">${roleIco(b.role)}${ROLES[b.role] || b.role}</span>`, `<span class="badge">${esc(MODE_LONG[b.mode] || b.mode)}</span>`];
  badges.push(`<span class="badge">Patch <b>${esc(b.patch)}</b></span>`);
  if (b.lowSample || (b.total && b.total.games && b.total.games < 200)) badges.push(`<span class="badge warn">${t("Kevés adat")}</span>`);
  $("#badges").innerHTML = badges.join("");
  $("#heroWr").innerHTML = b.total && b.total.games ? `<b class="${"wr " + wrCls(b.total.wr)}">${b.total.wr.toFixed(1)}%</b><span>${fmt(b.total.games)} ${t("meccs")}</span>` : "";
  $("#ddRoleVal").innerHTML = `${roleIco(b.role)}${S.role === "auto" ? "Auto · " : ""}${ROLES[b.role] || b.role}`;
  $("#ddRankVal").textContent = RANKS[b.rankUsed] || RANKS[S.rank];
  renderRoleMenu(); renderModeTabs(); renderFavs();

  const notes = (b.notes || []).map((n) => `<div class="note">⚠ <span>${esc(n)}</span></div>`).join("");
  const order = inGame() ? [cardItems, cardLoadout, cardSkills, cardRunes] : [cardLoadout, cardItems, cardSkills, cardRunes];
  $("#content").innerHTML = notes + order.map((f) => f()).join("") + `<div id="enemySlot"></div>` + cardTips();
  const src = SOURCES[b.source] || b.source;
  $("#footer").textContent = `${t("Forrás")}: ${src}${b.stale ? " (" + b.stale + ")" : ""} · Patch ${b.patch} · ${RANKS[b.rankUsed] || ""} · RiftMester v${S.appVersion || ""}`;
  renderEnemyCard();
  bindCards();
}
function isCollapsed(id) { return S.gameCollapse && id in S.gameCollapse ? S.gameCollapse[id] : !!S.collapsed[id]; }
function card(id, title, icon, meta, body) {
  return `<section class="card glass${isCollapsed(id) ? " collapsed" : ""}" data-card="${id}">
    <div class="card-h"><div class="ico">${icon}</div><h2>${title}</h2><span class="meta">${meta || ""}</span><i class="chev"></i></div>
    <div class="card-b">${body}</div></section>`;
}

/* ---------- rúnák */
function cardLoadout() {
  const b = S.build, d = S.detail, r = b.runes;
  const ks = r && S.runeById[r.primaryPerks[0]];
  const pt = r && S.treeById[r.primary], st = r && S.treeById[r.sub];
  const key = ks ? `<div class="lo-key" style="--tree:${TREE_COLOR[r.primary] || "#c8aa6e"}" data-tt="rune:${ks.id}">
      <div class="hexring"><img src="${runeImg(ks.icon)}" alt=""></div>
      <div class="lo-kt"><span>${esc(pt ? pt.name : "")}</span><b>${esc(ks.name)}</b></div></div>` : "";
  const minor = r ? `<div class="lo-minor">${r.primaryPerks.slice(1).map((id) => { const x = S.runeById[id]; return x ? `<img data-tt="rune:${id}" src="${runeImg(x.icon)}" alt="">` : ""; }).join("")}
      <i class="sep"></i>${st ? `<img class="tree" src="${runeImg(st.icon)}" alt="" title="${esc(st.name)}">` : ""}${r.subPerks.map((id) => { const x = S.runeById[id]; return x ? `<img data-tt="rune:${id}" src="${runeImg(x.icon)}" alt="">` : ""; }).join("")}</div>` : "";
  const spells = b.spells ? `<div class="lo-spells">${orderedSpells(b.spells.ids).map((id, i) => { const sp = S.st.spells[id]; return sp ? `<div class="sp" data-tt="spell:${id}"><img src="${spellImg(sp.image)}" alt=""><i class="key">${i ? "F" : "D"}</i><span>${esc(sp.name)}</span></div>` : ""; }).join("")}</div>` : "";
  let max = "";
  if (b.skills && b.skills.max.length) {
    const lvl = inGame() ? S.lcu.level || 0 : 0;
    const next = lvl ? (b.skills.order[lvl - 1] || "") : "";
    const ic = (k) => { const sp = d && d.spells.find((x) => x.key === k); return `<div class="mx ${k === next ? "now" : ""}" data-tt="skill:${k}">${sp ? `<img src="${spellImg(sp.image)}" alt="">` : ""}<i>${k}</i></div>`; };
    const rLv = b.skills.order.map((k, i) => (k === "R" ? i + 1 : 0)).filter(Boolean).slice(0, 3);
    max = `<div class="lo-max"><span class="lbl">${t("Maxolás")}</span>${b.skills.max.map(ic).join('<i class="chev2"></i>')}
      <span class="ult">R: ${rLv.join(" · ") || "6 · 11 · 16"}</span>
      ${next ? `<span class="now-hint">${t("{lvl}. szint", { lvl })}: <b>${next}</b></span>` : ""}</div>`;
  }
  const ai = S.lcu && S.lcu.autoImport;
  let auto = "";
  if (ai && ai.champ === S.champKey && (ai.runes || ai.items || ai.error)) {
    const ok = (ai.runes === "ok" || ai.runes == null) && (ai.items === "ok" || ai.items == null) && !ai.error;
    const parts = [];
    if (ai.runes) parts.push(ai.runes === "ok" ? t("rúnák betöltve") : t("rúnák") + ": " + ai.runes);
    if (ai.spells) parts.push(ai.spells === "ok" ? t("idézőigék beállítva") : t("idézőigék") + ": " + ai.spells);
    if (ai.items) parts.push(ai.items === "ok" ? t("build a játékban (bolt → ajánlott)") : t("tárgylista") + ": " + ai.items);
    if (ai.error) parts.push(ai.error);
    auto = `<div class="auto-st ${ok && (ai.spells === "ok" || ai.spells == null) ? "" : "bad"}">${ok ? "✓" : "⚠"} ${t("Automatikusan")}: ${esc(parts.join(" · "))}</div>`;
  }
  return `<section class="card glass loadout" data-card="loadout">
    <div class="lo-top">${key}${spells}</div>${minor}${max}${auto}
    <div class="lo-act"><button class="btn" id="importBtn">⬇ ${t("Rúnák")}</button><button class="btn" id="spellsBtn">⬇ ${t("Idézőigék")}</button><button class="btn" id="itemsetBtn">⬇ ${t("Build")}</button></div>
  </section>`;
}

/** A Flash a beállított billentyűre (D vagy F) kerül – ugyanígy, ahogy a kliensbe is beállítjuk. */
function orderedSpells(ids) {
  ids = (ids || []).map(String).slice(0, 2);
  const fk = (S.lcu && S.lcu.app && S.lcu.app.flashKey) || "D";
  if (ids.length === 2 && ids.includes("4")) { const o = ids[0] === "4" ? ids[1] : ids[0]; return fk === "D" ? ["4", o] : [o, "4"]; }
  return ids;
}
async function setSpells() {
  const b = S.build;
  if (!b || !b.spells) return;
  try { const r = await post("/api/set-spells", { ids: b.spells.ids }); toast(r.ok ? t("✔ Idézőigék beállítva!") : r.error, !r.ok); } catch (e) { toast(e.message, true); }
}

function cardRunes() {
  const r = S.build.runes;
  if (!r || !S.treeById[r.primary] || !S.treeById[r.sub]) return "";
  const pt = S.treeById[r.primary], st = S.treeById[r.sub];
  const sel = new Set([...r.primaryPerks, ...r.subPerks]);
  const runeEl = (x) => `<div class="rune ${sel.has(x.id) ? "on" : ""}" data-tt="rune:${x.id}"><img src="${runeImg(x.icon)}" alt="" loading="lazy"></div>`;
  const tree = (tr, rows, prim) => `<div class="tree" style="--tree:${TREE_COLOR[tr.id] || "#c8aa6e"}">
      <div class="tree-h"><img src="${runeImg(tr.icon)}" alt=""><span style="color:${TREE_COLOR[tr.id]}">${esc(tr.name)}</span></div>
      ${rows.map((sl, i) => `<div class="rrow ${prim && i === 0 ? "key" : ""}">${sl.map(runeEl).join("")}</div>`).join("")}
      ${prim ? "" : shardsHtml()}</div>`;
  if (S.collapsed.runes === undefined) S.collapsed.runes = true;
  return card("runes", t("Teljes rúnalap"), `<img src="${runeImg(pt.icon)}" alt="">`, r.games ? `${wrHtml(r.wr)} · ${fmt(r.games)} ${t("meccs")}` : "",
    `<div class="rune-wrap">${tree(pt, pt.slots, true)}${tree(st, st.slots.slice(1), false)}</div>`);
}
function shardsHtml() {
  const s = S.build.shards;
  if (!s) return "";
  return `<div class="shards">${s.ids.map((id) => {
    const d = SHARDS[id] || [`Statmod ${id}`, "", "?"];
    return `<div class="shard" data-tt="shard:${id}"><img src="${CDRAGON_SHARD}${d[1]}" alt="" onerror="this.outerHTML='<span class=&quot;sh-fallback&quot;>${d[2]}</span>'">${esc(d[0])}</div>`;
  }).join("")}</div>`;
}

/* ---------- tárgyak: alap (U.GG) és ellenfél szerinti build */
const ITEM_VIEWS = { std: "Alap (U.GG)", enemy: "Ellenfél ellen", both: "Mindkettő" };
const ANTIHEAL = new Set(["3033", "3123", "3165", "3916", "3075", "3076", "6609"]);
const itemHas = (id, tag) => ((S.st.items[id] || {}).tags || []).includes(tag);

/** Az U.GG alap build 6 helye: 1–3 core, 4–6 a legnépszerűbb választás + 2 alternatíva. */
function standardSlots() {
  const b = S.build;
  const core = (b.core && b.core.ids) || [];
  const slots = [], used = new Set(core);
  core.forEach((id) => slots.push({ type: "core", main: { id }, alts: [] }));
  for (const o of (b.options || []).filter((o) => o && o.length)) {
    if (slots.length >= 6) break;
    const list = o.filter((x) => !used.has(x.id)).slice(0, 3);
    if (!list.length) continue;
    used.add(list[0].id);
    slots.push({ type: "opt", main: list[0], alts: list.slice(1, 3) });
  }
  return slots;
}

/**
 * Ellenfél szerinti build: az alap buildből indul, a core marad, a 4–6. helyre az ellenfél
 * csapatához illő tárgyak kerülnek. Elsősorban az U.GG adatai közül választ (van WR adata),
 * ha ott nincs megfelelő, a RiftMester osztály szerinti javaslatából.
 */
function adaptedBuild(std) {
  const n = enemyNeeds();
  if (!n.n) return null;
  const me = champ(S.champKey) || {}, cls = (me.tags || [])[0] || "Fighter";
  const pool = [];
  (S.build.options || []).forEach((o) => o.forEach((x) => pool.push(x)));
  const taken = new Set(std.filter((s) => s.type === "core").map((s) => s.main.id));
  const reqs = [];
  const heal = { key: "heal", why: t("{n} sokat gyógyító ellenfél → sebkésleltetés", { n: n.heal }), pred: (id) => ANTIHEAL.has(id), fb: SUGGEST.heal[cls] };
  if (n.heal >= 3) reqs.push(heal);
  if (n.mr) reqs.push({ key: "mr", why: t("{n} varázssebző (AP) ellenfél → mágiaellenállás", { n: n.ap }), pred: (id) => itemHas(id, "SpellBlock") && !itemHas(id, "Boots"), fb: SUGGEST.mr[cls] });
  if (n.armor) reqs.push({ key: "armor", why: t("{n} fizikai sebző (AD) ellenfél → páncél", { n: n.ad }), pred: (id) => itemHas(id, "Armor") && !itemHas(id, "Boots"), fb: SUGGEST.armor[cls] });
  if (n.heal === 2) reqs.push(heal);
  if (n.tanks >= 2) reqs.push({ key: "tank", why: t("{n} tank az ellenfélnél → átütés", { n: n.tanks }), pred: (id) => itemHas(id, "ArmorPenetration") || itemHas(id, "MagicPenetration") || (SUGGEST.tank[cls] || []).map(String).includes(id), fb: SUGGEST.tank[cls] });

  const slots = std.map((s) => ({ ...s, alts: [...s.alts] }));
  const free = slots.map((s, i) => (s.type === "opt" ? i : -1)).filter((i) => i >= 0);
  const changes = [], kept = [];
  // 1. kör: amit az alap build már teljesít (core vagy 4–6. hely), az marad – nem cserélünk feleslegesen
  const open = [];
  for (const r of reqs) {
    const coreHit = [...taken].find((id) => r.pred(id));
    if (coreHit) { kept.push({ id: coreHit, why: r.why }); continue; }
    const okIdx = free.find((i) => r.pred(slots[i].main.id));
    if (okIdx !== undefined) { kept.push({ id: slots[okIdx].main.id, why: r.why }); free.splice(free.indexOf(okIdx), 1); taken.add(slots[okIdx].main.id); continue; }
    open.push(r);
  }
  // 2. kör: a többi igényre a szabad 4–6. helyekre kerül illő tárgy
  for (const r of open) {
    const fromData = pool.filter((x) => !taken.has(x.id) && r.pred(x.id)).sort((a, b) => b.games - a.games)[0];
    const fb = (r.fb || []).map(String).find((id) => S.st.items[id] && !taken.has(id));
    const pick = fromData ? { ...fromData, src: "ugg" } : fb ? { id: fb, src: "tipp" } : null;
    if (!pick) continue;
    taken.add(pick.id);
    let idx = free.shift();
    if (idx === undefined) {
      if (slots.length >= 6) continue;
      slots.push({ type: "opt", main: pick, alts: [] });
      idx = slots.length - 1;
      changes.push({ no: idx + 1, id: pick.id, why: r.why, src: pick.src, replaced: null });
    } else {
      const old = slots[idx].main;
      slots[idx] = { type: "opt", main: pick, alts: [old, ...slots[idx].alts.filter((a) => a.id !== pick.id)].slice(0, 2), changed: true, why: r.why };
      changes.push({ no: idx + 1, id: pick.id, why: r.why, src: pick.src, replaced: old.id });
    }
    slots[idx].changed = true; slots[idx].why = r.why;
  }
  let boots = null;
  const marks = enemyChamps().filter((c) => (c.tags || [])[0] === "Marksman").length;
  if (n.mr && S.st.items["3111"]) boots = { id: "3111", why: t("{n} AP ellenfél (és CC ellen is jó)", { n: n.ap }) };
  else if (n.armor && marks >= 2 && S.st.items["3047"]) boots = { id: "3047", why: t("{n} lövész / sok alaptámadás az ellenfélnél", { n: marks }) };
  const coreBoots = std.find((s) => s.type === "core" && itemHas(s.main.id, "Boots"));
  if (boots && coreBoots) {
    if (coreBoots.main.id === boots.id) boots = null;
    else {
      const i = std.indexOf(coreBoots), old = slots[i].main;
      slots[i] = { ...slots[i], main: { id: boots.id }, alts: [old], changed: true, why: boots.why };
      boots.replaced = old.id; boots.no = i + 1;
    }
  }
  return { slots, changes, kept, boots, n };
}

function markProgress(slots) {
  const own = owned(), live = inGame();
  let next = -1;
  slots.forEach((s, i) => { s.done = live && [s.main, ...s.alts].some((x) => own.has(x.id)); if (live && !s.done && next < 0) next = i; });
  return next;
}

function pathHtml(slots) {
  const next = markProgress(slots);
  const need = enemyNeeds();
  const fit = (id) => (need.mr && itemHas(id, "SpellBlock")) || (need.armor && itemHas(id, "Armor"));
  return `<div class="path">${slots.map((s, i) => {
    const it = S.st.items[s.main.id] || {};
    const cls = ["slot", s.type, s.done ? "done" : "", i === next ? "next" : "", s.changed ? "changed" : ""].join(" ");
    const w = s.type === "opt" ? `<div class="w">${s.main.wr ? wrHtml(s.main.wr) : `<span class="tipp">${t("javaslat")}</span>`}</div>` : "";
    const alts = s.alts.length ? `<div class="alts">${s.alts.map((a) => itemIc(a.id, fit(a.id) ? "fit" : "")).join("")}</div>` : "";
    return `<div class="${cls}" ${s.why ? `title="${esc(s.why)}"` : ""}><div class="no">${i + 1}.</div>${itemIc(s.main.id, "main" + (fit(s.main.id) ? " fit" : ""))}
      <div class="nm">${esc(it.name || "")}</div>${w}${alts}</div>`;
  }).join("")}</div>`;
}

function cardItems() {
  const b = S.build;
  const std = standardSlots();
  if (!b.starting && !std.length) return "";
  const view = S.itemView;
  const ad = adaptedBuild(std);
  const core = (b.core && b.core.ids) || [];
  let start = "";
  if (b.starting) {
    const m = new Map(); b.starting.ids.forEach((id) => m.set(id, (m.get(id) || 0) + 1));
    const gold = core.reduce((s, id) => s + ((S.st.items[id] || {}).gold || 0), 0);
    start = `<div class="sub-h">${t("Kezdés")}</div><div class="start-row"><div class="icons">${[...m].map(([id, n]) => itemIc(id, "", n > 1 ? `<span class="n">${n}</span>` : "")).join("")}</div>
      <div class="meta">${t("Kezdés")} ${wrHtml(b.starting.wr)}<br>Core: ${b.core ? wrHtml(b.core.wr) + " · " + fmt(gold) + " " + t("arany") : "–"}</div></div>`;
  }
  const seg = `<div class="seg" id="itemSeg">${Object.entries(ITEM_VIEWS).map(([k, v]) => `<button data-v="${k}" class="${view === k ? "on" : ""}">${v}${k !== "std" && ad && ad.changes.length ? ` <span class="cnt">${ad.changes.length + (ad.boots ? 1 : 0)}</span>` : ""}</button>`).join("")}</div>`;
  const stdBlock = `<div class="sub-h">${view === "both" ? t("Alap build · U.GG") : t("Build útvonal · U.GG alap")}</div>${pathHtml(std)}
    <div class="path-legend"><span>1–${core.length}: core · ${core.length + 1}–${std.length}: ${t("legnépszerűbb + 2 alternatíva")}</span><span>${t("ez kerül a játékba")}</span></div>`;
  let enemyBlock = "";
  if (!ad) {
    enemyBlock = `<div class="sub-h">${t("Ellenfél ellen")}</div><div class="empty-mini">${t("Az ellenfelek még nem látszanak. Draftban, amint választanak, vagy meccs közben magától megjelenik.")}</div>`;
  } else {
    const champsRow = `<div class="enemy-mini">${enemyChamps().map((c) => `<img src="${champImg(c.id)}" title="${esc(c.name)}" alt="">`).join("")}
      <span>AD ${ad.n.ad} · AP ${ad.n.ap}${ad.n.tanks ? ` · tank ${ad.n.tanks}` : ""}${ad.n.heal ? ` · ${t("gyógyító")} ${ad.n.heal}` : ""}</span></div>`;
    const reasons = [];
    if (ad.boots) reasons.push(`<div class="why">${itemIc(ad.boots.id)}<div><b>${ad.boots.no ? ad.boots.no + ". " : t("Csizma") + ": "}${esc(S.st.items[ad.boots.id].name)}</b><span>${esc(ad.boots.why)}${ad.boots.replaced ? ` · ${t("helyette")}: ${esc((S.st.items[ad.boots.replaced] || {}).name || "")}` : ""}</span></div></div>`);
    ad.changes.forEach((c) => reasons.push(`<div class="why">${itemIc(c.id)}<div><b>${c.no}. ${esc(S.st.items[c.id].name)}</b>
      <span>${esc(c.why)}${c.replaced ? ` · ${t("helyette")}: ${esc((S.st.items[c.replaced] || {}).name || "")}` : ""} · ${c.src === "ugg" ? t("U.GG adat") : t("RiftMester javaslat")}</span></div></div>`));
    ad.kept.forEach((k) => reasons.push(`<div class="why ok">${itemIc(k.id)}<div><b>✓ ${esc(S.st.items[k.id].name)}</b><span>${esc(k.why)} – ${t("az alap build már tartalmazza")}</span></div></div>`));
    if (!reasons.length) reasons.push(`<div class="empty-mini">${t("Vegyes az ellenfél csapata – az alap build jó ellenük is.")}</div>`);
    enemyBlock = `<div class="sub-h">${t("Ellenfél ellen")}</div>${champsRow}${pathHtml(ad.slots)}<div class="whys">${reasons.join("")}</div>`;
  }
  const body = seg + start + (view === "enemy" ? enemyBlock : view === "both" ? stdBlock + enemyBlock : stdBlock);
  markProgress(std);
  const doneN = std.filter((s) => s.done).length;
  return card("items", t("Tárgyak"), core.length ? `<img src="${itemImg(core[core.length - 1])}" alt="">` : "🛡", inGame() ? `${doneN}/${std.length} ${t("kész")}` : "", body);
}

/* ---------- idézőigék, skillek */
function cardSkills() {
  const b = S.build, sk = b.skills;
  if (!sk) return "";
  const lvl = inGame() ? S.lcu.level || 0 : 0;
  const levels = Array.from({ length: 18 }, (_, i) => sk.order[i] || "");
  const grid = `<div></div>` + levels.map((_, i) => `<div class="hdr ${i + 1 === lvl ? "now" : ""}">${i + 1}</div>`).join("") +
    ["Q", "W", "E", "R"].map((k) => `<div class="lbl">${k}</div>` + levels.map((x, i) => `<div class="c ${x === k ? "on " + k : ""} ${x === k && i + 1 === lvl ? "now" : ""}">${x === k ? i + 1 : ""}</div>`).join("")).join("");
  return card("skills", t("Skill sorrend szintenként"), "✦", sk.games ? `${wrHtml(sk.wr)} · ${fmt(sk.games)}` : "", `<div class="grid">${grid}</div>`);
}
function enemyChamps() { return ((S.lcu && S.lcu.enemies) || []).map(champ).filter(Boolean); }
function enemyNeeds() {
  const en = S.st ? enemyChamps() : [];
  if (!en.length) return {};
  let ap = 0, ad = 0, tanks = 0, heal = 0;
  for (const c of en) { const i = c.info || {}; if ((i.magic || 0) > (i.attack || 0)) ap++; else ad++; if ((c.tags || []).includes("Tank")) tanks++; if (HEALERS.has(c.id)) heal++; }
  return { ap, ad, tanks, heal, n: en.length, mr: ap >= 3 || (ap >= 2 && ap / en.length >= 0.6), armor: ad >= 3 || (ad >= 2 && ad / en.length >= 0.6) };
}
function renderEnemyCard() {
  const slot = $("#enemySlot");
  if (!slot) return;
  const en = enemyChamps();
  if (!en.length) { slot.innerHTML = ""; return; }
  const n = enemyNeeds(), me = champ(S.champKey) || {}, cls = (me.tags || [])[0] || "Fighter";
  const sug = (l) => { const ok = (l || []).map(String).filter((id) => S.st.items[id]); return ok.length ? `<div class="icons">${ok.map((id) => itemIc(id)).join("")}</div>` : ""; };
  const tips = [];
  if (n.mr) tips.push([t("Sok varázssebzés ({n} AP hős). Mágiaellenállás és <b>Higany lépők</b> jól jöhet.", { n: n.ap }), [...SUGGEST.bootsAP, ...(SUGGEST.mr[cls] || [])]]);
  if (n.armor) tips.push([t("Sok fizikai sebzés ({n} AD hős). Páncél és <b>Páncélozott csizma</b> megfontolandó.", { n: n.ad }), [...SUGGEST.bootsAD, ...(SUGGEST.armor[cls] || [])]]);
  if (n.heal >= 2) tips.push([t("{n} sokat gyógyító ellenfél – vegyél <b>sebkésleltető</b> tárgyat.", { n: n.heal }), SUGGEST.heal[cls]]);
  if (n.tanks >= 2) tips.push([t("{n} tank az ellenfélnél – <b>átütés</b> vagy %-os sebzés kell.", { n: n.tanks }), SUGGEST.tank[cls]]);
  if (!tips.length) tips.push([t("Vegyes az ellenfél sebzése – maradhat az ajánlott build."), []]);
  const tot = Math.max(n.ad + n.ap, 1);
  slot.innerHTML = card("enemy", t("Ellenfél csapat"), "⚔", `${en.length} ${t("hős")}`,
    `<div class="enemy-row">${en.map((c) => `<div class="ic" title="${esc(c.name)}"><img src="${champImg(c.id)}" alt=""></div>`).join("")}</div>
    <div class="dmg"><div class="dmg-bar"><div class="ad" style="width:${(100 * n.ad) / tot}%"></div><div class="ap" style="width:${(100 * n.ap) / tot}%"></div></div>
    <div class="dmg-leg"><span style="color:var(--ad)">${t("Fizikai")}: ${n.ad}</span><span style="color:var(--ap)">${t("Varázs")}: ${n.ap}</span></div></div>
    ${tips.map(([tx, ids]) => `<div class="tip">${tx}${sug(ids)}</div>`).join("")}`);
  bindCards(slot);
}
function cardTips() {
  const d = S.detail;
  if (!d || !(d.allytips || []).length) return "";
  return card("tips", t("Tippek a hőshöz"), "💡", "", `<ul class="tips-list">${d.allytips.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`);
}

function bindCards(root = document) {
  root.querySelectorAll(".card-h").forEach((h) => {
    if (h._b) return; h._b = true;
    h.addEventListener("click", () => {
      const c = h.parentElement, id = c.dataset.card;
      c.classList.toggle("collapsed");
      const v = c.classList.contains("collapsed");
      if (S.gameCollapse && id in S.gameCollapse) S.gameCollapse[id] = v; else { S.collapsed[id] = v; save("collapsed", S.collapsed); }
    });
  });
  const spb = $("#spellsBtn");
  if (spb && !spb._b) { spb._b = true; spb.addEventListener("click", setSpells); }
  const isb = $("#itemsetBtn");
  if (isb && !isb._b) { isb._b = true; isb.addEventListener("click", importItemset); }
  const ib = $("#importBtn");
  if (ib && !ib._b) { ib._b = true; ib.addEventListener("click", () => importRunes(false)); }
  root.querySelectorAll("#itemSeg button").forEach((x) => {
    if (x._b) return; x._b = true;
    x.addEventListener("click", (e) => { e.stopPropagation(); S.itemView = x.dataset.v; save("itemView", S.itemView); rerender(); });
  });
}

async function importRunes(overwrite) {
  const r = S.build && S.build.runes;
  if (!r) return;
  const perks = [...r.primaryPerks.slice(0, 4), ...r.subPerks.slice(0, 2), ...((S.build.shards || {}).ids || [])];
  if (perks.length < 9) return toast(t("Hiányos rúna adat, nem tudom betölteni."), true);
  try {
    const res = await post("/api/import-runes", { name: (champ(S.champKey) || {}).name || "Build", primary: r.primary, sub: r.sub, perks, overwrite });
    if (res.ok) return toast(t("✔ Rúnalap betöltve a kliensbe!"));
    if (res.full && !overwrite) { if (confirm(t("Nincs szabad rúnalap-helyed.\nFelülírjam az épp kiválasztott rúnalapodat?"))) return importRunes(true); return; }
    toast(res.error || t("Nem sikerült."), true);
  } catch (e) { toast(t("Nem sikerült") + ": " + e.message, true); }
}

async function importItemset() {
  const b = $("#itemsetBtn");
  if (b) { b.disabled = true; }
  try {
    const r = await post("/api/import-itemset", { champ: S.champKey, role: effRole(), rank: S.rank, mode: effMode() });
    toast(r.ok ? t("✔ Build betöltve a játékba!") : t("Nem sikerült") + ": " + r.error, !r.ok);
  } catch (e) { toast(t("Nem sikerült") + ": " + e.message, true); }
  if (b) b.disabled = false;
}


/* ================================================================ hősválasztás */
const CS_PHASES = { BAN_PICK: "Kitiltás és választás", PLANNING: "Tervezés", FINALIZATION: "Felkészülés", GAME_STARTING: "Indul a meccs" };
S.cs = null; S.counters = {}; S.csSel = null; S.csFilter = load("csFilter", "all"); S.csQuery = ""; S.csBusy = false;

async function pollCS() {
  let cs;
  try { cs = await api("/api/champselect"); } catch (e) { cs = { active: false, connected: false }; }
  cs._at = Date.now();
  // csak akkor rajzolunk újra, ha tényleg változott valami (az időzítő külön ketyeg)
  const sig = JSON.stringify({ ...cs, _at: 0, timer: cs.timer ? { phase: cs.timer.phase } : null });
  const changed = sig !== S.csSig;
  S.cs = cs; S.csSig = sig;
  if (S.page === "cs" && changed) renderCS();
}

function tickTimer() {
  const el = document.getElementById("csTimer");
  if (!el || !S.cs || !S.cs.timer) return;
  const left = Math.max(0, S.cs.timer.left - (Date.now() - S.cs._at));
  const sec = Math.ceil(left / 1000);
  el.textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  el.classList.toggle("hurry", sec <= 10 && S.cs.myTurn);
}

function counterInfo(key, role) {
  const k = key + "|" + effModeCS() + "|" + (role || "auto");
  const c = S.counters[k];
  if (c === undefined) {
    S.counters[k] = null;
    api(`/api/counters?champ=${key}&mode=${effModeCS()}&role=${role || "auto"}`)
      .then((r) => { S.counters[k] = r; if (S.page === "cs") renderCS(); })
      .catch((e) => { S.counters[k] = { error: e.message }; if (S.page === "cs") renderCS(); });
    return null;
  }
  return c;
}
function effModeCS() { return (S.cs && S.cs.queueMode) || effMode(); }

function csMember(m, mine) {
  const key = m.champ || m.hover;
  const c = key ? champ(key) : null;
  const pos = m.pos ? `<span class="cs-pos" title="${esc(ROLES[m.pos] || "")}">${roleIco(m.pos)}</span>` : "";
  const who = mine ? (m.me ? t("Te") : esc(m.name || t("Csapattárs"))) : t("Ellenfél");
  let counters = "";
  if (m.champ && c) {
    const ci = counterInfo(m.champ, m.pos);
    if (ci && ci.counters && ci.counters.length) {
      counters = `<div class="cs-counters"><span>${t("Counter")}</span>${ci.counters.map((x) => {
        const cc = champ(x.c); if (!cc) return "";
        return `<button class="cs-ctr ${canPick(x.c) ? "" : "off"}" data-pick="${x.c}" title="${esc(cc.name)} · ${x.wr}% WR · ${fmt(x.games)} ${t("meccs")}"><img src="${champImg(cc.id)}" alt=""><b class="${"wr " + wrCls(x.wr)}">${Math.round(x.wr)}%</b></button>`;
      }).join("")}</div>`;
    } else if (ci && ci.error) counters = `<div class="cs-counters dim">${esc(t("A counter adat most nem érhető el."))}</div>`;
    else if (ci === null) counters = `<div class="cs-counters dim">${t("Counterek betöltése…")}</div>`;
  }
  const bg = c ? ` style="--bg:url('${splashImg(c.id)}')"` : "";
  return `<div class="cs-m ${mine ? "mine" : "theirs"} ${m.me ? "me" : ""} ${m.champ ? "locked" : m.hover ? "hover" : "empty"}"${bg}>
    <div class="cs-row">${pos}<div class="cs-tx"><b>${c ? esc(c.name) : "—"}</b><span>${who}${m.hover && !m.champ ? " · " + t("nézelődik") : ""}</span></div></div>
    ${counters}</div>`;
}
function takenSet() {
  const s = new Set();
  if (!S.cs) return s;
  for (const m of [...(S.cs.myTeam || []), ...(S.cs.theirTeam || [])]) if (m.champ) s.add(m.champ);
  for (const b of [...(S.cs.bans.mine || []), ...(S.cs.bans.theirs || [])]) s.add(b);
  return s;
}
function canPick(key) {
  if (!S.cs || !S.cs.active) return false;
  const list = S.cs.myTurn === "ban" ? S.cs.bannable : S.cs.pickable;
  return (!list || !list.length || list.includes(String(key))) && !takenSet().has(String(key));
}

function renderCS() {
  const el = document.getElementById("csContent");
  if (!el) return;
  const cs = S.cs;
  if (!S.st || !cs) { el.innerHTML = `<div class="placeholder"><div class="spinner"></div></div>`; return; }
  if (!cs.active) {
    const msg = !cs.connected ? t("Indítsd el a LoL klienst.")
      : ["Lobby", "Matchmaking", "ReadyCheck"].includes(cs.phase) ? t("Lobbiban vagy – amint elindul a hősválasztás, itt látod a két csapatot élőben.")
      : t("Itt fogod látni a hősválasztást, amikor elindul.");
    el.innerHTML = `<div class="cs-wait glass"><img src="logo.svg" alt=""><h3>${t("Hősválasztás")}</h3><p>${msg}</p>
      <label class="cs-auto"><input type="checkbox" id="autoCs" ${load("autoCsTab", true) ? "checked" : ""}> ${t("Hősválasztáskor magától ide váltson")}</label></div>`;
    document.getElementById("autoCs").onchange = (e) => save("autoCsTab", e.target.checked);
    return;
  }
  // a kijelölt hős: amit kattintottál, vagy amit épp nézel
  const me = (cs.myTeam || []).find((m) => m.me) || {};
  if (!S.csSel || !canPick(S.csSel)) S.csSel = me.champ ? null : me.hover || null;
  const turn = cs.myTurn;
  const head = `<div class="cs-head glass ${turn ? "turn " + turn : ""}">
    <div><div class="cs-phase">${t(CS_PHASES[cs.timer.phase] || "Hősválasztás")}</div>
    <div class="cs-turn">${turn === "pick" ? t("Te jössz – válassz hőst!") : turn === "ban" ? t("Te jössz – tilts ki egy hőst!") : me.champ ? t("Lezártad a hősödet.") : t("Várj a sorodra…")}</div></div>
    <div class="cs-timer" id="csTimer">–</div></div>`;
  const banIc = (k) => { const c = champ(k); return c ? `<img src="${champImg(c.id)}" title="${esc(c.name)}" alt="">` : ""; };
  const bans = (cs.bans.mine.length || cs.bans.theirs.length) ? `<div class="cs-bans"><div>${cs.bans.mine.map(banIc).join("")}</div><span>${t("Kitiltva")}</span><div>${cs.bans.theirs.map(banIc).join("")}</div></div>` : "";
  const teams = `<div class="cs-teams"><div class="cs-team mine"><h4>${t("Csapatod")}</h4>${cs.myTeam.map((m) => csMember(m, true)).join("")}</div>
    <div class="cs-team theirs"><h4>${t("Ellenfél")}</h4>${(cs.theirTeam.length ? cs.theirTeam : Array.from({ length: 5 }, () => ({}))).map((m) => csMember(m, false)).join("")}</div></div>`;

  let bench = "";
  if (cs.benchEnabled) {
    bench = `<div class="cs-bench glass"><h4>${t("Padon (kattints a cseréhez)")}</h4><div>${cs.bench.map((k) => { const c = champ(k); return c ? `<button class="cs-g" data-bench="${k}" title="${esc(c.name)}"><img src="${champImg(c.id)}" alt=""></button>` : ""; }).join("") || `<span class="dim">–</span>`}</div></div>`;
  }

  // hőslista
  const enemyCtr = new Map();
  for (const m of cs.theirTeam || []) if (m.champ) { const ci = S.counters[m.champ + "|" + effModeCS() + "|" + (m.pos || "auto")]; (ci && ci.counters || []).forEach((x) => enemyCtr.set(x.c, Math.max(enemyCtr.get(x.c) || 0, x.wr))); }
  const mine = new Map(((S.stats && S.stats.champs) || []).map((c) => [c.c, c]));
  const q = norm(S.csQuery || "");
  let list = S.champList.filter((c) => !q || norm(c.name).includes(q) || norm(c.id).includes(q));
  if (S.csFilter === "counter") list = list.filter((c) => enemyCtr.has(c.key)).sort((a, b) => enemyCtr.get(b.key) - enemyCtr.get(a.key));
  if (S.csFilter === "mine") list = list.filter((c) => mine.has(c.key)).sort((a, b) => mine.get(b.key).games - mine.get(a.key).games);
  const grid = list.map((c) => {
    const ok = canPick(c.key);
    return `<button class="cs-g ${ok ? "" : "off"} ${S.csSel === c.key ? "sel" : ""} ${enemyCtr.has(c.key) ? "ctr" : ""} ${mine.has(c.key) ? "own" : ""}" data-pick="${c.key}" title="${esc(c.name)}" ${ok ? "" : "disabled"}>
      <img src="${champImg(c.id)}" alt="" loading="lazy"><span>${esc(c.name)}</span></button>`;
  }).join("") || `<div class="dim" style="padding:10px">${t("Nincs találat")}</div>`;
  const sel = S.csSel ? champ(S.csSel) : null;
  const lockLbl = turn === "ban" ? t("Kitiltás") : t("Kiválasztás");
  const pick = cs.benchEnabled ? "" : `<div class="cs-pick glass">
    <div class="cs-pick-top">
      <div class="cs-sel">${sel ? `<img src="${champImg(sel.id)}" alt=""><div><b>${esc(sel.name)}</b><span>${turn === "ban" ? t("kitiltásra kijelölve") : t("kijelölve")}</span></div>` : `<span class="dim">${t("Kattints egy hősre a listában.")}</span>`}</div>
      <button class="btn ${turn ? "go" : ""}" id="csLock" ${turn && S.csSel ? "" : "disabled"}>${lockLbl}</button>
    </div>
    <div class="cs-tools"><input type="text" id="csSearch" placeholder="${t("Írd be a hős nevét…")}" value="${esc(S.csQuery)}" autocomplete="off">
      <div class="seg">${[["all", t("Mind")], ["counter", t("Counterek")], ["mine", t("Saját")]].map(([k, v]) => `<button data-f="${k}" class="${S.csFilter === k ? "on" : ""}">${v}</button>`).join("")}</div></div>
    <div class="cs-grid">${grid}</div>
    <div class="set-hint">${t("Kattintás: kijelölés (a csapatod látja). A gomb lezárja a választást, ha te következel.")}</div></div>`;

  const focusSearch = document.activeElement && document.activeElement.id === "csSearch";
  const caret = focusSearch ? document.activeElement.selectionStart : 0;
  const scroll = el.querySelector(".cs-grid") ? el.querySelector(".cs-grid").scrollTop : 0;
  el.innerHTML = head + bans + teams + bench + pick;
  tickTimer();
  const g = el.querySelector(".cs-grid"); if (g) g.scrollTop = scroll;
  const si = document.getElementById("csSearch");
  if (si) {
    if (focusSearch) { si.focus(); si.setSelectionRange(caret, caret); }
    si.oninput = () => { S.csQuery = si.value; renderCS(); };
  }
  el.querySelectorAll("[data-f]").forEach((b) => (b.onclick = () => { S.csFilter = b.dataset.f; save("csFilter", S.csFilter); renderCS(); }));
  el.querySelectorAll("[data-pick]").forEach((b) => (b.onclick = () => csHover(b.dataset.pick)));
  el.querySelectorAll("[data-bench]").forEach((b) => (b.onclick = () => csBench(b.dataset.bench)));
  const lb = document.getElementById("csLock"); if (lb) lb.onclick = () => csLock();
}

async function csHover(key) {
  if (!canPick(key)) return toast(t("Ez a hős most nem választható."), true);
  S.csSel = key; renderCS();
  try { const r = await post("/api/cs-action", { champ: key, lock: false }); if (!r.ok) toast(r.error, true); } catch (e) { toast(e.message, true); }
  pollCS();
}
async function csLock() {
  if (!S.csSel || S.csBusy) return;
  S.csBusy = true;
  try {
    const r = await post("/api/cs-action", { champ: S.csSel, lock: true });
    toast(r.ok ? (S.cs.myTurn === "ban" ? t("✔ Kitiltva") : t("✔ Kiválasztva")) : r.error, !r.ok);
  } catch (e) { toast(e.message, true); }
  S.csBusy = false; pollCS();
}
async function csBench(key) {
  try { const r = await post("/api/cs-bench", { champ: key }); if (!r.ok) toast(r.error, true); } catch (e) { toast(e.message, true); }
  pollCS();
}


/* ================================================================ in game: a 10 játékos */
const TIERS_EXP = {
  beginner: ["Kezdő", "0–20"], advanced: ["Haladó", "21–50"], master: ["Mester", "51–100"],
  legendary: ["Legendás", "101–300"], mythic: ["Mitikus", "301–500"], divine: ["Isteni", "500+"],
};
S.ig = null;
async function pollIG() {
  let d;
  try { d = await api("/api/ingame"); } catch (e) { return; }
  const sig = JSON.stringify(d);
  if (sig === S.igSig) return;
  S.ig = d; S.igSig = sig;
  if (S.page === "ingame") renderIG();
}
function fmtK(n) { return n >= 1000 ? (n / 1000).toFixed(n >= 100000 ? 0 : 1) + "k" : String(n); }
function tierBadge(tier) {
  const [name, range] = TIERS_EXP[tier] || TIERS_EXP.beginner;
  const pips = Object.keys(TIERS_EXP).indexOf(tier) + 1;
  return `<span class="tier t-${tier}" title="${esc(t(name))} (${range} ${t("meccs")})"><i>${"◆".repeat(Math.max(1, pips))}</i>${esc(t(name))}</span>`;
}
const ROLE_ORDER = ["top", "jungle", "mid", "adc", "support"];

/** A csapat 5 játékosát Top–Jungle–Mid–ADC–Support sorrendbe teszi. Ismert pozíció > Smite > hős típusa. */
function arrangeTeam(team) {
  const slots = {}, rest = [];
  for (const p of team) (p.pos && ROLE_ORDER.includes(p.pos) && !slots[p.pos] ? (slots[p.pos] = p) : rest.push(p));
  const fit = (p, role) => {
    const tags = ((champ(p.champ) || {}).tags) || [];
    if (role === "jungle") return p.smite ? 100 : (tags.includes("Assassin") || tags.includes("Fighter") ? 3 : 0);
    if (role === "support") return tags[0] === "Support" ? 50 : tags.includes("Support") ? 25 : tags[0] === "Tank" ? 6 : 0;
    if (role === "adc") return tags[0] === "Marksman" ? 50 : tags.includes("Marksman") ? 20 : 0;
    if (role === "mid") return tags[0] === "Mage" ? 30 : tags[0] === "Assassin" ? 25 : tags.includes("Mage") ? 10 : 0;
    if (role === "top") return tags[0] === "Fighter" ? 30 : tags[0] === "Tank" ? 25 : tags.includes("Fighter") ? 10 : 0;
    return 0;
  };
  // a legjobb illeszkedések először (Smite-os jungler, support, lövész…)
  const pairs = [];
  for (const p of rest) for (const r of ROLE_ORDER) if (!slots[r]) pairs.push([fit(p, r), p, r]);
  pairs.sort((x, y) => y[0] - x[0]);
  const used = new Set();
  for (const [, p, r] of pairs) if (!slots[r] && !used.has(p)) { slots[r] = p; used.add(p); }
  for (const p of rest) if (!used.has(p)) { const r = ROLE_ORDER.find((x) => !slots[x]); if (r) slots[r] = p; }
  return ROLE_ORDER.map((r) => slots[r] || null);
}

function igCard(p, side) {
  if (!p) return `<div class="ig-card empty ${side}"></div>`;
  const c = champ(p.champ);
  const bg = c ? ` style="--bg:url('${splashImg(c.id)}')"` : "";
  const nm = p.me ? t("Te") : (p.name ? esc(p.name) : t(p.ally ? "Csapattárs" : "Ellenfél"));
  const rk = p.rank ? `${esc(TIERS[p.rank.tier] || p.rank.tier)} ${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(p.rank.tier) ? "" : esc(p.rank.division || "")}` : t("Rangsorolatlan");
  let body = `<div class="ig-load"><i></i><i></i></div>`, note = "";
  if (p.done) {
    const r = p.recent || { games: 0 };
    note = r.seen ? t("Az utolsó {n} meccséből {k} volt ezzel a hőssel.", { n: r.seen, k: r.games }) : t("A meccselőzménye nem elérhető.");
    if (p.estimated) note += " " + t("Az összes meccs a mastery pontokból becsült.");
    body = `<div class="ig-l2">${tierBadge(p.tier)}</div>
      <div class="ig-l3"><div class="ig-wr">${r.games ? `<b class="${"wr " + wrCls(r.wr)}">${r.wr.toFixed(0)}%</b><span>${r.wins}W ${r.losses}L</span>` : `<b class="wr">–</b><span>${t("nincs friss meccs")}</span>`}</div>
        <div class="ig-tot"><b>${p.estimated ? "~" : ""}${fmt(p.total || 0)}</b><span>${t("meccs")}</span></div></div>
      <div class="ig-l4">${r.games ? `<span>KDA <b>${r.kda}</b></span>` : ""}${p.mastery ? `<span>M<b>${p.mastery.level}</b> · ${fmtK(p.mastery.points)}</span>` : ""}</div>`;
  }
  return `<div class="ig-card ${side} ${p.me ? "me" : ""}"${bg} title="${esc(note)}">
    <div class="ig-l1"><b>${c ? esc(c.name) : "?"}</b><span class="ig-pn">${nm}</span><span class="ig-rk">${rk}</span></div>${body}</div>`;
}

function renderIG() {
  const el = document.getElementById("igContent");
  if (!el) return;
  const d = S.ig;
  if (!S.st || !d || !d.active) {
    el.innerHTML = `<div class="cs-wait glass"><img src="logo.svg" alt=""><h3>In game</h3><p>${t("A töltőképernyőnél itt jelenik meg mind a 10 játékos: mennyire ismerik a hősüket, és milyen eredménnyel játszanak vele.")}</p></div>`;
    return;
  }
  const aram = ["aram", "mayhem"].includes(S.lcu && S.lcu.queueMode);
  const allies = d.players.filter((p) => p.ally), enemies = d.players.filter((p) => !p.ally);
  const A = aram ? allies.concat(Array(5).fill(null)).slice(0, 5) : arrangeTeam(allies);
  const E = aram ? enemies.concat(Array(5).fill(null)).slice(0, 5) : arrangeTeam(enemies);
  const rows = ROLE_ORDER.map((r, i) => `<div class="ig-row">${igCard(A[i], "ally")}<div class="ig-role">${aram ? "" : roleIco(r)}</div>${igCard(E[i], "enemy")}</div>`).join("");
  const legend = Object.keys(TIERS_EXP).map((k) => `<span class="tier t-${k} sm"><i>${"◆".repeat(Object.keys(TIERS_EXP).indexOf(k) + 1)}</i>${esc(t(TIERS_EXP[k][0]))} <em>${TIERS_EXP[k][1]}</em></span>`).join("");
  el.innerHTML = `<div class="ig-head glass"><div><b>${t("Kivel játszol, ki ellen?")}</b><span>${d.loading ? t("Adatok gyűjtése…") : t("Kész")} · ${t("vidd az egeret egy kártyára a részletekért")}</span></div></div>
    <div class="ig-legend">${legend}</div>
    <div class="ig-cols"><h4 class="ig-h ally">${t("Csapatod")}</h4><span></span><h4 class="ig-h enemy">${t("Ellenfél")}</h4></div>
    ${rows}`;
}

/* ================================================================ kedvencek */
function renderFavs() {
  const el = $("#favs");
  const favs = (S.stats && S.stats.favorites) || [];
  if (!S.st || !favs.length) { el.innerHTML = ""; return; }
  el.innerHTML = favs.map((f) => {
    const c = champ(f.c);
    if (!c) return "";
    const has = f.games > 0;
    return `<button class="fav ${f.c === S.champKey ? "sel" : ""}" data-key="${f.c}" title="${esc(c.name)}" style="background-image:url('${loadingImg(c.id)}')">
      <span class="fav-n">${esc(c.name)}</span>
      ${has ? `<span class="fav-s"><b class="${"wr " + wrCls(f.wr)}">${f.wr.toFixed(0)}%</b> · ${f.games}</span>` : ""}</button>`;
  }).join("");
  el.querySelectorAll(".fav").forEach((x) => (x.onclick = () => pickChamp(x.dataset.key)));
}
function pickChamp(key) {
  S.champKey = key; S.fromClient = key === S.lastClientChamp; S.role = "auto";
  closeAll(); showPage("build"); loadBuild();
}

/* ================================================================ statisztika */
async function loadStats() {
  try { S.stats = await api("/api/stats?queue=" + S.statsQueue); } catch (e) { return; }
  renderFavs();
  if (S.page === "stats") renderStats();
}

function donut(wr) {
  const r = 40, c = 2 * Math.PI * r, w = (Math.max(0, Math.min(100, wr)) / 100) * c;
  return `<div class="donut"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="${r}" fill="none" stroke="rgba(251,113,133,.55)" stroke-width="10"/>
    <circle cx="50" cy="50" r="${r}" fill="none" stroke="url(#dg)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${w} ${c}"/>
    <defs><linearGradient id="dg"><stop offset="0" stop-color="#10b981"/><stop offset="1" stop-color="#5eead4"/></linearGradient></defs></svg>
    <div class="c"><div><b class="${"wr " + wrCls(wr)}">${wr.toFixed(1)}%</b><span>${t("győzelem")}</span></div></div></div>`;
}
function ago(ms) {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return t("{n} perce", { n: m });
  if (m < 1440) return t("{n} órája", { n: Math.round(m / 60) });
  return t("{n} napja", { n: Math.round(m / 1440) });
}

function renderStats() {
  const el = $("#statsContent"), s = S.stats;
  if (!S.st || !s) { el.innerHTML = `<div class="placeholder"><div class="spinner"></div><p>${t("Statisztika betöltése…")}</p></div>`; return; }
  const sm = s.summoner;
  const prof = `<div class="prof glass">${sm && sm.icon != null ? `<img src="${profileImg(sm.icon)}" alt="">` : `<img src="logo.svg" alt="">`}
    <div><div class="nm">${sm ? esc(sm.name) + (sm.tag ? ` <span>#${esc(sm.tag)}</span>` : "") : t("Játékos")}</div>
    <div class="sm">${sm && sm.level ? t("{n}. szint", { n: sm.level }) + " · " : ""}${fmt(s.stored)} ${t("meccs tárolva")} · ${t("szezon")}: ${esc(s.seasonStart)}${t("-tól")}</div></div>
    <button class="btn small" id="refreshStats" ${s.loading ? "disabled" : ""}>${s.loading ? t("Frissül…") : "↻ " + t("Frissítés")}</button></div>`;
  const rk = ["RANKED_SOLO_5x5", "RANKED_FLEX_SR"].map((q) => {
    const r = (s.ranked || []).find((x) => x.queue === q);
    const name = q === "RANKED_SOLO_5x5" ? "Solo/Duo" : "Flex";
    if (!r || !r.tier || r.tier === "NONE" || r.tier === "") return `<div class="rk glass"><div><div class="q">${name}</div><div class="t">${t("Rangsorolatlan")}</div><div class="s">${r ? `${r.wins || 0}W ${r.losses || 0}L` : "–"}</div></div></div>`;
    const g = (r.wins || 0) + (r.losses || 0), wr = g ? (100 * r.wins) / g : 0;
    return `<div class="rk glass"><img src="${RANK_EMBLEM(r.tier)}" alt="" onerror="this.remove()"><div><div class="q">${name}</div>
      <div class="t">${TIERS[r.tier] || r.tier} ${["MASTER", "GRANDMASTER", "CHALLENGER"].includes(r.tier) ? "" : r.division || ""} · ${r.lp} LP</div>
      <div class="s">${r.wins}W ${r.losses}L · ${wrHtml(wr)}</div></div></div>`;
  }).join("");
  const qtabs = `<div class="mode-tabs">${Object.entries({ all: t("Mind"), solo: "Solo/Duo", flex: "Flex", aram: "ARAM", mayhem: "Mayhem" }).map(([k, v]) =>
    `<div class="mtab ${S.statsQueue === k ? "on" : ""}" data-q="${k}">${v}</div>`).join("")}</div>`;
  const T = s.total;
  let body;
  if (!T.games) {
    body = `<div class="empty glass">${s.connected ? t("Ebben a módban még nincs meccsed a szezonban.") : t("Indítsd el a LoL klienst – a meccseidet onnan olvassa be.<br>A statisztika a program használatával folyamatosan bővül.")}</div>`;
  } else {
    const streak = s.streak && s.streak.n >= 2 ? `<div class="kpi"><div class="v ${s.streak.win ? "wr g" : "wr b"}">${s.streak.win ? t("{n}× győzelem", { n: s.streak.n }) : t("{n}× vereség", { n: s.streak.n })}</div><div class="l">${t("sorozat")}</div></div>` : `<div class="kpi"><div class="v">${T.k} / ${T.d} / ${T.a}</div><div class="l">${t("átlag K/D/A")}</div></div>`;
    body = `<div class="summary glass">${donut(T.wr)}<div class="kpis">
        <div class="kpi"><div class="v num">${fmt(T.games)}</div><div class="l">${t("meccs")}</div></div>
        <div class="kpi"><div class="v num"><span class="wr g">${T.wins}</span> / <span class="wr b">${T.losses}</span></div><div class="l">${t("győzelem / vereség")}</div></div>
        <div class="kpi"><div class="v num">${T.kda}</div><div class="l">KDA</div></div>${streak}</div></div>
      ${card("st_champs", t("Hőseid a szezonban"), "🏆", `${s.champs.length} ${t("hős")}`, s.champs.map((c) => {
        const ch = champ(c.c); if (!ch) return "";
        return `<div class="crow" data-key="${c.c}" style="--bg:url('${splashImg(ch.id)}')"><img src="${champImg(ch.id)}" alt=""><div><div class="nm">${esc(ch.name)} <span>${c.wins}W ${c.losses}L</span></div>
          <div class="wl"><div class="w" style="width:${c.wr}%"></div><div class="l" style="width:${100 - c.wr}%"></div></div></div>
          <div class="st">${wrHtml(c.wr)}<br>${c.games} ${t("meccs")} · ${c.kda} KDA</div></div>`;
      }).join(""))}
      ${card("st_recent", t("Legutóbbi meccsek"), "🕒", "", s.recent.map((m) => {
        const ch = champ(m.c); if (!ch) return "";
        return `<div class="mrow ${m.win ? "win" : ""}" style="--bg:url('${splashImg(ch.id)}')"><div class="bar"></div><img src="${champImg(ch.id)}" alt=""><div><div class="t1">${m.win ? t("Győzelem") : t("Vereség")} · ${esc(ch.name)}</div>
          <div class="t2">${esc(m.qn)} · ${Math.floor(m.dur / 60)}:${String(m.dur % 60).padStart(2, "0")} · ${ago(m.t)}</div></div>
          <div class="kda">${m.k}/${m.d}/${m.a}<span>${m.cs} CS</span></div></div>`;
      }).join(""))}`;
  }
  el.innerHTML = prof + `<div class="ranked">${rk}</div>` + qtabs + body;
  el.querySelectorAll(".mtab[data-q]").forEach((x) => (x.onclick = () => { S.statsQueue = x.dataset.q; save("statsQueue", S.statsQueue); loadStats(); }));
  el.querySelectorAll(".crow").forEach((x) => (x.onclick = () => pickChamp(x.dataset.key)));
  const rb = $("#refreshStats");
  if (rb) rb.onclick = async () => { rb.disabled = true; rb.textContent = t("Frissül…"); await post("/api/history-refresh"); setTimeout(loadStats, 4000); setTimeout(loadStats, 10000); };
  bindCards(el);
}

/* ================================================================ beállítások */
function setupSettings() {
  $("#openSettings").onclick = openSettings;
  $("#closeSettings").onclick = () => ($("#settings").hidden = true);
  $("#settings").addEventListener("click", (e) => { if (e.target.id === "settings") $("#settings").hidden = true; });
}
async function openSettings() {
  $("#settings").hidden = false;
  $("#settingsBody").innerHTML = `<div class="placeholder"><div class="spinner"></div></div>`;
  try { S.settings = await api("/api/settings"); } catch (e) { $("#settingsBody").innerHTML = `<p class="err">${esc(e.message)}</p>`; return; }
  renderSettings();
}
function sw(key, title, desc) {
  return `<div class="set-row"><div class="tx"><b>${title}</b><span>${desc}</span></div>
    <label class="switch"><input type="checkbox" data-k="${key}" ${S.settings[key] ? "checked" : ""}><i></i></label></div>`;
}
function renderSettings() {
  const s = S.settings;
  const auto = [["off", t("Kikapcsolva"), t("Kézzel indítod (INDITAS.bat).")],
    ["lol", t("A LoL-lal együtt"), t("A géppel együtt elindul a háttérben (kb. 25 MB), és csak akkor nyílik meg, amikor elindítod a LoL-t. Ajánlott.")],
    ["windows", t("A Windows-szal együtt"), t("A gép indulásakor azonnal megnyílik az ablak, és a LoL indulásakor is.")]];
  $("#settingsBody").innerHTML = `
    <div class="set-sec"><h3>Nyelv · Language</h3><div class="choice two">${[["hu", "Magyar"], ["en", "English"]].map(([v, n]) => `<label class="${LANG === v ? "on" : ""}"><input type="radio" name="ui_lang" value="${v}" ${LANG === v ? "checked" : ""}><div><b>${n}</b></div></label>`).join("")}</div>
      <div class="set-hint">${t("A program nyelve. Váltáskor a hős- és tárgynevek is átváltanak.")}</div></div>
    <div class="set-sec"><h3>${t("Indítás")}</h3><div class="choice">${auto.map(([v, tt, d]) => `<label class="${s.autostart === v ? "on" : ""}">
      <input type="radio" name="autostart" value="${v}" ${s.autostart === v ? "checked" : ""} ${!s.windows && v !== "off" ? "disabled" : ""}><div><b>${tt}</b><span>${d}</span></div></label>`).join("")}</div></div>
    <div class="set-sec"><h3>${t("Hősválasztáskor")}</h3>
      ${sw("auto_runes", t("Rúnák automatikus betöltése"), t("Amint lezárod a hőst, beállítja a rúnalapot a kliensben."))}
      ${sw("auto_spells", t("Idézőigék automatikus beállítása"), t("Lezáráskor a hőshöz ajánlott idézőigéket is beállítja."))}
      <div class="set-row"><div class="tx"><b>${t("Flash billentyű")}</b><span>${t("Melyik billentyűn legyen a Flash (a beállításnál és a kijelzésnél is).")}</span></div>
        <div class="seg" id="flashSeg">${["D", "F"].map((k) => `<button data-v="${k}" class="${(s.flash_key || "D") === k ? "on" : ""}">${k}</button>`).join("")}</div></div>
      ${sw("rune_overwrite", t("Ha nincs szabad rúnalap, írja felül az aktuálisat"), t("Kikapcsolva ilyenkor nem csinál semmit."))}
      ${sw("auto_itemset", t("Build betöltése a játékba"), t("Mindig az alap U.GG build kerül be tárgylistaként, mielőtt indul a meccs: a boltban az ajánlott tárgyaknál látod."))}</div>
    <div class="set-sec"><h3>${t("Megjelenés")}</h3>
      ${sw("window_monitor_auto", t("Ablak a második monitoron"), t("A második monitor jobb szélén nyílik meg."))}
      ${sw("auto_collapse_in_game", t("Meccs közben a tárgyak legyenek felül"), t("A rúnák összecsukódnak, a build útvonal kerül előre."))}
      <div class="set-row"><div class="tx"><b>${t("Tárgyak nézete")}</b><span>${t("Alap U.GG build, ellenfél szerinti build, vagy mindkettő egymás alatt.")}</span></div>
        <select class="set-input" style="width:auto" id="itemViewSel">${Object.entries(ITEM_VIEWS).map(([k, v]) => `<option value="${k}" ${S.itemView === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="set-row"><div class="tx"><b>${t("Alap rang adat")}</b><span>${t("Melyik rangú játékosok buildjeit mutassa.")}</span></div>
        <select class="set-input" style="width:auto" data-k="default_rank">${Object.entries(RANKS).map(([k, v]) => `<option value="${k}" ${s.default_rank === k ? "selected" : ""}>${v}</option>`).join("")}</select></div></div>
    <div class="set-sec"><h3>${t("Statisztika")}</h3>
      <div class="set-row"><div class="tx"><b>${t("Szezon kezdete")}</b><span>${t("Ettől a naptól számolja a statisztikát. Üresen: az év eleje.")}</span></div>
        <input type="date" class="set-input" style="width:150px" data-k="season_start" value="${esc(s.season_start || "")}"></div></div>
    <div class="set-sec"><h3>${t("Frissítés")}</h3>
      <div class="set-row"><div class="tx"><b>${t("Automatikus frissítés")}</b><span>${t("Új verzió esetén mit csináljon.")}</span></div>
        <select class="set-input" style="width:auto" data-k="update_mode">${[["auto", t("Magától frissít")], ["ask", t("Kérdezzen meg")], ["off", t("Kikapcsolva")]].map(([k, v]) => `<option value="${k}" ${s.update_mode === k ? "selected" : ""}>${v}</option>`).join("")}</select></div>
      <div class="set-row" style="flex-direction:column;align-items:stretch"><div class="tx"><b>${t("Frissítési cím")}</b><span>https://…/riftmester/update/</span></div>
        <input type="text" class="set-input" data-k="update_url" value="${esc(s.update_url || "")}" placeholder="https://raw.githubusercontent.com/…"></div>
      <button class="btn full" id="checkUpd">⬆ ${t("Frissítés keresése most")}</button></div>
    <div class="set-foot">RiftMester v${esc(s.version)}${s.autostartActive ? " · " + t("automatikus indítás aktív") : ""}<br>${t("A beállítások azonnal mentődnek.")}</div>`;
  const body = $("#settingsBody");
  body.querySelectorAll('input[name="autostart"]').forEach((r) => (r.onchange = () => saveSetting({ autostart: r.value })));
  body.querySelectorAll('input[name="ui_lang"]').forEach((r) => (r.onchange = () => switchLang(r.value)));
  body.querySelectorAll("#flashSeg button").forEach((b) => (b.onclick = () => saveSetting({ flash_key: b.dataset.v })));
  body.querySelectorAll('input[type="checkbox"]').forEach((c) => {
    if (c.dataset.k === "window_monitor_auto") c.checked = s.window_monitor !== "off";
    c.onchange = () => saveSetting(c.dataset.k === "window_monitor_auto" ? { window_monitor: c.checked ? "auto" : "off" } : { [c.dataset.k]: c.checked });
  });
  body.querySelectorAll("select[data-k], input[type=date][data-k], input[type=text][data-k]").forEach((x) => (x.onchange = () => saveSetting({ [x.dataset.k]: x.value })));
  $("#itemViewSel").onchange = (e) => { S.itemView = e.target.value; save("itemView", S.itemView); toast(t("Mentve ✔")); if (S.build) rerender(); };
  $("#checkUpd").onclick = async () => {
    S.updating = true;
    try { const r = await post("/api/update"); toast(r.ok ? t("Frissítés letöltve, újraindul…") : (r.error || t("Nincs új verzió.")), !r.ok); if (!r.ok) S.updating = false; }
    catch (e) { toast(t("Frissítés letöltve, újraindul…")); }
  };
}
async function saveSetting(obj) {
  try {
    const r = await post("/api/settings", obj);
    S.settings = r;
    if ("default_rank" in obj) { S.rank = obj.default_rank; save("rank", S.rank); renderStaticMenus(); loadBuild(); }
    if ("season_start" in obj) loadStats();
    if ("flash_key" in obj && S.lcu && S.lcu.app) { S.lcu.app.flashKey = obj.flash_key; if (S.build) rerender(); }
    toast(r.message && r.message !== "ok" ? r.message : t("Mentve ✔"), r.message && r.message !== "ok");
    renderSettings();
  } catch (e) { toast(t("Nem sikerült menteni") + ": " + e.message, true); }
}

/* ================================================================ frissítés jelzés */
function renderUpdateBanner(u) {
  const el = $("#banner");
  if (!u) { el.innerHTML = ""; return; }
  if (u.justUpdated && !S.shownUpdate) { S.shownUpdate = true; toast(`✔ ${t("Frissítve")}: v${u.justUpdated.version}${u.justUpdated.notes ? " – " + u.justUpdated.notes : ""}`); }
  if (u.available) {
    if (el.dataset.v === u.available) return;
    el.dataset.v = u.available;
    el.innerHTML = `<div class="note info">⬆ <span>${t("Új verzió")}: <b>v${esc(u.available)}</b>${u.notes ? " – " + esc(u.notes) : ""}</span><button class="btn small" id="updBtn">${t("Frissítés")}</button></div>`;
    $("#updBtn").onclick = async () => {
      $("#updBtn").disabled = true; $("#updBtn").textContent = t("Frissül…");
      S.updating = true;
      try { const r = await post("/api/update"); if (!r.ok) { S.updating = false; toast(r.error || t("Nem sikerült"), true); } else toast(t("Frissítés letöltve, újraindul…")); }
      catch (e) { toast(t("Frissítés letöltve, újraindul…")); }
    };
  } else { el.innerHTML = ""; el.dataset.v = ""; }
}

/* ================================================================ mód fülek, lenyílók */
function renderModeTabs() {
  const live = S.lcu && S.lcu.queueMode, eff = effMode();
  $("#modeTabs").innerHTML = Object.entries(MODES).map(([k, v]) =>
    `<div class="mtab ${S.mode === k ? "on" : ""}" data-m="${k}">${v}${k === "auto" ? `<small>${MODES[eff]}</small>` : ""}${live === k ? '<span class="live"></span>' : ""}</div>`).join("");
  $("#modeTabs").querySelectorAll(".mtab").forEach((el) => (el.onclick = () => {
    if (S.mode === el.dataset.m) return;
    S.mode = el.dataset.m; save("mode", S.mode); renderModeTabs(); loadBuild();
  }));
}
function setupDropdowns() {
  document.querySelectorAll(".dd").forEach((dd) => {
    dd.querySelector(".dd-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      const open = dd.classList.contains("open");
      closeAll();
      if (!open) { dd.classList.add("open"); const inp = dd.querySelector("input"); if (inp) { inp.value = ""; renderChampList(""); inp.focus(); } }
    });
    dd.querySelector(".dd-menu").addEventListener("click", (e) => e.stopPropagation());
  });
  document.addEventListener("click", closeAll);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeAll(); $("#settings").hidden = true; } });
  const inp = $("#champSearch");
  inp.addEventListener("input", () => renderChampList(inp.value));
  inp.addEventListener("keydown", (e) => { if (e.key === "Enter") { const f = $("#champList .dd-item"); if (f) f.click(); } });
}
function closeAll() { document.querySelectorAll(".dd.open").forEach((x) => x.classList.remove("open")); }
function renderChampList(q) {
  if (!S.champList) return;
  const nq = norm(q || "");
  const list = S.champList.filter((c) => !nq || norm(c.name).includes(nq) || norm(c.id).includes(nq)).slice(0, 60);
  $("#champList").innerHTML = list.map((c, i) => `<div class="dd-item ${c.key === S.champKey ? "sel" : ""} ${i === 0 && nq ? "kb" : ""}" data-key="${c.key}">
      <img src="${champImg(c.id)}" alt="" loading="lazy"><span>${esc(c.name)}</span><span class="sub">${esc((c.tags || [])[0] || "")}</span></div>`).join("")
    || `<div style="padding:8px;color:var(--muted)">${t("Nincs találat")}</div>`;
  $("#champList").querySelectorAll(".dd-item").forEach((el) => el.addEventListener("click", () => pickChamp(el.dataset.key)));
}
function renderStaticMenus() {
  $("#rankList").innerHTML = Object.entries(RANKS).map(([k, v]) => `<div class="dd-item ${k === S.rank ? "sel" : ""}" data-v="${k}"><span>${v}</span>${k === "emerald_plus" ? `<span class="sub">${t("ajánlott")}</span>` : ""}</div>`).join("");
  $("#rankList").querySelectorAll(".dd-item").forEach((el) => el.addEventListener("click", () => { S.rank = el.dataset.v; save("rank", S.rank); closeAll(); renderStaticMenus(); loadBuild(); }));
  $("#ddRankVal").textContent = RANKS[S.rank];
  renderRoleMenu();
}
function renderRoleMenu() {
  const roles = (S.build && S.build.roles) || [];
  $("#roleList").innerHTML = [`<div class="dd-item ${S.role === "auto" ? "sel" : ""}" data-v="auto">${roleIco("aram")}<span>Auto</span><span class="sub">${t("kliens / legnépszerűbb")}</span></div>`]
    .concat(roles.filter((r) => r.role !== "aram").map((r) => `<div class="dd-item ${S.role === r.role ? "sel" : ""}" data-v="${r.role}">${roleIco(r.role)}<span>${ROLES[r.role] || r.role}</span><span class="sub">${wrHtml(r.wr)} · ${fmt(r.games)}</span></div>`)).join("");
  $("#roleList").querySelectorAll(".dd-item").forEach((el) => el.addEventListener("click", () => { S.role = el.dataset.v; closeAll(); loadBuild(); }));
}

/* ================================================================ tooltip, toast */
function setupTooltip() {
  const tt = $("#tooltip");
  document.addEventListener("mouseover", (e) => {
    const el = e.target.closest("[data-tt]");
    if (!el || !S.st) { tt.style.display = "none"; return; }
    const html = ttContent(el.dataset.tt);
    if (!html) { tt.style.display = "none"; return; }
    tt.innerHTML = html; tt.style.display = "block"; place(e);
  });
  document.addEventListener("mousemove", (e) => { if (tt.style.display === "block") place(e); });
  function place(e) {
    const r = tt.getBoundingClientRect();
    let x = e.clientX + 14, y = e.clientY + 14;
    if (x + r.width > innerWidth - 6) x = Math.max(6, e.clientX - r.width - 14);
    if (y + r.height > innerHeight - 6) y = Math.max(6, e.clientY - r.height - 14);
    tt.style.left = x + "px"; tt.style.top = y + "px";
  }
}
function ttContent(ref) {
  const [kind, id] = ref.split(":");
  const H = (n, r = "") => `<div class="tt-h"><span>${esc(n)}</span>${r}</div>`;
  if (kind === "item") {
    const it = S.st.items[id]; if (!it) return "";
    let extra = "";
    if (S.build) for (const o of S.build.options || []) { const f = o.find((x) => x.id === id); if (f) { extra = `\n\nWR: ${f.wr}% · ${fmt(f.games)} ${t("meccs")}`; break; } }
    const d = it.desc.length > 650 ? it.desc.slice(0, 650) + "…" : it.desc;
    return H(it.name, it.gold ? `<span class="tt-g">${fmt(it.gold)} 🪙</span>` : "") + `<div class="tt-d">${esc((d || it.plaintext) + extra)}</div>`;
  }
  if (kind === "rune") { const r = S.runeById[id]; return r ? H(r.name) + `<div class="tt-d">${esc(r.desc)}</div>` : ""; }
  if (kind === "spell") { const s = S.st.spells[id]; return s ? H(s.name) + `<div class="tt-d">${esc(s.desc)}</div>` : ""; }
  if (kind === "skill") {
    const s = S.detail && S.detail.spells.find((x) => x.key === id); if (!s) return "";
    return H(`${id} – ${s.name}`) + `<div class="tt-d">${esc(s.desc.length > 600 ? s.desc.slice(0, 600) + "…" : s.desc)}</div>`;
  }
  if (kind === "passive") { const p2 = S.detail && S.detail.passive; return p2 ? H(`${t("Passzív")} – ${p2.name}`) + `<div class="tt-d">${esc(p2.desc)}</div>` : ""; }
  if (kind === "shard") { const d = SHARDS[id]; return d ? H(d[0]) + `<div class="tt-d">${t("Statisztikai rúna")}</div>` : ""; }
  return "";
}
function toast(msg, bad) {
  const el = $("#toast");
  el.textContent = msg; el.className = "show" + (bad ? " bad" : "");
  clearTimeout(el._h); el._h = setTimeout(() => (el.className = ""), 3500);
}

init();
