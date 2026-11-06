"use strict";
/* ================================================================ RiftMester – nyelvek (HU / EN)
   A kulcs maga a magyar szöveg; angolul az EN szótárból jön a fordítás. {x} = behelyettesítés. */
let LANG = "hu";

function t(key, vars) {
  let s = LANG === "en" && Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

/** A statikus HTML elemek fordítása (data-i18n, data-i18n-ph, data-i18n-title). */
function applyStaticI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach((el) => { el.dataset.i18nKey = el.dataset.i18nKey || el.textContent.trim(); el.textContent = t(el.dataset.i18nKey); });
  document.querySelectorAll("[data-i18n-ph]").forEach((el) => (el.placeholder = t(el.dataset.i18nPh)));
  document.querySelectorAll("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
}

const EN = {
  // állandók
  "Adaptív erő": "Adaptive Force", "Támadási sebesség": "Attack Speed", "Képességgyorsítás": "Ability Haste",
  "Mozgási sebesség": "Move Speed", "Skálázódó életerő": "Scaling Health", "Életerő": "Health",
  "Szívósság és lassításellenállás": "Tenacity and Slow Resist", "Páncél": "Armor", "Mágiaellenállás": "Magic Resist",
  "Felső": "Top", "Dzsungel": "Jungle", "Középső": "Mid", "Alsó (ADC)": "Bot (ADC)", "Support": "Support",
  "Smaragd+": "Emerald+", "Platina+": "Platinum+", "Gyémánt+": "Diamond+", "Mester+": "Master+", "Összes rang": "All ranks",
  "Vas": "Iron", "Bronz": "Bronze", "Ezüst": "Silver", "Arany": "Gold", "Platina": "Platinum", "Smaragd": "Emerald",
  "Gyémánt": "Diamond", "Mester": "Master", "Nagymester": "Grandmaster", "Kihívó": "Challenger",
  "Kliens csatlakozva": "Client connected", "Lobbiban": "In lobby", "Meccskeresés…": "Finding match…",
  "Meccs elfogadása": "Accept match", "Hősválasztás": "Champion select", "Meccs folyamatban": "Game in progress",
  "Újracsatlakozás": "Reconnecting", "Meccs vége": "Game over",
  "Mentett U.GG adat": "Saved U.GG data", "Riot kliens ajánlás": "Riot client recommendation",
  "Alap (U.GG)": "Standard (U.GG)", "Ellenfél ellen": "Vs. enemies", "Mindkettő": "Both",
  // hősválasztás
  "Kitiltás és választás": "Ban & pick", "Tervezés": "Planning", "Felkészülés": "Finalization", "Indul a meccs": "Game starting",
  "Te": "You", "Csapattárs": "Teammate", "Ellenfél": "Enemy", "Counter": "Counter", "Counterek betöltése…": "Loading counters…",
  "nézelődik": "hovering", "Indítsd el a LoL klienst.": "Start the LoL client.",
  "Lobbiban vagy – amint elindul a hősválasztás, itt látod a két csapatot élőben.": "You're in the lobby – once champion select starts, you'll see both teams here live.",
  "Itt fogod látni a hősválasztást, amikor elindul.": "Champion select will show up here when it starts.",
  "Hősválasztáskor magától ide váltson": "Switch here automatically in champion select",
  "Te jössz – válassz hőst!": "Your turn – pick a champion!", "Te jössz – tilts ki egy hőst!": "Your turn – ban a champion!",
  "Lezártad a hősödet.": "You've locked in.", "Várj a sorodra…": "Wait for your turn…", "Kitiltva": "Bans",
  "Csapatod": "Your team", "Padon (kattints a cseréhez)": "Bench (click to swap)", "Kitiltás": "Ban", "Kiválasztás": "Lock in",
  "kitiltásra kijelölve": "selected to ban", "kijelölve": "selected", "Kattints egy hősre a listában.": "Click a champion in the list.",
  "Counterek": "Counters", "Saját": "Mine",
  "Kattintás: kijelölés (a csapatod látja). A gomb lezárja a választást, ha te következel.": "Click: select (your team sees it). The button locks it in when it's your turn.",
  "Ez a hős most nem választható.": "This champion can't be picked right now.", "✔ Kitiltva": "✔ Banned", "✔ Kiválasztva": "✔ Locked in",
  "A counter adat most nem érhető el.": "Counter data isn't available right now.",
  "Maxolás": "Max order", "Rúnák a kliensbe": "Runes to client", "Build a játékba": "Build to game",
  "Teljes rúnalap": "Full rune page", "Skill sorrend szintenként": "Skill order by level", "{lvl}. szint": "Level {lvl}",
  "Passzív": "Passive",
  "✔ Idézőigék beállítva!": "✔ Summoner spells set!", "idézőigék beállítva": "spells set", "idézőigék": "spells",
  "Rúnák": "Runes", "Idézőigék automatikus beállítása": "Auto-set summoner spells",
  "Lezáráskor a hőshöz ajánlott idézőigéket is beállítja.": "When you lock in, it also sets the recommended summoner spells.",
  "Flash billentyű": "Flash key", "Melyik billentyűn legyen a Flash (a beállításnál és a kijelzésnél is).": "Which key Flash goes on (when setting and displaying spells).",
  "Kezdő": "Beginner", "Haladó": "Advanced", "Legendás": "Legendary", "Mitikus": "Mythic", "Isteni": "Divine",
  "nincs friss meccs": "no recent games", "pont": "pts", "meccs a hőssel": "games on champ",
  "Az utolsó {n} meccséből {k} volt ezzel a hőssel.": "{k} of their last {n} games were on this champion.",
  "A meccselőzménye nem elérhető.": "Their match history isn't available.",
  "Az összes meccs a mastery pontokból becsült.": "Total games estimated from mastery points.",
  "A töltőképernyőnél itt jelenik meg mind a 10 játékos: mennyire ismerik a hősüket, és milyen eredménnyel játszanak vele.": "On the loading screen, all 10 players show up here: how well they know their champion and how they perform with it.",
  "Kivel játszol, ki ellen?": "Who's with you, who's against you?", "Adatok gyűjtése…": "Gathering data…", "Kész": "Done",
  "vidd az egeret egy kártyára a részletekért": "hover a card for details",
  // index.html
  "Build": "Build", "Statisztika": "Stats", "Beállítások": "Settings", "Bezárás": "Close", "Indulás…": "Starting…",
  "Válassz hőst": "Pick a champion", "Hősválasztáskor magától betöltődik": "Loads automatically in champion select",
  "Hős": "Champion", "Pozíció": "Position", "Rang adat": "Rank data", "Keresés…": "Search…",
  "Írd be a hős nevét…": "Type a champion name…", "Adatok betöltése…": "Loading data…", "Statisztika betöltése…": "Loading stats…",
  "Nyelv": "Language",
  // indulás, állapot
  "Nem sikerült letölteni az alapadatokat.": "Couldn't download the base data.", "Van internet?": "Are you online?",
  "Újrapróbálom…": "Retrying…", "Lépj be a hősválasztásba, vagy válassz hőst – akár a kedvenceid közül.": "Enter champion select, or pick a champion – even from your favorites.",
  "A program nem indult újra – indítsd el újra (INDITAS.bat vagy a LoL indítása).": "The app didn't restart – start it again (INDITAS.bat or launch LoL).",
  "Frissítés: újraindulás…": "Updating: restarting…",
  "A háttérprogram nem fut / újraindul…": "The background service isn't running / restarting…", "Várakozás a LoL kliensre…": "Waiting for the LoL client…",
  "{n}. szint": "level {n}", "{champ} · {mode} build betöltése…": "Loading {champ} · {mode} build…",
  // hiba doboz
  "Hiba": "Error", "Verzió": "Version", "Mód": "Mode", "Rang": "Rank", "Kérés": "Request", "Részletek": "Details",
  "Nem jött le a build": "Couldn't load the build", "Hiba másolása": "Copy error", "Újra": "Retry",
  "A másolt szöveget küldd el, és könnyen javítható.": "Send the copied text and it can be fixed easily.",
  "Kimásolva a vágólapra ✔": "Copied to clipboard ✔", "Kimásolva ✔": "Copied ✔", "Nem sikerült másolni": "Couldn't copy",
  "Ismeretlen hiba": "Unknown error",
  // build
  "meccs": "games", "Kevés adat": "Low sample", "Forrás": "Source", "Rúnák": "Runes", "A rúna adat most nem érhető el.": "Rune data isn't available right now.",
  "rúnák betöltve": "runes imported", "rúnák": "runes", "build a játékban (bolt → ajánlott)": "build in game (shop → recommended)",
  "tárgylista": "item set", "Automatikusan": "Automatically", "Rúnák betöltése a kliensbe": "Import runes to client",
  "Tárgyak": "Items",
  "Build betöltése a játékba": "Put the build into the game", "✔ Build betöltve a játékba!": "✔ Build added to the game!",
  "A meccs betöltése előtt kell betölteni. A játékban: bolt → bal oldalt az ajánlott tárgyak feletti lenyíló listában válaszd a „RiftMester” készletet.": "Add it before the game loads. In game: shop → pick the “RiftMester” set from the dropdown above the recommended items on the left.", "Kezdés": "Start", "arany": "gold", "javaslat": "suggestion",
  "Alap build · U.GG": "Standard build · U.GG", "Build útvonal · U.GG alap": "Build path · U.GG standard",
  "legnépszerűbb + 2 alternatíva": "most popular + 2 alternatives", "ez kerül a játékba": "this goes into the game",
  "Az ellenfelek még nem látszanak. Draftban, amint választanak, vagy meccs közben magától megjelenik.": "Enemies aren't visible yet. It appears automatically in draft once they pick, or during the game.",
  "gyógyító": "healer", "Csizma": "Boots", "helyette": "instead of", "U.GG adat": "U.GG data", "RiftMester javaslat": "RiftMester suggestion",
  "az alap build már tartalmazza": "the standard build already has it",
  "Vegyes az ellenfél csapata – az alap build jó ellenük is.": "Mixed enemy team – the standard build works against them too.",
  "{n} sokat gyógyító ellenfél → sebkésleltetés": "{n} heavy-healing enemies → Grievous Wounds",
  "{n} varázssebző (AP) ellenfél → mágiaellenállás": "{n} magic damage (AP) enemies → Magic Resist",
  "{n} fizikai sebző (AD) ellenfél → páncél": "{n} physical damage (AD) enemies → Armor",
  "{n} tank az ellenfélnél → átütés": "{n} tanks on the enemy team → penetration",
  "{n} AP ellenfél (és CC ellen is jó)": "{n} AP enemies (also good vs. CC)",
  "{n} lövész / sok alaptámadás az ellenfélnél": "{n} marksmen / lots of auto attacks",
  "kész": "done",
  "Idézőigék": "Summoner spells", "Skill sorrend": "Skill order", "Idézőigék & skillek": "Spells & skills",
  "{lvl}. szint: tedd a pontot ide →": "Level {lvl}: put your point into →",
  "Ellenfél csapat": "Enemy team", "hős": "champions", "Fizikai": "Physical", "Varázs": "Magic",
  "Sok varázssebzés ({n} AP hős). Mágiaellenállás és <b>Higany lépők</b> jól jöhet.": "Lots of magic damage ({n} AP champs). Magic resist and <b>Mercury's Treads</b> help.",
  "Sok fizikai sebzés ({n} AD hős). Páncél és <b>Páncélozott csizma</b> megfontolandó.": "Lots of physical damage ({n} AD champs). Consider armor and <b>Plated Steelcaps</b>.",
  "{n} sokat gyógyító ellenfél – vegyél <b>sebkésleltető</b> tárgyat.": "{n} heavy-healing enemies – buy a <b>Grievous Wounds</b> item.",
  "{n} tank az ellenfélnél – <b>átütés</b> vagy %-os sebzés kell.": "{n} tanks on the enemy team – you need <b>penetration</b> or % damage.",
  "Vegyes az ellenfél sebzése – maradhat az ajánlott build.": "Mixed enemy damage – the recommended build is fine.",
  "Tippek a hőshöz": "Champion tips",
  "Hiányos rúna adat, nem tudom betölteni.": "Incomplete rune data, can't import.", "✔ Rúnalap betöltve a kliensbe!": "✔ Rune page imported to the client!",
  "Nincs szabad rúnalap-helyed.\nFelülírjam az épp kiválasztott rúnalapodat?": "You have no free rune page slot.\nOverwrite your currently selected rune page?",
  "Nem sikerült.": "Failed.", "Nem sikerült": "Failed",
  // kedvencek, statisztika
  "Kedvenceid": "Favorites", "győzelem": "wins", "{n} perce": "{n} min ago", "{n} órája": "{n} h ago", "{n} napja": "{n} days ago",
  "Játékos": "Player", "meccs tárolva": "games stored", "szezon": "season", "-tól": " onwards", "Frissül…": "Updating…", "Frissítés": "Refresh",
  "Rangsorolatlan": "Unranked", "Mind": "All",
  "Ebben a módban még nincs meccsed a szezonban.": "No games in this mode this season yet.",
  "Indítsd el a LoL klienst – a meccseidet onnan olvassa be.<br>A statisztika a program használatával folyamatosan bővül.": "Start the LoL client – your games are read from there.<br>Stats keep growing as you use the app.",
  "vereség": "losses", "sorozat": "streak", "átlag K/D/A": "avg K/D/A", "győzelem / vereség": "wins / losses",
  "Hőseid a szezonban": "Your champions this season", "Legutóbbi meccsek": "Recent games", "Győzelem": "Victory", "Vereség": "Defeat",
  "{n}× győzelem": "{n} wins in a row", "{n}× vereség": "{n} losses in a row",
  // beállítások
  "Kikapcsolva": "Off", "Kézzel indítod (INDITAS.bat).": "You start it manually (INDITAS.bat).",
  "A LoL-lal együtt": "With LoL", "A géppel együtt elindul a háttérben (kb. 25 MB), és csak akkor nyílik meg, amikor elindítod a LoL-t. Ajánlott.": "Starts quietly in the background with your PC (~25 MB) and only opens when you launch LoL. Recommended.",
  "A Windows-szal együtt": "With Windows", "A gép indulásakor azonnal megnyílik az ablak, és a LoL indulásakor is.": "The window opens right when your PC starts, and when LoL starts.",
  "Indítás": "Startup", "Hősválasztáskor": "In champion select",
  "Rúnák automatikus betöltése": "Auto-import runes", "Amint lezárod a hőst, beállítja a rúnalapot a kliensben.": "As soon as you lock in, it sets your rune page in the client.",
  "Ha nincs szabad rúnalap, írja felül az aktuálisat": "If no rune page slot is free, overwrite the current one", "Kikapcsolva ilyenkor nem csinál semmit.": "When off, it does nothing in that case.",
  "Build betöltése a játékba": "Put the build into the game", "Mindig az alap U.GG build kerül be tárgylistaként, mielőtt indul a meccs: a boltban az ajánlott tárgyaknál látod.": "The standard U.GG build is always added as an item set before the game starts – you'll see it in the shop under recommended items.",
  "Megjelenés": "Appearance", "Ablak a második monitoron": "Window on the second monitor", "A második monitor jobb szélén nyílik meg.": "Opens on the right edge of your second monitor.",
  "Meccs közben a tárgyak legyenek felül": "Items on top during the game", "A rúnák összecsukódnak, a build útvonal kerül előre.": "Runes collapse and the build path moves to the top.",
  "Tárgyak nézete": "Items view", "Alap U.GG build, ellenfél szerinti build, vagy mindkettő egymás alatt.": "Standard U.GG build, enemy-based build, or both stacked.",
  "Alap rang adat": "Default rank data", "Melyik rangú játékosok buildjeit mutassa.": "Whose builds to show, by rank.",
  "Szezon kezdete": "Season start", "Ettől a naptól számolja a statisztikát. Üresen: az év eleje.": "Stats are counted from this day. Empty: start of the year.",
  "Automatikus frissítés": "Auto update", "Új verzió esetén mit csináljon.": "What to do when a new version is out.",
  "Magától frissít": "Update automatically", "Kérdezzen meg": "Ask me", "Frissítési cím": "Update URL",
  "Frissítés keresése most": "Check for updates now", "automatikus indítás aktív": "autostart active", "A beállítások azonnal mentődnek.": "Settings are saved instantly.",
  "Mentve ✔": "Saved ✔", "Frissítés letöltve, újraindul…": "Update downloaded, restarting…", "Nincs új verzió.": "No new version.",
  "Nem sikerült menteni": "Couldn't save", "A program nyelve. Váltáskor a hős- és tárgynevek is átváltanak.": "App language. Champion and item names switch too.",
  // frissítés jelzés, menük
  "Frissítve": "Updated", "Új verzió": "New version", "Nincs találat": "No results", "ajánlott": "recommended",
  "kliens / legnépszerűbb": "client / most popular", "Statisztikai rúna": "Stat shard", "a sor alapján": "from your queue",
};
