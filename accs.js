"use strict";

const PLACEHOLDER_ICON = `
<svg class="placeholder-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="5" width="18" height="14" rx="2"/>
    <circle cx="8.5" cy="10.5" r="1.5"/>
    <path d="M21 15l-5-5-9 9"/>
</svg>`;

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

const state = {
    category: "all",
    query: "",
};

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

function normalizeText(s) {
    return (s || "").toLowerCase().trim();
}

// 0 = точний збіг підрядка (найкраще), більше число = гірше (типова описка),
// Infinity = не підходить. Порівнює запит і з цілими словами назви, і з
// підрядками довжини запиту всередині довших слів — щоб описка типу
// "розкіж" замість "розкіш" чи "тмні" замість "темні" все одно знаходились.
function fuzzyMatchScore(query, name) {
    const q = normalizeText(query);
    const n = normalizeText(name);
    if (!q) return 0;
    if (n.includes(q)) return 0;
    const threshold = q.length <= 3 ? 1 : q.length <= 6 ? 2 : 3;
    let best = Infinity;
    n.split(/\s+/)
        .filter(Boolean)
        .forEach((word) => {
            best = Math.min(best, levenshtein(q, word));
            if (word.length > q.length) {
                for (let i = 0; i <= word.length - q.length; i++) {
                    best = Math.min(best, levenshtein(q, word.slice(i, i + q.length)));
                }
            }
        });
    return best <= threshold ? best + 1 : Infinity;
}

function buildCard(account) {
    const card = el("div", "acc-card");
    card.dataset.category = account.category;

    const photo = el("div", "acc-card-photo");
    if (account.photo) {
        const img = el("img");
        img.src = account.photo;
        img.alt = account.name;
        img.onerror = () => {
            photo.innerHTML = PLACEHOLDER_ICON;
        };
        photo.appendChild(img);
    } else {
        photo.innerHTML = PLACEHOLDER_ICON;
    }

    const body = el("div", "acc-card-body");

    const nameRow = el("div", "acc-card-name-row");
    const name = el("div", "acc-card-name");
    name.textContent = account.name;
    nameRow.appendChild(name);

    if (account.shop) {
        const shopBadge = el("span", "acc-card-shop-badge");
        shopBadge.textContent = account.shop;
        nameRow.appendChild(shopBadge);
    }

    body.append(nameRow);

    const pricesRow = el("div", "acc-card-prices buysell");
    const buyCol = el("div", "acc-card-buysell-stat");
    buyCol.innerHTML = `<span class="k">купівля</span><span class="v buy">${account.buy}</span>`;
    const sellCol = el("div", "acc-card-buysell-stat");
    sellCol.innerHTML = `<span class="k">продаж</span><span class="v sell">${account.sell}</span>`;
    pricesRow.append(buyCol, sellCol);
    body.appendChild(pricesRow);

    card.append(photo, body);

    return card;
}

function getFilteredAccounts() {
    let list = ACCOUNTS.slice();

    if (state.category !== "all") {
        list = list.filter((a) => a.category === state.category);
    }

    const q = state.query.trim();
    if (q) {
        list = list
            .map((a) => ({ a, score: fuzzyMatchScore(q, a.name) }))
            .filter((x) => x.score !== Infinity)
            .sort((x, y) => x.score - y.score)
            .map((x) => x.a);
    }

    return list;
}

function renderGrid() {
    const grid = document.getElementById("accounts-grid");
    grid.innerHTML = "";

    const list = getFilteredAccounts();

    if (list.length === 0) {
        const empty = el("div", "empty-state");
        empty.textContent = "Нічого не знайдено за цим фільтром.";
        grid.appendChild(empty);
        return;
    }

    list.forEach((account) => grid.appendChild(buildCard(account)));
}

function init() {
    renderGrid();

    document.querySelectorAll(".chip").forEach((chip) => {
        chip.addEventListener("click", () => {
            document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
            chip.classList.add("active");
            state.category = chip.dataset.category;
            renderGrid();
        });
    });

    document.getElementById("searchInput").addEventListener("input", (e) => {
        state.query = e.target.value;
        renderGrid();
    });
}

document.addEventListener("DOMContentLoaded", init);