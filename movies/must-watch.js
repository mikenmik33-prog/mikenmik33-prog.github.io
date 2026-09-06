const magazine = document.getElementById("magazine");
const leavesContainer = document.getElementById("pages");
const menuContentsButton = document.getElementById("menu-contents");
const menuHomeButton = document.getElementById("menu-home");
const pageCurrentEl = document.getElementById("page-current");
const pageTotalEl = document.getElementById("page-total");
const readingProgressEl = document.getElementById("reading-progress");

let domLeaves = [];
let leaves = [];
let progressSegments = [];
let flippedCount = 0;

const PAGE_STORAGE_KEY = "must-watch-current-page";

const CATEGORY_LABELS = {
    movie: { ua: "Фільм", en: "Film" },
    series: { ua: "Серіал", en: "Series" },
    cartoon: { ua: "Мультфільм", en: "Cartoon" },
    anime: { ua: "Аніме", en: "Anime" }
};

function el(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
}

function metaItem(labelUa, labelEn, valueUa, valueEn) {
    const item = el("span", "meta-item");

    const label = el("span", "meta-label");
    label.dataset.ua = labelUa;
    label.dataset.en = labelEn;

    const value = el("span", "meta-value");
    value.dataset.ua = valueUa;
    value.dataset.en = valueEn;

    item.append(label, value);
    return item;
}

function ratingTierColor(rating) {
    const n = parseFloat(rating);
    if (n >= 7.5) return "#4ade80";
    if (n >= 5.5) return "#eab308";
    return "#f87171";
}

function buildMovieLeaf(movie) {
    const leaf = el("div", "leaf leaf-spread");
    leaf.dataset.category = movie.category;

    const left = el("div", "sheet left");
    const poster = el("img", "poster");
    poster.dataset.srcUa = movie.posterUa;
    poster.dataset.srcEn = movie.posterEn;
    left.appendChild(poster);

    const right = el("div", "sheet right");
    const desc = el("div", "desc");

    const catLabel = CATEGORY_LABELS[movie.category] || CATEGORY_LABELS.movie;
    const catAccent = el("div", "cat-accent cat-" + movie.category);
    const catDot = el("span", "dot");
    const catTxt = el("span", "txt");
    catTxt.dataset.ua = catLabel.ua;
    catTxt.dataset.en = catLabel.en;
    const catAge = el("span", "age");
    catAge.dataset.ua = movie.age;
    catAge.dataset.en = movie.age;

    const ringColor = ratingTierColor(movie.rating);
    const ring = el("div", "rating-ring rating-ring-mini");
    ring.style.setProperty("--pct", String(parseFloat(movie.rating) * 10));
    ring.style.setProperty("--ring-color", ringColor);

    const ratingValue = el("span", "rating-value");
    ratingValue.style.color = ringColor;
    const [ratingWhole, ratingDecimal] = String(movie.rating).split(".");
    ratingValue.appendChild(document.createTextNode(ratingWhole));
    if (ratingDecimal) {
        const dec = el("span", "rating-decimal");
        dec.style.color = ringColor;
        dec.textContent = "." + ratingDecimal;
        ratingValue.appendChild(dec);
    }
    ring.appendChild(ratingValue);

    const badgeGroup = el("span", "badge-group");
    badgeGroup.append(catAge, ring);

    catAccent.append(catDot, catTxt, badgeGroup);

    const titleRow = el("div", "title-row");
    const h2 = el("h2");
    h2.dataset.ua = movie.titleUa;
    h2.dataset.en = movie.titleEn;
    titleRow.appendChild(h2);

    const directorLabelUa = movie.category === "series" ? "(Шоуранер)" : "(Режисер)";
    const directorLabelEn = movie.category === "series" ? "(Showrunner)" : "(Director)";

    const directorItem = metaItem(movie.directorUa, movie.directorEn, directorLabelUa, directorLabelEn);
    directorItem.classList.add("meta-item-wide");

    const movieMeta = el("div", "movie-meta");
    movieMeta.append(
        metaItem(movie.year, movie.year, "(Рік)", "(Year)"),
        metaItem(movie.countryUa, movie.countryEn, "(Країна)", "(Country)"),
        directorItem,
        metaItem(movie.durationUa, movie.durationEn, "(Тривалість)", "(Duration)")
    );
    if (movie.seasonsUa) {
        movieMeta.appendChild(
            metaItem(movie.seasonsUa, movie.seasonsEn, "(Сезони та серії)", "(Seasons & Episodes)")
        );
    }

    const descText = el("p", "desc-text");
    descText.dataset.ua = movie.descUa;
    descText.dataset.en = movie.descEn;

    desc.append(catAccent, titleRow, movieMeta, descText);
    right.appendChild(desc);

    leaf.append(left, right);

    return leaf;
}

function renderMovieLeaves() {
    if (typeof MOVIES_DATA === "undefined") return;

    const backLeaf = leavesContainer.querySelector(".leaf-back");
    const fragment = document.createDocumentFragment();
    MOVIES_DATA.forEach((movie) => fragment.appendChild(buildMovieLeaf(movie)));

    if (backLeaf) {
        leavesContainer.insertBefore(fragment, backLeaf);
    } else {
        leavesContainer.appendChild(fragment);
    }
}

function buildTowatchItem(entry, lang) {
    const item = el("div", "towatch-item");

    const title = el("span", "towatch-title");
    title.textContent = lang === "ua" ? entry.titleUa : entry.titleEn;

    const year = el("span", "towatch-year");
    year.textContent = entry.year;

    item.append(title, year);
    return item;
}

function renderTowatchList(lang) {
    const container = document.getElementById("towatchList");
    if (!container) return;

    const data = typeof TOWATCH_DATA !== "undefined" ? TOWATCH_DATA : [];
    container.innerHTML = "";

    if (!data.length) {
        const empty = el("p", "towatch-empty");
        empty.textContent = lang === "ua" ? "Список поки порожній" : "The list is empty for now";
        container.appendChild(empty);
        return;
    }

    const locale = lang === "ua" ? "uk" : "en";
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const sorted = data.slice().sort((a, b) => {
        const titleA = lang === "ua" ? a.titleUa : a.titleEn;
        const titleB = lang === "ua" ? b.titleUa : b.titleEn;
        return collator.compare(titleA, titleB);
    });

    sorted.forEach((entry) => container.appendChild(buildTowatchItem(entry, lang)));
}

const towatchToggle = document.getElementById("towatchToggle");
const towatchModal = document.getElementById("towatchModal");
const towatchClose = document.getElementById("towatchClose");
const towatchBackdrop = towatchModal ? towatchModal.querySelector(".towatch-modal-backdrop") : null;

function openTowatchModal() {
    if (!towatchModal) return;
    closeSearch();
    towatchModal.classList.add("open");
    towatchModal.setAttribute("aria-hidden", "false");
}

function closeTowatchModal() {
    if (!towatchModal) return;
    towatchModal.classList.remove("open");
    towatchModal.setAttribute("aria-hidden", "true");
}

if (towatchToggle) {
    towatchToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        openTowatchModal();
    });
}

if (towatchClose) {
    towatchClose.addEventListener("click", closeTowatchModal);
}

if (towatchBackdrop) {
    towatchBackdrop.addEventListener("click", closeTowatchModal);
}

if (towatchModal) {
    towatchModal.addEventListener("wheel", (e) => {
        const list = document.getElementById("towatchList");
        if (!list) return;
        e.preventDefault();
        list.scrollTop += e.deltaY;
    }, { passive: false });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeTowatchModal();
        closeRatingModal();
        closeSearch();
    }
});

const sortToggle = document.getElementById("sortToggle");
const ratingModal = document.getElementById("ratingModal");
const ratingClose = document.getElementById("ratingClose");
const ratingBackdrop = ratingModal ? ratingModal.querySelector(".towatch-modal-backdrop") : null;

function buildRatingItem(rank, leaf, lang) {
    const item = el("div", "towatch-item towatch-item-clickable");

    const title = el("span", "towatch-title");
    title.textContent = `${rank}. ${getLeafTitle(leaf, lang)}`;

    const ratingNum = getLeafRating(leaf);
    const ringColor = ratingTierColor(ratingNum);

    const ring = el("div", "rating-ring rating-ring-mini");
    ring.style.setProperty("--pct", String(ratingNum * 10));
    ring.style.setProperty("--ring-color", ringColor);

    const ratingValue = el("span", "rating-value");
    ratingValue.style.color = ringColor;
    const [whole, decimal] = ratingNum.toFixed(1).split(".");
    ratingValue.appendChild(document.createTextNode(whole));
    if (decimal) {
        const dec = el("span", "rating-decimal");
        dec.style.color = ringColor;
        dec.textContent = "." + decimal;
        ratingValue.appendChild(dec);
    }
    ring.appendChild(ratingValue);

    item.append(title, ring);
    item.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = leaves.indexOf(leaf);
        if (index !== -1) jumpToLeaf(index);
        closeRatingModal();
    });

    return item;
}

function renderRatingList(lang) {
    const container = document.getElementById("ratingList");
    if (!container) return;

    const movieLeaves = leaves.filter((leaf) => leaf.classList.contains("leaf-spread"));
    container.innerHTML = "";

    if (!movieLeaves.length) {
        const empty = el("p", "towatch-empty");
        empty.textContent = lang === "ua" ? "Список поки порожній" : "The list is empty for now";
        container.appendChild(empty);
        return;
    }

    const sorted = movieLeaves.slice().sort((a, b) => getLeafRating(b) - getLeafRating(a));
    sorted.forEach((leaf, i) => container.appendChild(buildRatingItem(i + 1, leaf, lang)));
}

function openRatingModal() {
    if (!ratingModal) return;
    closeSearch();
    renderRatingList(currentLang);
    ratingModal.classList.add("open");
    ratingModal.setAttribute("aria-hidden", "false");
}

function closeRatingModal() {
    if (!ratingModal) return;
    ratingModal.classList.remove("open");
    ratingModal.setAttribute("aria-hidden", "true");
}

if (sortToggle) {
    sortToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        openRatingModal();
    });
}

if (ratingClose) {
    ratingClose.addEventListener("click", closeRatingModal);
}

if (ratingBackdrop) {
    ratingBackdrop.addEventListener("click", closeRatingModal);
}

if (ratingModal) {
    ratingModal.addEventListener("wheel", (e) => {
        const list = document.getElementById("ratingList");
        if (!list) return;
        e.preventDefault();
        list.scrollTop += e.deltaY;
    }, { passive: false });
}

// ---------- Пошук у панелі керування ----------

function levenshtein(a, b) {
    const m = a.length, n = b.length;
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

function normalizeSearchText(s) {
    return (s || "").toLowerCase().trim();
}

// 0 = точний збіг підрядка (найкраще), більше число = гірше (типова описка),
// Infinity = не підходить. Та сама логіка, що й фаззі-пошук у accs.js.
function movieFuzzyScore(query, title) {
    const q = normalizeSearchText(query);
    const n = normalizeSearchText(title);
    if (!q) return Infinity;
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

function highlightSearchMatch(title, query) {
    const idx = normalizeSearchText(title).indexOf(normalizeSearchText(query));
    if (idx === -1) return null;
    const len = query.trim().length;
    return {
        before: title.slice(0, idx),
        match: title.slice(idx, idx + len),
        after: title.slice(idx + len)
    };
}

function buildSearchResultItem(leaf, title, query, isFuzzy) {
    const item = el("div", "towatch-item towatch-item-clickable");

    const titleSpan = el("span", "towatch-title");
    const hl = !isFuzzy ? highlightSearchMatch(title, query) : null;
    if (hl) {
        titleSpan.appendChild(document.createTextNode(hl.before));
        const mark = el("mark", "search-hit");
        mark.textContent = hl.match;
        titleSpan.appendChild(mark);
        titleSpan.appendChild(document.createTextNode(hl.after));
    } else {
        titleSpan.appendChild(document.createTextNode(title));
        if (isFuzzy) {
            const hint = el("span", "ctrl-search-hint");
            hint.textContent = currentLang === "ua" ? " (схожа назва)" : " (similar)";
            titleSpan.appendChild(hint);
        }
    }

    const year = el("span", "towatch-year");
    const yearEl = leaf.querySelector(".movie-meta > .meta-item:first-child .meta-label");
    year.textContent = yearEl ? yearEl.textContent : "";

    item.append(titleSpan, year);
    item.addEventListener("click", (e) => {
        e.stopPropagation();
        const index = leaves.indexOf(leaf);
        if (index !== -1) jumpToLeaf(index);
        closeSearch();
    });

    return item;
}

const ctrlPanel = document.getElementById("ctrlPanel");
const searchToggle = document.getElementById("searchToggle");
const searchInput = document.getElementById("searchInput");
const searchResults = document.getElementById("searchResults");

function renderSearchResults(query) {
    if (!searchResults) return;
    searchResults.innerHTML = "";

    const q = query.trim();
    if (!q) {
        searchResults.classList.remove("open");
        return;
    }

    const movieLeaves = leaves.filter((leaf) => leaf.classList.contains("leaf-spread"));
    const hits = movieLeaves
        .map((leaf) => {
            const title = getLeafTitle(leaf, currentLang);
            return { leaf, title, score: movieFuzzyScore(q, title) };
        })
        .filter((x) => x.title && x.score !== Infinity)
        .sort((a, b) => a.score - b.score)
        .slice(0, 8);

    if (!hits.length) {
        const empty = el("p", "towatch-empty");
        empty.textContent = currentLang === "ua" ? "Нічого не знайдено" : "Nothing found";
        searchResults.appendChild(empty);
    } else {
        hits.forEach(({ leaf, title, score }) => {
            searchResults.appendChild(buildSearchResultItem(leaf, title, q, score > 0));
        });
    }

    searchResults.classList.add("open");
}

function openSearch() {
    if (!ctrlPanel || !searchInput) return;
    ctrlPanel.classList.add("search-open");
    searchInput.focus();
    if (searchInput.value.trim()) renderSearchResults(searchInput.value);
}

function closeSearch() {
    if (!ctrlPanel) return;
    ctrlPanel.classList.remove("search-open");
    if (searchInput) searchInput.value = "";
    if (searchResults) {
        searchResults.innerHTML = "";
        searchResults.classList.remove("open");
    }
}

if (searchToggle) {
    searchToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        if (ctrlPanel && ctrlPanel.classList.contains("search-open")) {
            closeSearch();
        } else {
            openSearch();
        }
    });
}

if (searchInput) {
    searchInput.addEventListener("input", () => {
        renderSearchResults(searchInput.value);
    });
    searchInput.addEventListener("click", (e) => e.stopPropagation());
    searchInput.addEventListener("keydown", (e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
            closeSearch();
        } else if (e.key === "Enter") {
            const first = searchResults ? searchResults.querySelector(".towatch-item-clickable") : null;
            if (first) first.click();
        }
    });
}

if (searchResults) {
    searchResults.addEventListener("click", (e) => e.stopPropagation());
    searchResults.addEventListener("wheel", (e) => e.stopPropagation());
}

document.addEventListener("click", (e) => {
    if (!ctrlPanel || !ctrlPanel.classList.contains("search-open")) return;
    if (e.target.closest(".ctrl-panel, .ctrl-search-drop")) return;
    closeSearch();
});

const CATEGORY_ICONS = {
    movie: "🎬",
    series: "📺",
    cartoon: "🎨",
    anime: "⛩️"
};

const CATEGORY_COLORS = {
    movie: "var(--col-movie)",
    series: "var(--col-series)",
    cartoon: "var(--col-cartoon)",
    anime: "var(--col-anime)"
};

function getLeafSymbol(leaf) {
    const category = leaf.dataset.category;
    if (category && CATEGORY_ICONS[category]) return CATEGORY_ICONS[category];
    if (leaf.classList.contains("leaf-cover")) return "🏠";
    if (leaf.classList.contains("leaf-contents")) return "🧭";
    if (leaf.classList.contains("leaf-back")) return "🏁";
    return "•";
}

function buildProgressSegments() {
    if (!readingProgressEl) return;
    readingProgressEl.innerHTML = "";
    progressSegments = leaves.map((leaf) => {
        const segment = document.createElement("div");
        segment.className = "progress-segment";

        const category = leaf.dataset.category;
        if (category && CATEGORY_COLORS[category]) {
            segment.style.setProperty("--seg-color", CATEGORY_COLORS[category]);
        }

        const symbol = document.createElement("span");
        symbol.className = "progress-symbol";
        symbol.textContent = getLeafSymbol(leaf);
        segment.appendChild(symbol);

        readingProgressEl.appendChild(segment);
        return segment;
    });
}

function updateProgressSegments() {
    progressSegments.forEach((segment, i) => {
        segment.classList.toggle("is-read", i < flippedCount);
        segment.classList.toggle("is-current", i === Math.min(flippedCount, leaves.length - 1));
    });
}

function getLeafTitle(leaf, lang) {
    const titleEl = leaf.querySelector(".desc h2");
    if (!titleEl) return "";
    return (lang === "ua" ? titleEl.dataset.ua : titleEl.dataset.en) || "";
}

function getLeafRating(leaf) {
    const ratingEl = leaf.querySelector(".rating-value");
    if (!ratingEl) return 0;
    const wholeNode = ratingEl.childNodes[0];
    const whole = wholeNode ? wholeNode.textContent.trim() : "0";
    const decimalEl = ratingEl.querySelector(".rating-decimal");
    const decimalText = decimalEl ? decimalEl.textContent : "";
    return parseFloat(whole + decimalText) || 0;
}

function computeOrderedLeaves(lang) {
    const cover = domLeaves.find((leaf) => leaf.classList.contains("leaf-cover"));
    const contents = domLeaves.find((leaf) => leaf.classList.contains("leaf-contents"));
    const back = domLeaves.find((leaf) => leaf.classList.contains("leaf-back"));
    const movies = domLeaves.filter((leaf) => leaf.classList.contains("leaf-spread"));

    const locale = lang === "ua" ? "uk" : "en";
    const collator = new Intl.Collator(locale, { sensitivity: "base" });
    const alphabet = getAlphabet(lang);
    const startsWithLetter = (title) =>
        alphabet.includes((title || "").trim().charAt(0).toUpperCase());

    const sortedMovies = movies.slice().sort((a, b) => {
        const titleA = getLeafTitle(a, lang);
        const titleB = getLeafTitle(b, lang);
        const letterA = startsWithLetter(titleA);
        const letterB = startsWithLetter(titleB);

        if (letterA !== letterB) return letterA ? -1 : 1;
        return collator.compare(titleA, titleB);
    });

    return [cover, contents, ...sortedMovies, back].filter(Boolean);
}

function buildLeaves() {
    domLeaves = Array.from(leavesContainer.children);
    leaves = computeOrderedLeaves(currentLang);

    flippedCount = 0;

    buildProgressSegments();
    updateLeaves();
    updateStatsPanel();
    initStatsPanelInteraction();

    if (pageTotalEl) {
        pageTotalEl.textContent = leaves.length;
    }
}

function computeCategoryCounts() {
    const counts = { movie: 0, series: 0, cartoon: 0, anime: 0 };

    leaves.forEach((leaf) => {
        const category = leaf.dataset.category;
        if (category && Object.prototype.hasOwnProperty.call(counts, category)) {
            counts[category]++;
        }
    });

    return counts;
}

function getStatCategory(statEl) {
    const catClass = Array.from(statEl.classList).find((c) => c.startsWith("cat-"));
    return catClass ? catClass.replace("cat-", "") : null;
}

function updateStatsPanel() {
    const counts = computeCategoryCounts();

    document.querySelectorAll(".stats-panel .stat").forEach((statEl) => {
        const category = getStatCategory(statEl);
        if (!category) return;

        const numberEl = statEl.querySelector(".number");
        if (numberEl && Object.prototype.hasOwnProperty.call(counts, category)) {
            numberEl.textContent = counts[category];
        }
    });
}

let categoryFilter = null;

function jumpToCategory(category) {
    const index = leaves.findIndex((leaf) => leaf.dataset.category === category);
    if (index !== -1) jumpToLeaf(index);
}

function updateCategoryFilterUI() {
    document.querySelectorAll(".side-menu-cat").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.category === categoryFilter);
    });
}

function setCategoryFilter(category) {
    categoryFilter = categoryFilter === category ? null : category;
    updateCategoryFilterUI();

    if (categoryFilter) {
        jumpToCategory(categoryFilter);
    }
}

function clearCategoryFilter() {
    if (!categoryFilter) return;
    categoryFilter = null;
    updateCategoryFilterUI();
}

function findNextMatchingLeaf(fromIndex, direction) {
    if (!categoryFilter) {
        return fromIndex >= 0 && fromIndex < leaves.length ? fromIndex : -1;
    }

    let i = fromIndex;
    while (i >= 0 && i < leaves.length) {
        if (leaves[i].dataset.category === categoryFilter) return i;
        i += direction;
    }
    return -1;
}

function initStatsPanelInteraction() {
    document.querySelectorAll(".stats-panel .stat").forEach((statEl) => {
        const category = getStatCategory(statEl);
        if (!category) return;

        statEl.setAttribute("role", "button");
        statEl.setAttribute("tabindex", "0");

        statEl.addEventListener("click", (e) => {
            e.stopPropagation();
            setCategoryFilter(category);
        });

        statEl.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setCategoryFilter(category);
            }
        });
    });
}

function updateLeaves() {
    const total = leaves.length;
    const currentIndex = Math.min(flippedCount, total - 1);

    leaves.forEach((leaf, i) => {
        leaf.classList.toggle("active", i === currentIndex);
    });

    localStorage.setItem(PAGE_STORAGE_KEY, flippedCount);

    if (pageCurrentEl) {
        pageCurrentEl.textContent = Math.min(flippedCount + 1, total);
    }

    updateProgressSegments();

    manageImageWindow();
}

function getLangSrc(img) {
    return currentLang === "ua"
        ? (img.dataset.srcUa || img.dataset.srcEn)
        : (img.dataset.srcEn || img.dataset.srcUa);
}

function loadLeafImages(leaf) {
    if (!leaf) return;

    leaf.querySelectorAll("img[data-src-ua], img[data-src-en]").forEach((img) => {
        const wanted = getLangSrc(img);
        if (wanted && img.getAttribute("src") !== wanted) {
            img.src = wanted;
        }
        img.classList.add("is-loaded");
    });
}

function unloadLeafImages(leaf) {
    if (!leaf) return;

    leaf.querySelectorAll("img[data-src-ua], img[data-src-en]").forEach((img) => {
        if (img.hasAttribute("src")) {
            img.removeAttribute("src");
        }
        img.classList.remove("is-loaded");
    });
}

function manageImageWindow() {
    const current = flippedCount;
    const keep = new Set([current - 1, current, current + 1]);

    leaves.forEach((leaf, i) => {
        if (keep.has(i)) {
            loadLeafImages(leaf);
        } else {
            unloadLeafImages(leaf);
        }
    });
}

function getAlphabet(lang) {
    return lang === "ua"
        ? "АБВГҐДЕЄЖЗИІЇЙКЛМНОПРСТУФХЦЧШЩЬЮЯ".split("")
        : "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
}

function getMovieLeaves() {
    return leaves
        .map((leaf, index) => ({ leaf, index }))
        .filter(({ leaf }) => leaf.classList.contains("leaf-spread"));
}

function getLetterGroups(lang) {
    const alphabet = getAlphabet(lang);
    const groups = new Map();
    const hashGroup = [];

    getMovieLeaves().forEach(({ leaf, index }) => {
        const title = getLeafTitle(leaf, lang);
        if (!title) return;

        const firstChar = title.trim().charAt(0).toUpperCase();
        const category = leaf.dataset.category || "";
        const entry = { title, index, category };

        if (alphabet.includes(firstChar)) {
            if (!groups.has(firstChar)) groups.set(firstChar, []);
            groups.get(firstChar).push(entry);
        } else {
            hashGroup.push(entry);
        }
    });

    const locale = lang === "ua" ? "uk" : "en";
    const collator = new Intl.Collator(locale, { sensitivity: "base" });

    groups.forEach((entries) => entries.sort((a, b) => collator.compare(a.title, b.title)));
    hashGroup.sort((a, b) => collator.compare(a.title, b.title));

    return { alphabet, groups, hashGroup };
}

function renderContents(lang) {
    const container = document.getElementById("contents-grid");
    if (!container || !leaves.length) return;

    const { alphabet, groups, hashGroup } = getLetterGroups(lang);

    container.innerHTML = "";

    alphabet.forEach((letter) => {
        if (groups.has(letter)) {
            container.appendChild(buildContentsSection(letter, groups.get(letter), lang));
        }
    });

    if (hashGroup.length) {
        container.appendChild(buildContentsSection("#", hashGroup, lang));
    }
}

const alphaFlyout = document.getElementById("alpha-flyout");
let alphaFlyoutLetter = null;

function closeAlphaFlyout() {
    if (!alphaFlyout) return;
    alphaFlyout.classList.remove("open");
    alphaFlyoutLetter = null;
    document.querySelectorAll(".alpha-nav-btn.active").forEach((btn) => {
        btn.classList.remove("active");
    });
}

function openAlphaFlyout(letter, entries, anchorBtn) {
    if (!alphaFlyout) return;

    alphaFlyout.innerHTML = "";

    entries.forEach(({ title, index }) => {
        const row = document.createElement("div");
        row.className = "alpha-flyout-entry";

        const titleSpan = document.createElement("span");
        titleSpan.textContent = title;

        const page = document.createElement("span");
        page.className = "entry-page";
        page.textContent = String(index).padStart(2, "0");

        row.append(titleSpan, page);
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            clearCategoryFilter();
            jumpToLeaf(index);
            closeAlphaFlyout();
        });

        alphaFlyout.appendChild(row);
    });

    const rect = anchorBtn.getBoundingClientRect();

    alphaFlyout.style.left = rect.right + 12 + "px";
    alphaFlyout.classList.add("open");

    const flyoutHeight = alphaFlyout.offsetHeight;
    const maxTop = Math.max(12, window.innerHeight - flyoutHeight - 12);
    alphaFlyout.style.top = Math.max(12, Math.min(rect.top, maxTop)) + "px";

    alphaFlyoutLetter = letter;
}

function renderAlphaNav(lang) {
    const container = document.getElementById("alpha-nav");
    if (!container || !leaves.length) return;

    const { alphabet, groups, hashGroup } = getLetterGroups(lang);

    container.innerHTML = "";
    closeAlphaFlyout();

    const addLetterButton = (letter, entries) => {
        const btn = document.createElement("button");
        btn.className = "alpha-nav-btn";
        btn.type = "button";
        btn.textContent = letter;
        btn.addEventListener("click", (e) => {
            e.stopPropagation();

            if (alphaFlyoutLetter === letter) {
                closeAlphaFlyout();
                return;
            }

            document.querySelectorAll(".alpha-nav-btn.active").forEach((b) => {
                b.classList.remove("active");
            });
            btn.classList.add("active");
            openAlphaFlyout(letter, entries, btn);
        });
        container.appendChild(btn);
    };

    alphabet.forEach((letter) => {
        if (groups.has(letter)) addLetterButton(letter, groups.get(letter));
    });

    if (hashGroup.length) addLetterButton("#", hashGroup);
}

function buildContentsSection(letter, entries, lang) {
    const section = document.createElement("div");
    section.className = "contents-section";

    const heading = document.createElement("div");
    heading.className = "contents-letter-heading";
    heading.textContent = letter;
    section.appendChild(heading);

    entries.forEach(({ title, index }) => {
        const row = document.createElement("div");
        row.className = "contents-entry";

        const titleSpan = document.createElement("span");
        titleSpan.className = "entry-title";
        titleSpan.textContent = title;

        const leader = document.createElement("span");
        leader.className = "entry-leader";

        const page = document.createElement("span");
        page.className = "entry-page";
        page.textContent = String(index).padStart(2, "0");

        row.append(titleSpan, leader, page);
        row.addEventListener("click", (e) => {
            e.stopPropagation();
            clearCategoryFilter();
            jumpToLeaf(index);
        });

        section.appendChild(row);
    });

    return section;
}

function jumpToLeaf(index) {
    if (index < 0 || index >= leaves.length) return;

    closeAlphaFlyout();

    flippedCount = index;
    updateLeaves();
}

if (readingProgressEl) {
    readingProgressEl.addEventListener("click", (e) => {
        const segment = e.target.closest(".progress-segment");
        if (!segment) return;
        const index = progressSegments.indexOf(segment);
        if (index !== -1) jumpToLeaf(index);
    });
}

document.addEventListener("click", (e) => {
    if (!alphaFlyoutLetter) return;
    if (e.target.closest(".alpha-nav, .alpha-flyout")) return;
    closeAlphaFlyout();
});

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeAlphaFlyout();
    }
});

const WHEEL_THRESHOLD = 24;

document.addEventListener("wheel", (e) => {
    if (e.target.closest(".side-menu, .top-bar, .reading-progress, .contents-grid, .alpha-nav, .alpha-flyout, .towatch-modal, .ctrl-panel, .ctrl-search-drop")) return;
    if (Math.abs(e.deltaY) < WHEEL_THRESHOLD) return;

    if (e.target.closest(".leaf-spread .right")) return;

    e.preventDefault();

    if (e.deltaY > 0) {
        const next = findNextMatchingLeaf(flippedCount + 1, 1);
        if (next !== -1) jumpToLeaf(next);
    } else {
        const prev = findNextMatchingLeaf(flippedCount - 1, -1);
        if (prev !== -1) jumpToLeaf(prev);
    }
}, { passive: false });

menuHomeButton.addEventListener("click", (e) => {
    e.stopPropagation();

    clearCategoryFilter();
    flippedCount = 0;
    updateLeaves();
});

menuContentsButton.addEventListener("click", (e) => {
    e.stopPropagation();

    clearCategoryFilter();

    const contentsIndex = leaves.findIndex((leaf) =>
        leaf.classList.contains("leaf-contents")
    );

    if (contentsIndex !== -1) {
        jumpToLeaf(contentsIndex);
    }
});

document.querySelectorAll(".side-menu-cat").forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        setCategoryFilter(btn.dataset.category);
    });
});

const langOptions = document.querySelectorAll(".lang-option");
const LANG_STORAGE_KEY = "must-watch-current-lang";

const savedLang = localStorage.getItem(LANG_STORAGE_KEY);
let currentLang = savedLang === "en" ? "en" : "ua";

const categoryWords = {
    movie: { ua: "фільм", en: "film" },
    series: { ua: "серіал", en: "series" },
    cartoon: { ua: "мультфільм", en: "cartoon" },
    anime: { ua: "аніме", en: "anime" }
};

function highlightCategoryWord(el, lang) {
    const wrapper = el.closest("[data-category]");
    if (!wrapper) return;

    const words = categoryWords[wrapper.dataset.category];
    if (!words) return;

    const word = words[lang];
    const regex = new RegExp(`(^|[^\\p{L}])(${word}\\p{L}*)`, "iu");

    el.innerHTML = el.textContent.replace(
        regex,
        (match, before, matchedWord) =>
            `${before}<span class="cat-word cat-${wrapper.dataset.category}">${matchedWord}</span>`
    );
}

function applyLanguage(lang) {
    document.querySelectorAll("[data-ua]").forEach((el) => {
        el.textContent = lang === "ua" ? el.dataset.ua : el.dataset.en;
    });

    document.querySelectorAll(".desc-text").forEach((el) => {
        highlightCategoryWord(el, lang);
    });

    langOptions.forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.lang === lang);
    });

    localStorage.setItem(LANG_STORAGE_KEY, lang);

    if (leaves.length) {
        manageImageWindow();
        renderContents(lang);
        renderAlphaNav(lang);
    }

    renderTowatchList(lang);

    if (ratingModal && ratingModal.classList.contains("open")) {
        renderRatingList(lang);
    }

    if (searchResults && searchResults.classList.contains("open") && searchInput) {
        renderSearchResults(searchInput.value);
    }
}

langOptions.forEach((btn) => {
    btn.addEventListener("click", (e) => {
        e.stopPropagation();

        const lang = btn.dataset.lang;
        if (lang !== currentLang) {
            const currentLeafEl = leaves[Math.min(flippedCount, leaves.length - 1)] || null;

            currentLang = lang;
            leaves = computeOrderedLeaves(currentLang);

            if (currentLeafEl) {
                const newIndex = leaves.indexOf(currentLeafEl);
                if (newIndex !== -1) flippedCount = newIndex;
            }

            buildProgressSegments();
            applyLanguage(currentLang);
            updateLeaves();
        }
    });
});

renderMovieLeaves();
buildLeaves();
applyLanguage(currentLang);