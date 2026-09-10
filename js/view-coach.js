/* ===== Obrazovka: Zeptej se — AI nad vlastními daty =====
   Martin trénuje sám, takže tohle je náhrada za druhý pár očí: model dostane
   jako kontext stejný report, který jinak kopíruje do chatu, a odpovídá nad
   konkrétními čísly z appky.

   Konverzace žije jen v paměti záložky — do S nepatří (zaplnila by sync)
   a po zavření appky se maže. Klíč je stejný jako u čtení etiket. */
"use strict";

const CO = {
  messages: [],      // { role: "user"|"assistant", text }
  busy: false,
  error: null,
  draft: "",
  range: "month"     // rozsah dat poslaných jako kontext
};

const COACH_PRESETS = [
  "Co mi v tréninku utíká?",
  "Mám někde přidat objem?",
  "Jak jde progrese?",
  "Co zlepšit na stravě?"
];

const COACH_SYSTEM = `Jsi tréninkový parťák v osobní fitness appce jednoho uživatele.
Trénuje sám, nemá trenéra — proto se ptá tebe.

Odpovídej ČESKY, konkrétně a stručně: tři až pět vět, nebo krátký seznam.
Žádné dlouhé eseje a žádné obecné poučky z internetu.

Vždy vycházej z jeho reálných dat níže a cituj z nich konkrétní čísla
(„na záda máš 6 sérií týdně, na hrudník 12"). Když k odpovědi data chybí,
řekni to rovnou místo odhadování.

Pravidla:
- Nediagnostikuj zdravotní potíže. Při zmínce o bolesti nebo zranění doporuč
  odborníka a nedávej cvičební rady na to místo.
- Doporučení drž konzervativní. Nevidíš, jak spí, kolik má stresu, co ho bolí
  ani jak se u série cítil — když na tom odpověď závisí, zeptej se.
- Nevymýšlej si čísla, která v datech nejsou.
- Formátuj prostým textem, odrážky pomocí "- ". Zvýraznit jde **takto**.

=== DATA Z APPKY ===`;

function renderCoach() {
  const hasKey = !!(Settings.get().anthropicApiKey || "").trim();

  if (!hasKey) {
    return `
      <div class="card">
        <div class="h2">Zeptej se</div>
        <p class="muted" style="margin:10px 0 14px">Pro odpovědi nad tvými daty je potřeba
          Claude API klíč — stejný, jakým appka čte nutriční etikety.</p>
        <button class="btn primary full" data-act="menu" data-page="settings">Vložit klíč v Nastavení →</button>
      </div>`;
  }

  const presets = COACH_PRESETS.map(q =>
    `<button class="chip" data-act="co-preset" data-q="${esc(q)}">${esc(q)}</button>`).join("");

  const thread = CO.messages.map(m => m.role === "user"
    ? `<div class="co-msg co-user">${esc(m.text)}</div>`
    : `<div class="co-msg co-ai">${mdLite(m.text)}</div>`).join("");

  const empty = `
    <div class="card">
      <div class="h2">Zeptej se</div>
      <p class="muted" style="margin:10px 0 0">Model dostane tvoje data z posledních
        30 dní — tréninky, série, rekordy, váhu i stravu — a odpoví nad nimi.
        Konverzace se nikam neukládá.</p>
    </div>`;

  return `
    ${CO.messages.length ? "" : empty}
    <div class="chips">${presets}</div>
    ${thread}
    ${CO.busy ? `<div class="co-msg co-ai co-busy">Přemýšlím nad tvými daty…</div>` : ""}
    ${CO.error ? `<div class="card" style="border-color:var(--red)">
      <div class="small" style="color:var(--red)">${esc(CO.error)}</div></div>` : ""}
    <div class="card co-input">
      <textarea class="input" id="coInput" rows="2"
        placeholder="Zeptej se na cokoliv o svém tréninku…">${esc(CO.draft)}</textarea>
      <div class="row mt" style="gap:8px">
        <button class="btn primary grow" data-act="co-send"${CO.busy ? " disabled" : ""}>Odeslat</button>
        ${CO.messages.length ? `<button class="btn ghost" data-act="co-clear">Vymazat</button>` : ""}
      </div>
    </div>`;
}

/* Odpověď modelu je prostý text s odrážkami a **zvýrazněním** — víc formátování
   nepotřebuje. Escapuje se PŘED nahrazením, ať se z odpovědi nedá vložit HTML. */
function mdLite(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .split("\n")
    .map(line => {
      const t = line.trim();
      if (!t) return "";
      if (/^[-•]\s+/.test(t)) return `<div class="co-li">${t.replace(/^[-•]\s+/, "")}</div>`;
      return `<p>${t}</p>`;
    })
    .join("");
}

async function askCoach(question) {
  const q = (question || "").trim();
  if (!q || CO.busy) return;
  const key = (Settings.get().anthropicApiKey || "").trim();
  if (!key) { CO.error = "Chybí Claude API klíč — vlož ho v Nastavení"; render(); return; }

  CO.messages.push({ role: "user", text: q });
  CO.draft = "";
  CO.busy = true;
  CO.error = null;
  render();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 1024,
        system: COACH_SYSTEM + "\n" + buildCoachReport(CO.range),
        messages: CO.messages.map(m => ({ role: m.role, content: m.text }))
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data.error && data.error.message) || "HTTP " + res.status);
    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("").trim();
    if (!text) throw new Error("Model nevrátil odpověď");
    CO.messages.push({ role: "assistant", text });
  } catch (e) {
    // otázka bez odpovědi by v konverzaci jen mátla
    CO.messages.pop();
    CO.error = "Nepovedlo se: " + e.message;
  }
  CO.busy = false;
  render();
  const el = document.getElementById("coInput");
  if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
}
