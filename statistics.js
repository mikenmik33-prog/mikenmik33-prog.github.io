const STORAGE_KEY = "profit_ledger_entries_v2";
function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
    const d = new Date(),
        tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
}

function pad2(n) {
    return String(n).padStart(2, "0");
}

const UA_DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];

function formatDateDisplay(ds) {
    if (!ds) return "Оберіть дату";
    return new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(ds + "T00:00:00"));
}

function monthLabel(year, month) {
    const s = new Intl.DateTimeFormat("uk-UA", { month: "long", year: "numeric" }).format(
        new Date(year, month, 1),
    );
    return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildCalendarCells(year, month, selectedDs, todayDs) {
    const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const cells = [];
    for (let i = 0; i < startOffset; i++) {
        cells.push({ day: daysInPrevMonth - startOffset + i + 1, muted: true });
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const ds = `${year}-${pad2(month + 1)}-${pad2(d)}`;
        cells.push({ day: d, ds, isToday: ds === todayDs, isSelected: ds === selectedDs });
    }
    let next = 1;
    while (cells.length % 7 !== 0) cells.push({ day: next++, muted: true });
    return cells;
}

function setDateValue(input, value) {
    input.value = value;
    if (input._syncDatePicker) input._syncDatePicker();
}

function attachDatePicker(input) {
    if (!input || input.dataset.pickerAttached) return;
    input.dataset.pickerAttached = "1";
    input.style.display = "none";

    const wrap = document.createElement("div");
    wrap.className = "date-picker-wrap";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "date-picker-trigger";
    wrap.appendChild(trigger);

    const menu = document.createElement("div");
    menu.className = "date-picker-menu";
    menu.hidden = true;
    wrap.appendChild(menu);

    let viewYear, viewMonth;

    function renderTrigger() {
        trigger.innerHTML = `<span>${formatDateDisplay(input.value)}</span><span class="date-picker-icon">▦</span>`;
    }

    function renderMenu() {
        const cells = buildCalendarCells(viewYear, viewMonth, input.value, todayStr());
        const dowHtml = UA_DOW.map((d) => `<div class="dow">${d}</div>`).join("");
        const daysHtml = cells
            .map((c) => {
                if (c.muted) return `<div class="day muted">${c.day}</div>`;
                const cls = ["day"];
                if (c.isToday) cls.push("today");
                if (c.isSelected) cls.push("selected");
                return `<div class="${cls.join(" ")}" data-date-pick="${c.ds}">${c.day}</div>`;
            })
            .join("");
        menu.innerHTML = `
          <div class="date-picker-head">
            <span class="date-picker-nav" data-nav="-1">‹</span>
            <span>${monthLabel(viewYear, viewMonth)}</span>
            <span class="date-picker-nav" data-nav="1">›</span>
          </div>
          <div class="date-picker-grid">${dowHtml}${daysHtml}</div>`;
    }

    function openMenu() {
        const d = input.value ? new Date(input.value + "T00:00:00") : new Date();
        viewYear = d.getFullYear();
        viewMonth = d.getMonth();
        renderMenu();
        menu.hidden = false;
        trigger.classList.add("open");
    }

    function closeMenu() {
        menu.hidden = true;
        trigger.classList.remove("open");
    }

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        if (menu.hidden) openMenu();
        else closeMenu();
    });

    menu.addEventListener("click", (e) => {
        const nav = e.target.closest("[data-nav]");
        if (nav) {
            e.stopPropagation();
            viewMonth += Number(nav.dataset.nav);
            if (viewMonth < 0) {
                viewMonth = 11;
                viewYear--;
            }
            if (viewMonth > 11) {
                viewMonth = 0;
                viewYear++;
            }
            renderMenu();
            return;
        }
        const dayEl = e.target.closest("[data-date-pick]");
        if (dayEl) {
            input.value = dayEl.dataset.datePick;
            input.dispatchEvent(new Event("input", { bubbles: true }));
            input.dispatchEvent(new Event("change", { bubbles: true }));
            renderTrigger();
            closeMenu();
        }
    });

    document.addEventListener("click", (e) => {
        if (!wrap.contains(e.target)) closeMenu();
    });

    input._syncDatePicker = renderTrigger;
    renderTrigger();
}

function fmt(n) {
    return new Intl.NumberFormat("uk-UA").format(Math.round(n * 100) / 100);
}

function toKopecks(hryvnia) {
    return Math.round((Number(hryvnia) || 0) * 100);
}

function fmtKop(kop) {
    return fmt((Number(kop) || 0) / 100);
}

const soldQty = (e) => e.sales.reduce((a, s) => a + s.qty, 0);
const remainingQty = (e) => Math.max(0, e.qty - soldQty(e));
function unformatNumberInput(raw) {
    return raw.replace(/\s/g, "").replace(",", ".");
}

function formatNumberInput(raw) {
    let v = raw.replace(/[^\d.,]/g, "");
    const i = Math.max(v.lastIndexOf(","), v.lastIndexOf("."));
    let a,
        b = null;
    if (i !== -1) {
        a = v.slice(0, i).replace(/[.,]/g, "");
        b = v.slice(i + 1).replace(/[.,]/g, "");
    } else a = v;
    a = a.replace(/^0+(?=\d)/, "");
    const g = (a || "").replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return b !== null ? g + "," + b : g;
}

function attachThousandsFormatting(input) {
    input.addEventListener("input", (e) => {
        const el = e.target,
            p = el.selectionStart,
            v = el.value,
            d = v.slice(0, p).replace(/[^\d]/g, "").length,
            f = formatNumberInput(v);
        el.value = f;
        let c = 0,
            pos = f.length;
        for (let i = 0; i < f.length; i++) {
            if (/\d/.test(f[i])) c++;
            if (c === d) {
                pos = i + 1;
                break;
            }
        }
        el.setSelectionRange(d === 0 ? 0 : pos, d === 0 ? 0 : pos);
    });
}

function costOfSoldKop(entry) {
    return entry.sales.reduce((a, s) => a + s.costKop, 0);
}

function remainingCostKop(entry) {
    return Math.max(0, entry.buyKop - costOfSoldKop(entry));
}

function costForNewSaleChunk(entry, qty) {
    const remaining = remainingQty(entry);
    if (!remaining) return 0;
    const remCost = remainingCostKop(entry);
    if (qty >= remaining) return remCost;
    return Math.round((remCost * qty) / remaining);
}

function normalizeEntries(raw) {
    return raw.map((e) => {
        const buyKop = e.buyKop != null ? Math.round(Number(e.buyKop)) || 0 : toKopecks(e.buy);
        const qty = Number(e.qty) > 0 ? Number(e.qty) : 1;
        const entryForCost = { buyKop, qty, sales: [] };

        let rawSales;
        if (Array.isArray(e.sales)) {
            rawSales = e.sales;
        } else if (e.sell == null) {
            rawSales = [];
        } else {
            rawSales = [
                {
                    qty: Number(e.qty) || 1,
                    revenue: Number(e.sell) || 0,
                    date: e.date,
                    createdAt: e.createdAt,
                },
            ];
        }

        const sales = rawSales.map((s) => {
            const saleQty = Number(s.qty) || 0;
            const revenueKop =
                s.revenueKop != null ? Math.round(Number(s.revenueKop)) || 0 : toKopecks(s.revenue);
            const costKop =
                s.costKop != null
                    ? Math.round(Number(s.costKop)) || 0
                    : costForNewSaleChunk(entryForCost, saleQty);
            const sale = {
                id: s.id || uid(),
                qty: saleQty,
                revenueKop,
                costKop,
                date: (s.date || e.date || todayStr()).slice(0, 10),
                createdAt: s.createdAt || Date.now(),
            };
            entryForCost.sales.push(sale);
            return sale;
        });

        return {
            id: e.id || uid(),
            name: e.name || "Без назви",
            buyKop,
            qty,
            date: (e.date || todayStr()).slice(0, 10),
            createdAt: e.createdAt || Date.now(),
            sales,
        };
    });
}
function loadEntries() {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v) return normalizeEntries(JSON.parse(v));
        const o = localStorage.getItem("profit_ledger_entries");
        return o ? normalizeEntries(JSON.parse(o)) : [];
    } catch (e) {
        return [];
    }
}
function saveEntries() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}
let entries = loadEntries();
function repairForcedClosureBuyKop() {
    let changed = false;
    entries.forEach((e) => {
        if (remainingQty(e) === 0) {
            const soldCostKop = costOfSoldKop(e);
            if (soldCostKop !== e.buyKop) {
                e.buyKop = soldCostKop;
                changed = true;
            }
        }
    });
    if (changed) saveEntries();
}
repairForcedClosureBuyKop();

// Зводить докупи однакові партії: та сама назва, та сама дата, та сама ціна
// за штуку і нічого ще не продано. Партії з різною ціною або різною датою не
// чіпає — на першому тримається собівартість продажів (FIFO), на другій —
// KPI «Витрачено» за період.
function consolidateEntries() {
    const kept = [];
    let changed = false;
    entries.forEach((e) => {
        if (e.qty <= 0 || soldQty(e) > 0) {
            kept.push(e);
            return;
        }
        const key = groupKey(e.name);
        // e.buyKop / e.qty === t.buyKop / t.qty, але без ділення й похибок float
        const target = kept.find(
            (t) =>
                soldQty(t) === 0 &&
                t.qty > 0 &&
                t.date === e.date &&
                groupKey(t.name) === key &&
                t.buyKop * e.qty === e.buyKop * t.qty,
        );
        if (target) {
            target.qty += e.qty;
            target.buyKop += e.buyKop;
            target.createdAt = Math.min(target.createdAt, e.createdAt);
            changed = true;
        } else {
            kept.push(e);
        }
    });
    if (changed) entries = kept;
    return changed;
}
if (consolidateEntries()) saveEntries();
let dayOpenState = {};
let dailyVisibleDays = 1;
const unitCostKop = (e) => {
    const r = remainingQty(e);
    return r ? remainingCostKop(e) / r : 0;
};

const saleProfitKop = (s) => s.revenueKop - s.costKop;
const allSales = () => entries.flatMap((e) => e.sales.map((s) => ({ ...s, entry: e })));
function dayLabel(ds) {
    const d = new Date(ds + "T00:00:00"),
        t = new Date();
    t.setHours(0, 0, 0, 0);
    const diff = Math.round((t - d) / 86400000);
    if (diff === 0) return "Сьогодні";
    if (diff === 1) return "Вчора";
    return new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(d);
}
function saleWord(n) {
    const mod10 = n % 10,
        mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return "продаж";
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "продажі";
    return "продажів";
}
function escapeHtml(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
const SUPERSCRIPT_DIGITS = {
    0: "⁰",
    1: "¹",
    2: "²",
    3: "³",
    4: "⁴",
    5: "⁵",
    6: "⁶",
    7: "⁷",
    8: "⁸",
    9: "⁹",
};
function toSuperscript(n) {
    return String(n)
        .split("")
        .map((d) => SUPERSCRIPT_DIGITS[d] ?? d)
        .join("");
}
function priceBreakdown(items) {
    const order = [];
    const map = {};
    items.forEach((e) => {
        const price = unitCostKop(e);
        const label = fmtKop(price);
        if (!map[label]) {
            map[label] = { price, qty: 0 };
            order.push(label);
        }
        map[label].qty += remainingQty(e);
    });
    return order
        .sort((a, b) => map[a].price - map[b].price)
        .map((label) => label + (map[label].qty > 1 ? toSuperscript(map[label].qty) : ""))
        .join(" · ");
}

function groupKey(name) {
    return name.trim().toLowerCase().replace(/\s+/g, " ");
}

// Єдиний список 18 «своїх» кейсів. Тільки вони враховуються у СТАТИСТИЦІ
// КІЛЬКОСТІ (KPI «Продано, к-сть», модалка «Продано кейсів за весь час»,
// «Топ-3 кейси»). Будь-які інші предмети можна купувати, продавати, редагувати
// й видаляти — вони просто йдуть лише у грошову статистику.
const KNOWN_CASES = [
    { canonical: "Форсаж", aliases: ["форсаж"] },
    { canonical: "Темні справи", aliases: ["темні справи", "тд"] },
    { canonical: "Опер", aliases: ["опер"] },
    { canonical: "Новорічний", aliases: ["новорічний"] },
    { canonical: "Чорне Золото", aliases: ["чорне золото", "чз"] },
    { canonical: "ВН1", aliases: ["вн1"] },
    { canonical: "Охота", aliases: ["охота"] },
    { canonical: "ЄС", aliases: ["єс", "ес"] },
    { canonical: "ВН2", aliases: ["вн2"] },
    { canonical: "РЄ", aliases: ["рє", "ре"] },
    { canonical: "Путь воіна (ПВ)", aliases: ["путь воіна", "путь воіна (пв)", "пв"] },
    { canonical: "Пірат", aliases: ["пірат"] },
    { canonical: "Прокляття", aliases: ["прокляття"] },
    { canonical: "Зимня казка", aliases: ["зимня казка", "зс"] },
    { canonical: "Бандит", aliases: ["бандит"] },
    { canonical: "Клоун", aliases: ["клоун"] },
    { canonical: "Мандариновий", aliases: ["мандариновий", "мандарин"] },
    { canonical: "Тиха розкіш", aliases: ["тиха розкіш"] },
];
const CASE_ALIAS_MAP = (() => {
    const map = {};
    KNOWN_CASES.forEach(({ canonical, aliases }) => {
        aliases.forEach((alias) => {
            map[groupKey(alias)] = canonical;
        });
    });
    return map;
})();
function canonicalCaseName(name) {
    return CASE_ALIAS_MAP[groupKey(name)] || null;
}
function isKnownCase(name) {
    return canonicalCaseName(name) !== null;
}

function levenshtein(a, b) {
    const m = a.length,
        n = b.length;
    if (!m) return n;
    if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
        const curr = [i];
        for (let j = 1; j <= n; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
        }
        prev = curr;
    }
    return prev[n];
}

function getAllKnownCaseNames() {
    const map = {};
    entries.forEach((e) => {
        const key = groupKey(e.name);
        if (key && !map[key]) map[key] = e.name;
    });
    return map;
}

// Підказує схожу вже наявну назву кейса, щоб описка (напр. "Форсаш" замість
// "Форсаж") не створювала окрему групу в інвентарі. Ігнорує короткі назви й
// назви з цифрами (ВН1/ВН2, ЄС тощо навмисно схожі — це різні кейси).
function findSimilarCaseName(typedName) {
    const typedKey = groupKey(typedName || "");
    if (typedKey.length < 3 || /\d/.test(typedKey)) return null;
    const known = getAllKnownCaseNames();
    if (known[typedKey]) return null;
    let best = null;
    for (const key in known) {
        if (/\d/.test(key)) continue;
        if (Math.abs(key.length - typedKey.length) > 2) continue;
        const dist = levenshtein(typedKey, key);
        const threshold = typedKey.length > 5 ? 2 : 1;
        if (dist > 0 && dist <= threshold && (!best || dist < best.dist)) {
            best = { key, name: known[key], dist };
        }
    }
    return best;
}
function getGroupEntries(key) {
    return entries
        .filter((e) => remainingQty(e) > 0 && groupKey(e.name) === key)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
}
function getCaseGroups() {
    const order = [];
    const map = {};
    entries.forEach((e) => {
        const rem = remainingQty(e);
        if (rem <= 0) return;
        const key = groupKey(e.name);
        if (!map[key]) {
            map[key] = { key, name: e.name, qty: 0 };
            order.push(key);
        }
        map[key].qty += rem;
    });
    return order
        .map((key) => map[key])
        .sort((a, b) => a.name.localeCompare(b.name, "uk"));
}

function allocateSale(key, qty, sellTotalKop, date) {
    const items = getGroupEntries(key);
    if (!items.length) {
        return { ok: false, error: "Оберіть кейс зі списку наявних" };
    }
    const available = items.reduce((a, e) => a + remainingQty(e), 0);
    if (!Number.isInteger(qty) || qty < 1 || qty > available) {
        return { ok: false, error: `Кількість має бути від 1 до ${available} шт` };
    }
    if (!Number.isFinite(sellTotalKop) || sellTotalKop < 0) {
        return { ok: false, error: "Вкажіть коректну суму продажу" };
    }
    let remainingToSell = qty;
    let remainingRevenueKop = sellTotalKop;
    for (const item of items) {
        if (remainingToSell <= 0) break;
        const take = Math.min(remainingToSell, remainingQty(item));
        if (take <= 0) continue;
        const isLastChunk = take === remainingToSell;
        const revenueForChunk = isLastChunk
            ? remainingRevenueKop
            : Math.round((sellTotalKop * take) / qty);
        item.sales.push({
            id: uid(),
            qty: take,
            revenueKop: revenueForChunk,
            costKop: costForNewSaleChunk(item, take),
            date,
            createdAt: Date.now(),
        });
        remainingToSell -= take;
        remainingRevenueKop -= revenueForChunk;
    }
    return { ok: true };
}

(() => {
    const back = document.getElementById("topbarBack");
    if (back) back.addEventListener("click", () => { window.location.href = "../system/index.html"; });
})();

let backupFileHandle = null;
function buildBackupPayload() {
    return {
        app: "profit-ledger",
        exportedAt: new Date().toISOString(),
        entries,
    };
}
async function writeToHandle(handle) {
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(buildBackupPayload()));
    await writable.close();
}
async function exportData() {
    if (!("showSaveFilePicker" in window)) {
        alert("Ваш браузер не підтримує збереження файлу. Спробуйте Chrome, Edge або Opera.");
        return;
    }
    try {
        if (backupFileHandle) {
            const perm = await backupFileHandle.queryPermission({ mode: "readwrite" });
            if (perm !== "granted") {
                const req = await backupFileHandle.requestPermission({ mode: "readwrite" });
                if (req !== "granted") backupFileHandle = null;
            }
        }
        if (!backupFileHandle) {
            backupFileHandle = await window.showSaveFilePicker({
                suggestedName: "profit-ledger-backup.json",
                types: [
                    {
                        description: "JSON файл",
                        accept: { "application/json": [".json"] },
                    },
                ],
            });
        }
        await writeToHandle(backupFileHandle);
    } catch (err) {
        if (err && err.name === "AbortError") return;
        console.error(err);
        backupFileHandle = null;
        alert("Не вдалося зберегти файл.");
    }
}
function importData(file) {
    const reader = new FileReader();
    reader.onload = () => {
        let parsed;
        try {
            parsed = JSON.parse(reader.result);
        } catch (e) {
            alert("Не вдалося прочитати файл: це не коректний JSON.");
            return;
        }
        const rawEntries = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null;
        if (!rawEntries) {
            alert("Файл не схожий на резервну копію цього застосунку.");
            return;
        }
        if (
            !confirm(
                `Відновити дані з файлу? Буде замінено поточні дані (${entries.length} товарів) на дані з файлу (${rawEntries.length} товарів). Це незворотньо.`,
            )
        )
            return;
        entries = normalizeEntries(rawEntries);
        consolidateEntries();
        saveEntries();
        render();
        alert("Дані успішно відновлено.");
    };
    reader.onerror = () => alert("Не вдалося прочитати файл.");
    reader.readAsText(file);
}
document.getElementById("exportBtn").addEventListener("click", exportData);
document.getElementById("importBtn").addEventListener("click", () => {
    document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importData(file);
    e.target.value = "";
});

function updateCurrentTime() {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    document.getElementById("currentTime").innerHTML =
        `${hh}<span class="colon">:</span>${mm}<span class="colon">:</span>${ss}`;
}

function renderInventory() {
    const open = entries.filter((e) => remainingQty(e) > 0);
    const order = [];
    const groupsMap = {};
    open.forEach((e) => {
        const key = groupKey(e.name);
        if (!groupsMap[key]) {
            groupsMap[key] = [];
            order.push(key);
        }
        groupsMap[key].push(e);
    });
    const groups = order.map((key) => {
        const items = groupsMap[key];
        const qty = items.reduce((a, e) => a + remainingQty(e), 0);
        const costKop = items.reduce((a, e) => a + remainingCostKop(e), 0);
        const avgCpuKop = qty ? costKop / qty : 0;
        const dateEntry = items.reduce(
            (latest, it) => (new Date(it.date) > new Date(latest.date) ? it : latest),
            items[0],
        );
        return {
            key,
            name: items[0].name,
            qty,
            cpuKop: avgCpuKop,
            dateEntryId: dateEntry.id,
            breakdown: items.length > 1 ? priceBreakdown(items) : "",
        };
    });
    document.getElementById("inventoryBadge").textContent =
        groups.reduce((a, g) => a + g.qty, 0) + " шт";
    document.getElementById("inventoryBody").innerHTML = groups.length
        ? groups
              .map(
                  (g) => `<tr class="inventory-row" data-edit-purchase="${escapeHtml(g.dateEntryId)}" title="Натисніть, щоб редагувати">
        <td><b>${escapeHtml(g.name)}</b></td>
        <td class="qty-green">${g.qty} шт</td>
        <td>${fmtKop(g.cpuKop)} ₴${g.breakdown ? `<div class="inventory-price-breakdown" title="Кількість штук за кожною ціною">${g.breakdown}</div>` : ""}</td>
        <td><div class="inventory-actions"><button class="delete-action-btn" data-delete-group="${escapeHtml(g.key)}" title="Видалити">×</button></div></td>
      </tr>`,
              )
              .join("")
        : `<tr><td colspan="4" style="padding:25px;color:#737c8b;text-align:center">Усе продано</td></tr>`;
    const positions = groups.length,
        qty = groups.reduce((a, g) => a + g.qty, 0),
        costKop = open.reduce((a, e) => a + remainingCostKop(e), 0);
    document.getElementById("inventorySummary").innerHTML = `
      <div class="summary-cell"><div class="summary-icon">◇</div><div><div class="summary-label">Товарів у наявності</div><div class="summary-value">${positions} позицій</div></div></div>
      <div class="summary-cell"><div class="summary-icon">□</div><div><div class="summary-label">Кількість у наявності</div><div class="summary-value">${qty} шт</div></div></div>
      <div class="summary-cell"><div class="summary-icon">◎</div><div><div class="summary-label">Собівартість у наявності</div><div class="summary-value">${fmtKop(costKop)} ₴</div></div></div>`;
}

document.addEventListener("click", (e) => {
    if (e.target.closest("[data-delete-group]")) return;
    const editTarget = e.target.closest("[data-edit-purchase]");
    if (editTarget) {
        openEditBuyModal(editTarget.dataset.editPurchase);
    }
});

document.addEventListener("click", (e) => {
    const delBtn = e.target.closest("[data-delete-group]");
    if (delBtn) {
        const key = delBtn.dataset.deleteGroup;
        const items = getGroupEntries(key);
        if (!items.length) return;
        const qty = items.reduce((a, e) => a + remainingQty(e), 0);
        if (
            confirm(
                `Видалити з наявності «${items[0].name}» (${qty} шт, ${items.length} ${items.length === 1 ? "партія" : "партій"})? Уже продані одиниці та історія продажів по них залишаться.`,
            )
        ) {
            items.forEach((it) => {
                const sold = soldQty(it);
                if (sold === 0) {
                    entries = entries.filter((x) => x.id !== it.id);
                } else {
                    const target = entries.find((x) => x.id === it.id);
                    if (target) {
                        target.buyKop = Math.round((target.buyKop * sold) / target.qty);
                        target.qty = sold;
                    }
                }
            });
            saveEntries();
            render();
        }
        return;
    }
});

function renderDaily() {
    const by = {};
    allSales().forEach((s) => (by[s.date] ??= []).push(s));
    const dates = Object.keys(by).sort((a, b) => new Date(b) - new Date(a));
    dates.forEach((date) => {
        if (!(date in dayOpenState)) {
            dayOpenState[date] = date === dates[0];
        }
    });
    const visibleDates = dates.slice(0, dailyVisibleDays);
    document.getElementById("dailySales").innerHTML = dates.length
        ? visibleDates
              .map((date) => {
                  const arr = by[date],
                      dayRevenueKop = arr.reduce((a, s) => a + s.revenueKop, 0),
                      isOpen = !!dayOpenState[date];
                  const order = [];
                  const groupsMap = {};
                  arr.forEach((s) => {
                      const key = groupKey(s.entry.name);
                      if (!groupsMap[key]) {
                          groupsMap[key] = { name: s.entry.name, sales: [] };
                          order.push(key);
                      }
                      groupsMap[key].sales.push(s);
                  });
                  const rows = order
                      .map((key) => {
                          const g = groupsMap[key];
                          const qty = g.sales.reduce((a, s) => a + s.qty, 0);
                          const revenueKop = g.sales.reduce((a, s) => a + s.revenueKop, 0);
                          const costKop = g.sales.reduce((a, s) => a + s.costKop, 0);
                          const profitKop = revenueKop - costKop;
                          const roi = costKop ? (profitKop / costKop) * 100 : 0;
                          const refs = g.sales.map((s) => `${s.entry.id}:${s.id}`).join(",");
                          return `<tr><td>${escapeHtml(g.name)}</td><td>${qty} шт</td><td style="color:#4ade80;font-weight:700">+${fmtKop(profitKop)} ₴</td><td style="color:${profitKop >= 0 ? "#4ade80" : "#ef4444"};font-weight:700">${roi >= 0 ? "+" : ""}${fmt(roi)}%</td><td><div class="sale-actions"><button class="sale-edit-btn" data-edit-sale-group="${refs}" title="Редагувати продаж">✎</button><button class="sale-delete-btn" data-delete-sale-group="${refs}" title="Видалити продаж">×</button></div></td></tr>`;
                      })
                      .join("");
                  return `<div class="day-card${isOpen ? " is-open" : ""}">
        <div class="day-head" data-day-toggle="${date}">
          <div class="day-head-text"><span class="day-date">▣ &nbsp;${dayLabel(date)}</span><span class="day-meta">· ${arr.length} ${saleWord(arr.length)} · ${fmtKop(dayRevenueKop)} ₴</span></div>
          <span class="day-toggle-arrow">▶</span>
        </div>
        <div class="day-body"><div class="day-body-inner">
        <table class="sales-table"><thead><tr><th>Назва</th><th>Продано, шт</th><th>Прибуток</th><th>ROI</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table>
        </div></div>
      </div>`;
              })
              .join("") +
          (dailyVisibleDays < dates.length || dailyVisibleDays > 1
              ? `<div class="daily-more-row">${
                    dailyVisibleDays < dates.length
                        ? `<button type="button" class="backup-btn daily-more-btn" data-daily-more="1">Показати ще ${dates.length - dailyVisibleDays}</button>`
                        : ""
                }${
                    dailyVisibleDays > 1
                        ? `<button type="button" class="backup-btn daily-less-btn" data-daily-less="1">Закрити</button>`
                        : ""
                }</div>`
              : "")
        : `<div style="padding:30px;text-align:center;color:#737c8b">Продажів ще немає</div>`;
}
document.addEventListener("click", (e) => {
    const dayToggleEl = e.target.closest("[data-day-toggle]");
    if (dayToggleEl) {
        const date = dayToggleEl.dataset.dayToggle;
        dayOpenState[date] = !dayOpenState[date];
        renderDaily();
        return;
    }
    const moreBtn = e.target.closest("[data-daily-more]");
    if (moreBtn) {
        dailyVisibleDays += 7;
        renderDaily();
        return;
    }
    const lessBtn = e.target.closest("[data-daily-less]");
    if (lessBtn) {
        dailyVisibleDays = 1;
        renderDaily();
        return;
    }
    const collapseAllBtn = e.target.closest("#collapseAllDaysBtn");
    if (collapseAllBtn) {
        Object.keys(dayOpenState).forEach((date) => {
            dayOpenState[date] = false;
        });
        renderDaily();
    }
});

document.addEventListener("click", (e) => {
    const delSaleGroupBtn = e.target.closest("[data-delete-sale-group]");
    if (delSaleGroupBtn) {
        const refs = parseSaleRefs(delSaleGroupBtn.dataset.deleteSaleGroup);
        const firstEntry = entries.find((x) => x.id === refs[0]?.entryId);
        const totalQty = refs.reduce((a, r) => {
            const entry = entries.find((x) => x.id === r.entryId);
            const sale = entry && entry.sales.find((s) => s.id === r.saleId);
            return a + (sale ? sale.qty : 0);
        }, 0);
        if (
            firstEntry &&
            confirm(`Видалити цей продаж «${firstEntry.name}» (${totalQty} шт)?`)
        ) {
            refs.forEach(({ entryId, saleId }) => {
                const entry = entries.find((x) => x.id === entryId);
                if (entry) entry.sales = entry.sales.filter((s) => s.id !== saleId);
            });
            saveEntries();
            render();
        }
        return;
    }
    const editSaleBtn = e.target.closest("[data-edit-sale-group]");
    if (editSaleBtn) {
        openEditSaleModal(editSaleBtn.dataset.editSaleGroup);
    }
});

function localDateOf(dateStr) {
    const p = String(dateStr).split("-");
    return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}
function todayMidnight() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function inPeriod(dateStr, period) {
    if (period === "all") return true;
    const d = localDateOf(dateStr);
    const diff = Math.floor((todayMidnight() - d) / 86400000);
    if (period === "today") return diff === 0;
    if (period === "week") return diff >= 0 && diff < 7;
    if (period === "month") return diff >= 0 && diff < 30;
    return true;
}
function currentChartPeriod() {
    return document.getElementById("chartPeriod")?.value || "all";
}
const PERIOD_LABELS = {
    all: { profit: "Загальний прибуток", buy: "На закупівлю", rev: "Від продажів", sold: "шт" },
    today: { profit: "За сьогодні", buy: "Закупівлі сьогодні", rev: "Продажі сьогодні", sold: "шт сьогодні" },
    week: { profit: "За тиждень", buy: "Закупівлі за тиждень", rev: "Продажі за тиждень", sold: "шт за тиждень" },
    month: { profit: "За місяць", buy: "Закупівлі за місяць", rev: "Продажі за місяць", sold: "шт за місяць" },
};
function renderStats() {
    const period = currentChartPeriod();
    const sales = allSales().filter((s) => inPeriod(s.date, period));
    const buyKop = entries
        .filter((e) => inPeriod(e.date, period))
        .reduce((a, e) => a + e.buyKop, 0);
    const revKop = sales.reduce((a, s) => a + s.revenueKop, 0),
        profitKop = sales.reduce((a, s) => a + saleProfitKop(s), 0),
        sold = sales
            .filter((s) => isKnownCase(s.entry.name))
            .reduce((a, s) => a + s.qty, 0);
    const lbl = PERIOD_LABELS[period] || PERIOD_LABELS.all;
    document.getElementById("statsGrid").innerHTML = `
      <div class="kpi"><div class="kpi-label">Прибуток</div><div class="kpi-value" style="color:#4ade80">+${fmtKop(profitKop)} ₴</div><div class="kpi-help">${lbl.profit}</div></div>
      <div class="kpi"><div class="kpi-label">Витрачено</div><div class="kpi-value">${fmtKop(buyKop)} ₴</div><div class="kpi-help">${lbl.buy}</div></div>
      <div class="kpi"><div class="kpi-label">Виручка</div><div class="kpi-value">${fmtKop(revKop)} ₴</div><div class="kpi-help">${lbl.rev}</div></div>
      <div class="kpi kpi-clickable" id="soldKpi" title="Показати, скільки і яких кейсів куплено за весь час"><div class="kpi-label">Продано, к-сть</div><div class="kpi-value">${sold}</div><div class="kpi-help">${lbl.sold}</div></div>`;
}

function renderCaseBuysModal() {
    const totals = {};
    allSales().forEach((s) => {
        const canonical = canonicalCaseName(s.entry.name);
        if (!canonical) return;
        totals[canonical] = (totals[canonical] || 0) + s.qty;
    });
    const rows = Object.keys(totals)
        .map((key) => ({ key, qty: totals[key] }))
        .sort((a, b) => b.qty - a.qty);
    const totalQty = rows.reduce((a, r) => a + r.qty, 0);
    document.getElementById("caseBuysBody").innerHTML = rows.length
        ? rows
              .map(
                  (r) => `<tr>
        <td>${escapeHtml(r.key)}</td>
        <td class="qty-green">${r.qty} шт</td>
      </tr>`,
              )
              .join("")
        : `<tr><td colspan="2" style="padding:25px;color:#737c8b;text-align:center">Немає даних</td></tr>`;
    document.getElementById("caseBuysTotal").textContent = `Разом: ${totalQty} шт`;
}
function openCaseBuysModal() {
    renderCaseBuysModal();
    document.getElementById("caseBuysModal").classList.add("open");
}
function closeCaseBuysModal() {
    document.getElementById("caseBuysModal").classList.remove("open");
}
document.addEventListener("click", (e) => {
    if (e.target.closest("#soldKpi")) openCaseBuysModal();
});
document.getElementById("caseBuysClose").addEventListener("click", closeCaseBuysModal);
document.getElementById("caseBuysModal").addEventListener("click", (e) => {
    if (e.target.id === "caseBuysModal") closeCaseBuysModal();
});
document.addEventListener("keydown", (e) => {
    if (!document.getElementById("caseBuysModal").classList.contains("open")) return;
    if (e.key === "Escape") closeCaseBuysModal();
});

function renderChart() {
    const period = currentChartPeriod();
    const all = allSales();
    const sales = all.filter((s) => inPeriod(s.date, period));
    let points = [];
    if (period === "today") {
        const order = [];
        const profitByCase = {};
        sales.forEach((s) => {
            const key = groupKey(s.entry.name);
            if (!(key in profitByCase)) {
                profitByCase[key] = { name: s.entry.name, value: 0 };
                order.push(key);
            }
            profitByCase[key].value += saleProfitKop(s) / 100;
        });
        points = order.map((key) => ({
            label: profitByCase[key].name,
            value: profitByCase[key].value,
        }));
    } else {
        const by = {};
        sales.forEach((s) => (by[s.date] = (by[s.date] || 0) + saleProfitKop(s) / 100));
        points = Object.keys(by)
            .sort((a, b) => new Date(a) - new Date(b))
            .map((d) => ({ label: dayLabel(d), value: by[d] }));
    }
    if (!points.length) {
        document.getElementById("chartSvg").innerHTML =
            '<text x="450" y="150" fill="#667080" font-size="13" text-anchor="middle">Немає продажів за цей період</text>';
        document.getElementById("chartCurrent").textContent = "+0 ₴";
        document.getElementById("chartMeta").innerHTML = `
        <div class="chart-meta-item">Мінімум<b>+0 ₴</b></div>
        <div class="chart-meta-item">Максимум<b>+0 ₴</b></div>
        <div class="chart-meta-item">Загальна сума<b>+0 ₴</b></div>
        <div class="chart-meta-item">Продажів<b>0</b></div>`;
        return;
    }
    const vals = points.map((p) => p.value);
    const totalProfit = vals.reduce((a, b) => a + b, 0);
    const min = Math.min(0, ...vals),
        max = Math.max(0, ...vals),
        range = max - min || 1;
    const w = 900,
        h = 300,
        pl = 44,
        pr = 16,
        pt = 18,
        pb = 12;
    const x = (i) => pl + (w - pl - pr) * (points.length === 1 ? 0 : i / (points.length - 1));
    const y = (v) => pt + (h - pt - pb) * (1 - (v - min) / range);
    const pts = vals.map((v, i) => [x(i), y(v)]);
    const zero = y(0);
    const line = pts.map((p, i) => (i ? "L" : "M") + p[0] + "," + p[1]).join(" ");
    const area = `M${pts[0][0]},${zero} ${pts.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${pts.at(-1)[0]},${zero} Z`;
    const grid = [0, 0.25, 0.5, 0.75, 1]
        .map((t) => {
            const yy = pt + (h - pt - pb) * t;
            return `<line x1="${pl}" y1="${yy}" x2="${w - pr}" y2="${yy}" stroke="#252b35" stroke-dasharray="4 5"/><text x="0" y="${yy + 4}" fill="#667080" font-size="10">${fmt(max - (max - min) * t)}</text>`;
        })
        .join("");
    document.getElementById("chartSvg").innerHTML = `
      <defs>
        <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4ade80" stop-opacity=".30"/>
          <stop offset="1" stop-color="#4ade80" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${grid}
      <path d="${area}" fill="url(#fill)"/>
      <path d="${line}" fill="none" stroke="#4ade80" stroke-width="2.5"/>
      ${pts.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === pts.length - 1 ? 5 : 3.5}" fill="#eab308"><title>${points[i].label}: +${fmt(vals[i])} ₴</title></circle>`).join("")}
      ${
          period === "today"
              ? pts
                    .map(
                        (p, i) =>
                            `<text x="${p[0]}" y="${p[1] - 10}" fill="#eab308" font-size="11" font-weight="700" text-anchor="middle">${fmt(vals[i])}</text>`,
                    )
                    .join("")
              : ""
      }`;
    document.getElementById("chartCurrent").textContent = `+${fmt(totalProfit)} ₴`;
    document.getElementById("chartMeta").innerHTML = `
      <div class="chart-meta-item">Мінімум<b>+${fmt(Math.min(...vals))} ₴</b></div>
      <div class="chart-meta-item">Максимум<b style="color:#4ade80">+${fmt(Math.max(...vals))} ₴</b></div>
      <div class="chart-meta-item">Загальна сума<b>+${fmt(totalProfit)} ₴</b></div>
      <div class="chart-meta-item">Продажів<b>${sales.length}</b></div>`;
}

const chartPeriod = document.getElementById("chartPeriod");
const chartPeriodWrap = document.getElementById("chartPeriodWrap");
const chartPeriodTrigger = document.getElementById("chartPeriodTrigger");
const chartPeriodMenu = document.getElementById("chartPeriodMenu");
const chartPeriodOptions = [...chartPeriodMenu.querySelectorAll(".chart-period-option")];
function syncChartPeriodUI() {
    const selected = chartPeriod.value;
    const option = chartPeriod.querySelector(`option[value="${selected}"]`);
    chartPeriodTrigger.textContent = option ? option.textContent : "За весь час";
    chartPeriodOptions.forEach((btn) => {
        const active = btn.dataset.value === selected;
        btn.classList.toggle("active", active);
    });
}
function closeChartPeriod() {
    chartPeriodWrap.classList.remove("open");
}
chartPeriodTrigger.addEventListener("click", () => {
    chartPeriodWrap.classList.toggle("open");
});
chartPeriodOptions.forEach((btn) =>
    btn.addEventListener("click", () => {
        chartPeriod.value = btn.dataset.value;
        syncChartPeriodUI();
        closeChartPeriod();
        renderStats();
        renderChart();
    }),
);
document.addEventListener("click", (e) => {
    if (!chartPeriodWrap.contains(e.target)) closeChartPeriod();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeChartPeriod();
});
syncChartPeriodUI();

const entrySubmitBtn = document.getElementById("entrySubmitBtn");
function cloneTemplate(id) {
    return document.getElementById(id).content.firstElementChild.cloneNode(true);
}
function populateRowCaseSelect(selectEl) {
    const groups = getCaseGroups();
    const prev = selectEl.value;
    selectEl.innerHTML =
        `<option value="">Оберіть кейс</option>` +
        groups
            .map((g) => `<option value="${escapeHtml(g.key)}">${escapeHtml(g.name)} (${g.qty} шт)</option>`)
            .join("");
    if (groups.some((g) => g.key === prev)) selectEl.value = prev;
}
function createBuyRowEl(data) {
    data = data || {};
    const sold = data.sold || 0;
    const row = cloneTemplate("buyRowTemplate");
    const totalBought = data.qty != null ? data.qty : 0;
    const qtyValue =
        sold > 0 ? Math.max(0, totalBought - sold) : data.qty != null ? data.qty : 1;
    row.querySelector(".buy-row-name").value = data.name || "";
    row.querySelector(".buy-row-qty").value = data.qty != null ? qtyValue : "";
    row.querySelector(".buy-row-date").value = data.date || todayStr();
    row.querySelector(".buy-row-buy").value = data.buy != null ? data.buy : "";
    row.querySelector(".buy-row-qty").addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^\d]/g, "");
    });
    attachThousandsFormatting(row.querySelector(".buy-row-buy"));
    attachDatePicker(row.querySelector(".buy-row-date"));
    const nameInput = row.querySelector(".buy-row-name");
    const caseSelect = row.querySelector(".buy-row-case-select");
    const buyInput = row.querySelector(".buy-row-buy");
    const suggestEl = row.querySelector(".buy-row-suggest");
    const modeBtns = [...row.querySelectorAll(".buy-row-mode-btn")];
    function setRowMode(mode) {
        row.dataset.mode = mode;
        const isSell = mode === "sell";
        modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.rowMode === mode));
        nameInput.hidden = isSell;
        caseSelect.hidden = !isSell;
        suggestEl.hidden = true;
        suggestEl.textContent = "";
        buyInput.placeholder = isSell ? "Отримав за все" : "Сума за все";
        if (isSell) populateRowCaseSelect(caseSelect);
    }
    modeBtns.forEach((btn) => btn.addEventListener("click", () => setRowMode(btn.dataset.rowMode)));
    caseSelect.addEventListener("mousedown", () => populateRowCaseSelect(caseSelect));
    setRowMode(data.mode || "buy");
    nameInput.addEventListener("input", () => {
        const match = findSimilarCaseName(nameInput.value);
        suggestEl.textContent = "";
        if (!match) {
            suggestEl.hidden = true;
            return;
        }
        suggestEl.hidden = false;
        suggestEl.appendChild(document.createTextNode(`Схоже на вже наявний кейс «${match.name}» — `));
        const link = document.createElement("span");
        link.className = "buy-row-suggest-fix";
        link.textContent = "використати цю назву";
        link.addEventListener("click", () => {
            nameInput.value = match.name;
            suggestEl.hidden = true;
            suggestEl.textContent = "";
        });
        suggestEl.appendChild(link);
    });
    return row;
}
function updateBuyRowRemoveVisibility(container) {
    const rows = [...container.querySelectorAll(".buy-row")];
    rows.forEach((r) => {
        const solo = rows.length <= 1;
        r.querySelector(".buy-row-remove").dataset.hidden = solo ? "1" : "";
    });
}
function addBuyRow(container, data) {
    container.appendChild(createBuyRowEl(data));
    updateBuyRowRemoveVisibility(container);
}
function resetBuyRows() {
    const container = document.getElementById("buyRows");
    container.innerHTML = "";
    addBuyRow(container);
}
document.getElementById("buyRows").addEventListener("click", (e) => {
    const btn = e.target.closest(".buy-row-remove");
    if (!btn || btn.dataset.hidden === "1") return;
    const container = document.getElementById("buyRows");
    btn.closest(".buy-row").remove();
    updateBuyRowRemoveVisibility(container);
});
document.getElementById("addBuyRowBtn").addEventListener("click", () => {
    addBuyRow(document.getElementById("buyRows"));
});
resetBuyRows();

document.getElementById("entryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const err = document.getElementById("formError");
    const rowEls = [...document.querySelectorAll("#buyRows .buy-row")];
    if (!rowEls.length) {
        err.textContent = "Додайте хоча б один рядок";
        return;
    }
    const buyRows = [];
    const sellRows = [];
    for (const rowEl of rowEls) {
        const mode = rowEl.dataset.mode === "sell" ? "sell" : "buy";
        const rowDate = rowEl.querySelector(".buy-row-date").value || todayStr();
        const qty = parseInt(rowEl.querySelector(".buy-row-qty").value || "1", 10);
        const amountRaw = rowEl.querySelector(".buy-row-buy").value.trim();
        const amount = amountRaw === "" ? NaN : parseFloat(unformatNumberInput(amountRaw));
        if (mode === "sell") {
            const caseKey = rowEl.querySelector(".buy-row-case-select").value;
            if (!caseKey || !getCaseGroups().some((g) => g.key === caseKey)) {
                err.textContent = "Оберіть кейс зі списку наявних для продажу";
                return;
            }
            if (isNaN(qty) || qty < 1) {
                err.textContent = "Кількість для продажу має бути від 1";
                return;
            }
            if (isNaN(amount) || amount < 0) {
                err.textContent = "Сума продажу має бути числом";
                return;
            }
            sellRows.push({ caseKey, qty, amount, date: rowDate });
        } else {
            const name = rowEl.querySelector(".buy-row-name").value.trim();
            if (!name) {
                err.textContent = "Впишіть назву кейса для кожного доданого рядка";
                return;
            }
            if (isNaN(amount) || amount < 0) {
                err.textContent = `Сума купівлі для «${name}» має бути числом`;
                return;
            }
            if (isNaN(qty) || qty < 1) {
                err.textContent = `Кількість для «${name}» має бути від 1`;
                return;
            }
            buyRows.push({ name, buyTotal: amount, qty, date: rowDate });
        }
    }
    // Перевіряємо, чи вистачає залишку на всі рядки продажу разом (якщо
    // кілька рядків продають один і той самий кейс), ще до того, як
    // почнемо щось змінювати — щоб не вийшло "напів застосованої" операції.
    const availableByCase = {};
    getCaseGroups().forEach((g) => (availableByCase[g.key] = g.qty));
    const requestedByCase = {};
    for (const s of sellRows) {
        requestedByCase[s.caseKey] = (requestedByCase[s.caseKey] || 0) + s.qty;
    }
    for (const caseKey in requestedByCase) {
        const available = availableByCase[caseKey] || 0;
        if (requestedByCase[caseKey] > available) {
            const groupName = getCaseGroups().find((g) => g.key === caseKey)?.name || "";
            err.textContent = `«${groupName}»: у сумі запитано продати більше, ніж є в наявності (${available} шт)`;
            return;
        }
    }
    for (const s of sellRows) {
        const result = allocateSale(s.caseKey, s.qty, toKopecks(s.amount), s.date);
        if (!result.ok) {
            err.textContent = result.error;
            return;
        }
    }
    if (buyRows.length) {
        const newEntries = buyRows.map((r) => ({
            id: uid(),
            name: r.name,
            buyKop: toKopecks(r.buyTotal),
            qty: r.qty,
            date: r.date,
            createdAt: Date.now(),
            sales: [],
        }));
        entries.unshift(...newEntries);
        consolidateEntries();
    }
    saveEntries();
    e.target.reset();
    resetBuyRows();
    err.textContent = "";
    render();
});

function renderTopCases() {
    const container = document.getElementById("topCasesList");
    if (!container) return;
    const totalsByCanonical = {};
    allSales().forEach((s) => {
        const canonical = canonicalCaseName(s.entry.name);
        if (!canonical) return;
        if (!totalsByCanonical[canonical]) {
            totalsByCanonical[canonical] = { name: canonical, qty: 0 };
        }
        totalsByCanonical[canonical].qty += s.qty;
    });
    const top = Object.values(totalsByCanonical)
        .filter((g) => g.qty > 0)
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 3);
    if (!top.length) {
        container.innerHTML = `<div class="top-cases-empty">Продажів ще немає</div>`;
        return;
    }
    container.innerHTML = top
        .map(
            (g, i) => `
      <div class="top-case-row">
        <div class="top-case-rank">${i + 1}</div>
        <div class="top-case-info">
          <div class="top-case-name">${escapeHtml(g.name)}</div>
          <div class="top-case-qty">Продано: ${g.qty} шт</div>
        </div>
      </div>`,
        )
        .join("");
}

let activeEditBuyOriginalIds = [];
function editBuyRowsContainer() {
    return document.getElementById("editBuyRows");
}

// Партії — деталь зберігання, а не те, чим оперує користувач. Модалка показує
// їх згорнутими в групи за ціною за штуку: скільки всього штук куплено по цій
// ціні, незалежно від того, за скільки заходів і в які дні. Дати лишаються в
// самих партіях, щоб KPI «Витрачено» за період не поплив.
function unitPriceKey(buyKop, qty) {
    return qty > 0 ? (buyKop / qty).toFixed(4) : "0";
}
function buildPriceGroups(groupEntries) {
    const order = [];
    const map = {};
    groupEntries.forEach((en) => {
        const k = unitPriceKey(en.buyKop, en.qty);
        if (!map[k]) {
            map[k] = { key: k, entries: [], qty: 0, sold: 0, buyKop: 0 };
            order.push(k);
        }
        const g = map[k];
        g.entries.push(en);
        g.qty += en.qty;
        g.sold += soldQty(en);
        g.buyKop += en.buyKop;
    });
    return order.map((k) => map[k]).sort((a, b) => a.buyKop / a.qty - b.buyKop / b.qty);
}

function createPriceRowEl(g) {
    const row = cloneTemplate("priceRowTemplate");
    const remaining = g ? g.qty - g.sold : 1;
    row.querySelector(".price-row-qty").value = g ? remaining : "";
    row.querySelector(".price-row-sum").value = g ? formatNumberInput(String(g.buyKop / 100)) : "";
    if (g) {
        row.dataset.entryIds = g.entries.map((e) => e.id).join(",");
        row.dataset.sold = String(g.sold);
    } else {
        row.dataset.entryIds = "";
        row.dataset.sold = "0";
    }
    const qtyEl = row.querySelector(".price-row-qty");
    const sumEl = row.querySelector(".price-row-sum");
    qtyEl.addEventListener("input", (e) => {
        e.target.value = e.target.value.replace(/[^\d]/g, "");
    });
    attachThousandsFormatting(sumEl);
    function syncUnit() {
        const sold = Number(row.dataset.sold || 0);
        const qty = sold + (parseInt(qtyEl.value || "0", 10) || 0);
        const sum = parseFloat(unformatNumberInput(sumEl.value));
        const ok = qty > 0 && !isNaN(sum);
        row.querySelector(".price-row-unit-value").textContent = ok ? fmt(sum / qty) : "";
        row.querySelector(".price-row-unit-suffix").hidden = !ok;
    }
    qtyEl.addEventListener("input", syncUnit);
    sumEl.addEventListener("input", syncUnit);
    syncUnit();
    return row;
}

function refreshEditBuySummary() {
    const rows = [...editBuyRowsContainer().querySelectorAll(".price-row")];
    let qty = 0,
        sum = 0;
    rows.forEach((r) => {
        const sold = Number(r.dataset.sold || 0);
        qty += sold + (parseInt(r.querySelector(".price-row-qty").value || "0", 10) || 0);
        const v = parseFloat(unformatNumberInput(r.querySelector(".price-row-sum").value));
        if (!isNaN(v)) sum += v;
    });
    const el = document.getElementById("editBuyTotal");
    if (!el) return;
    // За однієї ціни підсумок дослівно повторює єдиний рядок — не показуємо.
    if (rows.length < 2) {
        el.innerHTML = "";
        return;
    }
    const avg = qty > 0 ? sum / qty : 0;
    el.innerHTML = "";
    el.appendChild(document.getElementById("priceTotalTemplate").content.cloneNode(true));
    el.querySelector(".price-total-qty").textContent = qty;
    el.querySelector(".price-total-avg-value").textContent = fmt(avg);
    el.querySelector(".price-total-sum").textContent = fmt(sum);
}

function openEditBuyModal(entryId) {
    const baseEntry = entries.find((x) => x.id === entryId);
    if (!baseEntry) return;
    const key = groupKey(baseEntry.name);
    const groupEntries = entries
        .filter((e) => groupKey(e.name) === key && remainingQty(e) > 0)
        .sort((a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt);
    if (!groupEntries.length) return;
    activeEditBuyOriginalIds = groupEntries.map((e) => e.id);
    const container = editBuyRowsContainer();
    container.innerHTML = "";
    buildPriceGroups(groupEntries).forEach((g) => container.appendChild(createPriceRowEl(g)));
    const nameEl = document.getElementById("editBuyName");
    if (nameEl) nameEl.value = baseEntry.name;
    document.getElementById("editBuyError").textContent = "";
    refreshEditBuySummary();
    document.getElementById("editBuyModal").classList.add("open");
}
function closeEditBuyModal() {
    activeEditBuyOriginalIds = [];
    document.getElementById("editBuyModal").classList.remove("open");
}
document.getElementById("editBuyClose").addEventListener("click", closeEditBuyModal);
document.getElementById("editBuyCancel").addEventListener("click", closeEditBuyModal);
document.getElementById("editBuyModal").addEventListener("click", (e) => {
    if (e.target.id === "editBuyModal") closeEditBuyModal();
});
document.addEventListener("keydown", (e) => {
    if (!document.getElementById("editBuyModal").classList.contains("open")) return;
    if (e.key === "Escape") closeEditBuyModal();
    else if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        document.getElementById("editBuyConfirm").click();
    }
});
editBuyRowsContainer().addEventListener("input", refreshEditBuySummary);
editBuyRowsContainer().addEventListener("click", (e) => {
    const btn = e.target.closest(".price-row-remove");
    if (!btn) return;
    const row = btn.closest(".price-row");
    if (Number(row.dataset.sold || 0) > 0) {
        document.getElementById("editBuyError").textContent =
            "З цієї ціни вже є продажі — рядок не видаляється. Можна змінити кількість або суму.";
        return;
    }
    row.remove();
    refreshEditBuySummary();
});
// Розкидає нову кількість і суму групи по її партіях. Партії з продажами не
// можуть опуститись нижче за вже продане; зайве знімається з найновіших, а
// приріст лягає на найновішу. Сума ділиться пропорційно кількості, залишок від
// округлення — на останню партію.
function applyPriceGroup(groupEntries, newQty, newBuyKop) {
    const ordered = [...groupEntries].sort(
        (a, b) => new Date(a.date) - new Date(b.date) || a.createdAt - b.createdAt,
    );
    const qtyOf = ordered.map((e) => soldQty(e));
    let left = newQty - qtyOf.reduce((a, q) => a + q, 0);
    for (let i = 0; i < ordered.length && left > 0; i++) {
        const add = i === ordered.length - 1 ? left : Math.min(left, remainingQty(ordered[i]));
        qtyOf[i] += add;
        left -= add;
    }
    if (left > 0) qtyOf[qtyOf.length - 1] += left;
    const totalQty = qtyOf.reduce((a, q) => a + q, 0);
    let usedKop = 0;
    const result = [];
    ordered.forEach((en, i) => {
        const isLast = i === ordered.length - 1;
        const share = isLast ? newBuyKop - usedKop : Math.round((newBuyKop * qtyOf[i]) / (totalQty || 1));
        usedKop += isLast ? 0 : share;
        result.push({ entry: en, qty: qtyOf[i], buyKop: share });
    });
    return result;
}

document.getElementById("editBuyConfirm").addEventListener("click", () => {
    const err = document.getElementById("editBuyError");
    err.textContent = "";
    const name = document.getElementById("editBuyName").value.trim();
    if (!name) {
        err.textContent = "Впишіть назву";
        return;
    }
    const rowEls = [...editBuyRowsContainer().querySelectorAll(".price-row")];
    if (!rowEls.length) {
        err.textContent = "Має лишитись хоча б одна ціна";
        return;
    }
    const plan = [];
    for (const rowEl of rowEls) {
        const sold = Number(rowEl.dataset.sold || 0);
        const ids = rowEl.dataset.entryIds ? rowEl.dataset.entryIds.split(",") : [];
        const groupEntries = ids.map((id) => entries.find((x) => x.id === id)).filter(Boolean);
        const qtyInput = parseInt(rowEl.querySelector(".price-row-qty").value || "0", 10);
        const sumRaw = rowEl.querySelector(".price-row-sum").value.trim();
        const sumTotal = sumRaw === "" ? NaN : parseFloat(unformatNumberInput(sumRaw));
        if (isNaN(sumTotal) || sumTotal < 0) {
            err.textContent = "Сума має бути числом";
            return;
        }
        if (isNaN(qtyInput) || qtyInput < 0 || (sold === 0 && qtyInput < 1)) {
            err.textContent = sold ? "Кількість не може бути від'ємною" : "Кількість має бути від 1";
            return;
        }
        const newQty = sold + qtyInput;
        const newBuyKop = toKopecks(sumTotal);
        if (groupEntries.length) {
            const alloc = applyPriceGroup(groupEntries, newQty, newBuyKop);
            for (const a of alloc) {
                const minKop = costOfSoldKop(a.entry);
                if (a.buyKop < minKop) {
                    err.textContent = `Сума не може бути меншою за собівартість уже проданих одиниць (${fmtKop(minKop)} ₴)`;
                    return;
                }
            }
            plan.push({ alloc });
        } else {
            plan.push({ create: { qty: newQty, buyKop: newBuyKop } });
        }
    }
    const keptIds = new Set();
    plan.forEach((p) => {
        if (p.create) {
            entries.unshift({
                id: uid(),
                name,
                buyKop: p.create.buyKop,
                qty: p.create.qty,
                date: todayStr(),
                createdAt: Date.now(),
                sales: [],
            });
            return;
        }
        p.alloc.forEach((a) => {
            a.entry.name = name;
            a.entry.qty = a.qty;
            a.entry.buyKop = a.buyKop;
            keptIds.add(a.entry.id);
        });
    });
    // Рядки, прибрані хрестиком: без продажів — геть, з продажами — обрізаємо
    // до вже проданого, щоб історія продажів і їх собівартість лишились цілими.
    activeEditBuyOriginalIds.forEach((id) => {
        if (keptIds.has(id)) return;
        const en = entries.find((x) => x.id === id);
        if (!en) return;
        const sold = soldQty(en);
        if (sold > 0) {
            en.buyKop = costOfSoldKop(en);
            en.qty = sold;
        } else {
            en.qty = 0;
        }
    });
    // Порожні партії без жодного продажу більше ні на що не впливають.
    entries = entries.filter((e) => e.qty > 0 || soldQty(e) > 0);
    entries.forEach((e) => {
        if (keptIds.has(e.id)) e.name = name;
    });
    consolidateEntries();
    saveEntries();
    closeEditBuyModal();
    render();
});

let activeEditSaleRefs = null;
function parseSaleRefs(raw) {
    return raw.split(",").map((pair) => {
        const [entryId, saleId] = pair.split(":");
        return { entryId, saleId };
    });
}
function availableForEdit(key, removedByEntry) {
    return entries
        .filter((en) => groupKey(en.name) === key)
        .reduce((a, en) => a + remainingQty(en) + (removedByEntry[en.id] || 0), 0);
}
function openEditSaleModal(refsRaw) {
    const refs = parseSaleRefs(refsRaw);
    const details = refs
        .map((r) => {
            const entry = entries.find((x) => x.id === r.entryId);
            const sale = entry && entry.sales.find((s) => s.id === r.saleId);
            return sale ? { entry, sale } : null;
        })
        .filter(Boolean);
    if (!details.length) return;
    const originalKey = groupKey(details[0].entry.name);
    const totalQty = details.reduce((a, d) => a + d.sale.qty, 0);
    const totalRevenueKop = details.reduce((a, d) => a + d.sale.revenueKop, 0);
    const date = details[0].sale.date;
    activeEditSaleRefs = { refs, date };
    const removedByEntry = {};
    details.forEach((d) => {
        removedByEntry[d.entry.id] = (removedByEntry[d.entry.id] || 0) + d.sale.qty;
    });
    const order = [];
    const groups = {};
    entries.forEach((en) => {
        const key = groupKey(en.name);
        const effectiveRemaining = remainingQty(en) + (removedByEntry[en.id] || 0);
        if (effectiveRemaining <= 0) return;
        if (!groups[key]) {
            groups[key] = { key, name: en.name, qty: 0 };
            order.push(key);
        }
        groups[key].qty += effectiveRemaining;
    });
    const select = document.getElementById("editSaleCase");
    select.innerHTML = order
        .map((key) => groups[key])
        .sort((a, b) => a.name.localeCompare(b.name, "uk"))
        .map((g) => `<option value="${escapeHtml(g.key)}">${escapeHtml(g.name)} (${g.qty} шт)</option>`)
        .join("");
    select.value = originalKey;
    document.getElementById("editSaleQty").value = String(totalQty);
    document.getElementById("editSalePrice").value = String(totalRevenueKop / 100);
    document.getElementById("editSaleError").textContent = "";
    document.getElementById("editSaleModal").classList.add("open");
}
function closeEditSaleModal() {
    activeEditSaleRefs = null;
    document.getElementById("editSaleModal").classList.remove("open");
}

document.getElementById("editSaleClose").addEventListener("click", closeEditSaleModal);
document.getElementById("editSaleCancel").addEventListener("click", closeEditSaleModal);
document.getElementById("editSaleModal").addEventListener("click", (e) => {
    if (e.target.id === "editSaleModal") closeEditSaleModal();
});
document.getElementById("editSaleQty").addEventListener("input", (e) => {
    e.target.value = e.target.value.replace(/[^\d]/g, "");
});
document.addEventListener("keydown", (e) => {
    if (!document.getElementById("editSaleModal").classList.contains("open")) return;
    if (e.key === "Escape") closeEditSaleModal();
    else if (e.key === "Enter" && e.target.tagName === "INPUT") {
        e.preventDefault();
        document.getElementById("editSaleConfirm").click();
    }
});
attachThousandsFormatting(document.getElementById("editSalePrice"));
document.getElementById("editSaleConfirm").addEventListener("click", () => {
    if (!activeEditSaleRefs) return;
    const err = document.getElementById("editSaleError");
    const newKey = document.getElementById("editSaleCase").value;
    const qty = parseInt(document.getElementById("editSaleQty").value.replace(/[^\d]/g, "") || "0", 10);
    const sellTotal = parseFloat(unformatNumberInput(document.getElementById("editSalePrice").value));
    if (!newKey) {
        err.textContent = "Оберіть кейс зі списку";
        return;
    }
    const removedByEntry = {};
    activeEditSaleRefs.refs.forEach((r) => {
        const entry = entries.find((x) => x.id === r.entryId);
        const sale = entry && entry.sales.find((s) => s.id === r.saleId);
        if (entry && sale) removedByEntry[entry.id] = (removedByEntry[entry.id] || 0) + sale.qty;
    });
    const available = availableForEdit(newKey, removedByEntry);
    if (!Number.isInteger(qty) || qty < 1 || qty > available) {
        err.textContent = `Кількість має бути від 1 до ${available} шт`;
        return;
    }
    if (isNaN(sellTotal) || sellTotal < 0) {
        err.textContent = "Вкажіть коректну суму продажу";
        return;
    }
    activeEditSaleRefs.refs.forEach((r) => {
        const entry = entries.find((x) => x.id === r.entryId);
        if (entry) entry.sales = entry.sales.filter((s) => s.id !== r.saleId);
    });
    const result = allocateSale(newKey, qty, toKopecks(sellTotal), activeEditSaleRefs.date);
    if (!result.ok) {
        err.textContent = result.error;
        return;
    }
    saveEntries();
    closeEditSaleModal();
    render();
});

function render() {
    renderStats();
    renderInventory();
    renderDaily();
    renderChart();
    renderTopCases();
}

updateCurrentTime();
setInterval(updateCurrentTime, 1000);

render();