(() => {
    const back = document.getElementById("universityBack");
    if (back) back.addEventListener("click", () => { window.location.href = "../system/index.html"; });
})();

function uniUid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const UNIVERSITY_ENTRIES_STORAGE_KEY = "university_entries_v1";
const UNIVERSITY_CURRENT_ENTRY_STORAGE_KEY = "university_current_entry_v1";

function loadUniversityEntries() {
    try {
        const raw = localStorage.getItem(UNIVERSITY_ENTRIES_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed) && parsed.length) {
            return parsed.map((e) => ({
                id: e.id || uniUid(),
                text: e.text || "",
                autoContinuation: !!e.autoContinuation,
            }));
        }
    } catch (e) {

    }
    return [{ id: uniUid(), text: "" }];
}

function saveUniversityEntries(entries) {
    try {
        localStorage.setItem(UNIVERSITY_ENTRIES_STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {

    }
}

function loadUniversityCurrentEntry(maxIndex) {
    try {
        const raw = localStorage.getItem(UNIVERSITY_CURRENT_ENTRY_STORAGE_KEY);
        const idx = raw !== null ? parseInt(raw, 10) : 0;
        if (Number.isInteger(idx) && idx >= 0 && idx <= maxIndex) {
            return idx;
        }
    } catch (e) {

    }
    return 0;
}

function saveUniversityCurrentEntry(index) {
    try {
        localStorage.setItem(UNIVERSITY_CURRENT_ENTRY_STORAGE_KEY, String(index));
    } catch (e) {

    }
}

let universityEntries = loadUniversityEntries();
let universityCurrentEntry = loadUniversityCurrentEntry(universityEntries.length - 1);

(() => {
    const textEl = document.getElementById("universityEntryText");
    const rightText = document.getElementById("universityEntryTextRight");
    const prevBtn = document.getElementById("universityPrevEntry");
    const nextBtn = document.getElementById("universityNextEntry");
    const newBtn = document.getElementById("universityNewEntry");
    const deleteBtn = document.getElementById("universityDeleteEntry");
    const deleteConfirm = document.getElementById("universityDeleteConfirm");
    const deleteCancelBtn = document.getElementById("universityDeleteCancel");
    const deleteConfirmBtn = document.getElementById("universityDeleteConfirmBtn");
    const pageNumberEl = document.getElementById("universityPageNumberText");

    if (!textEl || !rightText) {
        return;
    }

    const leftPageContent = textEl.closest(".university-page-content");
    const rightPageContent = rightText.closest(".university-page-content");
    const ENTRY_SWITCH_ANIMATION_MS = 160;

    const textStyle = window.getComputedStyle(textEl);
    const LINE_HEIGHT_PX = parseFloat(textStyle.lineHeight) || 32;
    const LINES_PER_PAGE = Math.round((parseFloat(textStyle.maxHeight) || 416) / LINE_HEIGHT_PX);

    function animateEntrySwitch(updateFn) {
        const targets = [leftPageContent, rightPageContent].filter(Boolean);
        if (!targets.length) {
            updateFn();
            return;
        }
        targets.forEach((t) => t.classList.add("is-entry-switching"));
        window.setTimeout(() => {
            updateFn();
            targets.forEach((t) => t.classList.remove("is-entry-switching"));
        }, ENTRY_SWITCH_ANIMATION_MS);
    }

    const UNIVERSITY_ALLOWED_TAGS = new Set(["P", "OL", "LI", "BR"]);

    function sanitizeEntryHtml(html) {
        const template = document.createElement("template");
        template.innerHTML = html || "";

        // NOTE: this used to snapshot node.childNodes once via [...node.childNodes] and then,
        // on hitting a disallowed tag, unwrap it and recursively call clean(node) again on the
        // SAME node. That inner call mutates/removes nodes the outer forEach still held stale
        // references to, so a later iteration's removeChild() would throw "not a child of this
        // node" - reachable from an entirely ordinary paste (e.g. from a webpage or Word) that
        // contains two or more disallowed sibling tags. When it threw, saveCurrentEntry()
        // aborted before persisting anything and before restoring page padding/caret. Rewritten
        // as a plain live traversal (no snapshot, no re-entrant recursion on the same node) so
        // it can't desync from the DOM it's mutating.
        (function clean(node) {
            let child = node.firstChild;
            while (child) {
                if (child.nodeType === 1) {
                    if (!UNIVERSITY_ALLOWED_TAGS.has(child.tagName)) {
                        const firstUnwrapped = child.firstChild;
                        while (child.firstChild) {
                            node.insertBefore(child.firstChild, child);
                        }
                        const afterRemoved = child.nextSibling;
                        node.removeChild(child);
                        child = firstUnwrapped || afterRemoved;
                        continue;
                    }
                    const keepCenter = child.tagName === "P" && child.classList.contains("is-center");
                    while (child.attributes.length) {
                        child.removeAttribute(child.attributes[0].name);
                    }
                    if (keepCenter) {
                        child.className = "is-center";
                    }
                    clean(child);
                    child = child.nextSibling;
                } else if (child.nodeType !== 3) {
                    const next = child.nextSibling;
                    node.removeChild(child);
                    child = next;
                } else {
                    child = child.nextSibling;
                }
            }
        })(template.content);

        return template.innerHTML;
    }

    function stripPadding(el) {
        Array.from(el.childNodes).forEach((node) => {
            if (node.nodeType === 1 && node.tagName === "BR" && node.hasAttribute("data-pad")) {
                el.removeChild(node);
            }
        });
    }

    function padToCapacity(el) {
        stripPadding(el);
        let guard = 0;
        while (guard < LINES_PER_PAGE + 4) {
            guard += 1;
            const br = document.createElement("br");
            br.setAttribute("data-pad", "");
            el.appendChild(br);
            if (el.scrollHeight > el.clientHeight + 1) {
                el.removeChild(br);
                break;
            }
        }
    }

    let pendingLineAnchor = null;

    function consumePendingLineAnchor() {
        if (!pendingLineAnchor) return;
        const anchor = pendingLineAnchor;
        pendingLineAnchor = null;
        if (!anchor.isConnected || !anchor.textContent.endsWith("\u00a0")) return;

        const sel = window.getSelection();
        const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        const caretInAnchor = !!(range && range.collapsed && range.startContainer === anchor);

        if (caretInAnchor && anchor.textContent.length === 1) {
            pendingLineAnchor = anchor;
            return;
        }

        const caretOffset = caretInAnchor ? range.startOffset : null;
        anchor.textContent = anchor.textContent.slice(0, -1);

        if (caretInAnchor) {
            const newOffset = Math.max(0, Math.min(caretOffset, anchor.textContent.length));
            const r = document.createRange();
            r.setStart(anchor, newOffset);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
        }
    }

    let pendingClickAnchor = null;

    function revertPendingClickAnchor() {
        if (!pendingClickAnchor) return;
        const { anchorNode, promotedBrs } = pendingClickAnchor;
        pendingClickAnchor = null;
        if (!anchorNode.isConnected) return;

        const sel = window.getSelection();
        const liveRange = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        const caretInAnchor = !!(liveRange && liveRange.collapsed && liveRange.startContainer === anchorNode);
        const caretOffsetInAnchor = caretInAnchor ? liveRange.startOffset : null;

        if (anchorNode.textContent === "\u200b") {
            const container = anchorNode.parentNode;
            const idxInParent = Array.prototype.indexOf.call(container.childNodes, anchorNode);
            container.removeChild(anchorNode);
            promotedBrs.forEach((br) => {
                if (br.isConnected) br.setAttribute("data-pad", "");
            });
            if (caretInAnchor) {
                const r = document.createRange();
                const refNode = container.childNodes[idxInParent] || null;
                if (refNode) {
                    r.setStartBefore(refNode);
                } else {
                    r.selectNodeContents(container);
                    r.collapse(false);
                }
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
            }
            return;
        }

        const idx = anchorNode.textContent.indexOf("\u200b");
        if (idx === -1) return;
        anchorNode.textContent = anchorNode.textContent.slice(0, idx) + anchorNode.textContent.slice(idx + 1);
        if (caretInAnchor) {
            let newOffset = caretOffsetInAnchor > idx ? caretOffsetInAnchor - 1 : caretOffsetInAnchor;
            newOffset = Math.max(0, Math.min(newOffset, anchorNode.textContent.length));
            const r = document.createRange();
            r.setStart(anchorNode, newOffset);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
        }
    }

    function placeCaretAtBlankSpot(container, offset) {
        revertPendingClickAnchor();
        const promoted = [];
        for (let i = 0; i < offset; i += 1) {
            const n = container.childNodes[i];
            if (n && n.nodeType === 1 && n.tagName === "BR" && n.hasAttribute("data-pad")) {
                promoted.push(n);
            }
        }
        promoted.forEach((br) => br.removeAttribute("data-pad"));
        const anchor = document.createTextNode("\u200b");
        const refNode = container.childNodes[offset] || null;
        container.insertBefore(anchor, refNode);
        pendingClickAnchor = { anchorNode: anchor, promotedBrs: promoted };
        if (document.activeElement !== container) container.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(anchor, 1);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function captureExactCaret() {
        const active = document.activeElement;
        if (active !== textEl && active !== rightText) return null;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return null;
        if (range.startContainer !== active && !active.contains(range.startContainer)) return null;
        return { el: active, container: range.startContainer, offset: range.startOffset };
    }

    function restoreExactCaret(state) {
        if (!state) return;
        const { container, offset } = state;
        if (!container || !container.isConnected) return;
        const hostEl =
            container === textEl || textEl.contains(container)
                ? textEl
                : container === rightText || rightText.contains(container)
                  ? rightText
                  : null;
        if (!hostEl) return;
        const maxOffset = container.nodeType === 3 ? container.textContent.length : container.childNodes.length;
        const safeOffset = Math.max(0, Math.min(offset, maxOffset));
        const sel = window.getSelection();
        const range = document.createRange();
        range.setStart(container, safeOffset);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        if (document.activeElement !== hostEl) hostEl.focus();
    }

    function saveCurrentEntry() {
        consumePendingLineAnchor();
        revertPendingClickAnchor();

        const caretState = captureExactCaret();

        stripPadding(textEl);
        stripPadding(rightText);
        const combined = sanitizeEntryHtml(textEl.innerHTML) + sanitizeEntryHtml(rightText.innerHTML);
        universityEntries[universityCurrentEntry] = {
            ...universityEntries[universityCurrentEntry],
            text: combined,
        };
        saveUniversityEntries(universityEntries);
        padToCapacity(textEl);
        padToCapacity(rightText);

        restoreExactCaret(caretState);
    }

    function updateCounter() {
        if (pageNumberEl) {
            pageNumberEl.textContent = String((universityCurrentEntry + 1) * 2);
        }
        if (prevBtn) prevBtn.disabled = universityCurrentEntry === 0;
        if (nextBtn) nextBtn.disabled = universityCurrentEntry === universityEntries.length - 1;
    }

    function splitOverflowingTextNode(el, textNode) {
        const full = textNode.textContent;
        const len = full.length;
        if (len <= 1) return null;

        function fits(k) {
            textNode.textContent = full.slice(0, k);
            return el.scrollHeight <= el.clientHeight + 1;
        }

        if (!fits(0)) {
            textNode.textContent = full;
            return null;
        }

        let lo = 0;
        let hi = len;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (fits(mid)) {
                lo = mid;
            } else {
                hi = mid - 1;
            }
        }

        textNode.textContent = full.slice(0, lo);
        const remainder = full.slice(lo);
        if (!remainder) return null;
        const remainderNode = document.createTextNode(remainder);
        if (textNode.nextSibling) {
            textNode.parentNode.insertBefore(remainderNode, textNode.nextSibling);
        } else {
            textNode.parentNode.appendChild(remainderNode);
        }
        return remainderNode;
    }

    function extractOverflowNodes(el) {
        const overflowNodes = [];
        let guard = 0;
        while (el.scrollHeight > el.clientHeight + 1 && el.childNodes.length && guard < 200) {
            guard += 1;
            const lastNode = el.lastChild;
            if (lastNode.nodeType === 1 && lastNode.tagName === "OL" && lastNode.lastElementChild) {
                const li = lastNode.lastElementChild;
                lastNode.removeChild(li);
                overflowNodes.unshift(li);
                if (!lastNode.firstElementChild) {
                    el.removeChild(lastNode);
                }
                continue;
            }
            if (lastNode.nodeType === 3 && lastNode.textContent.length > 1) {
                const remainder = splitOverflowingTextNode(el, lastNode);
                if (remainder) {
                    el.removeChild(remainder);
                    overflowNodes.unshift(remainder);
                    continue;
                }
            }
            el.removeChild(lastNode);
            overflowNodes.unshift(lastNode);
        }
        return overflowNodes;
    }

    function normalizeAndPrepend(el, nodes) {
        if (!nodes.length) return;
        const grouped = [];
        let liBuffer = [];
        nodes.forEach((n) => {
            if (n.nodeType === 1 && n.tagName === "LI") {
                liBuffer.push(n);
            } else {
                if (liBuffer.length) {
                    grouped.push({ type: "ol", items: liBuffer });
                    liBuffer = [];
                }
                grouped.push({ type: "node", node: n });
            }
        });
        if (liBuffer.length) grouped.push({ type: "ol", items: liBuffer });

        const frag = document.createDocumentFragment();
        grouped.forEach((g, i) => {
            if (g.type === "ol") {
                if (i === 0 && el.firstChild && el.firstChild.nodeType === 1 && el.firstChild.tagName === "OL") {
                    g.items.slice().reverse().forEach((li) => el.firstChild.insertBefore(li, el.firstChild.firstChild));
                } else {
                    const ol = document.createElement("ol");
                    g.items.forEach((li) => ol.appendChild(li));
                    frag.appendChild(ol);
                }
            } else {
                frag.appendChild(g.node);
            }
        });
        el.insertBefore(frag, el.firstChild);
    }

    function pullBackward() {
        let guard = 0;
        while (guard < 200 && rightText.firstChild) {
            guard += 1;
            const firstNode = rightText.firstChild;

            if (firstNode.nodeType === 1 && firstNode.tagName === "OL") {
                const li = firstNode.firstElementChild;
                if (!li) {
                    rightText.removeChild(firstNode);
                    continue;
                }
                firstNode.removeChild(li);
                if (!firstNode.firstElementChild) {
                    rightText.removeChild(firstNode);
                }
                let ol = textEl.lastChild;
                if (!(ol && ol.nodeType === 1 && ol.tagName === "OL")) {
                    ol = document.createElement("ol");
                    textEl.appendChild(ol);
                }
                ol.appendChild(li);
                if (textEl.scrollHeight > textEl.clientHeight + 1) {
                    ol.removeChild(li);
                    if (!ol.firstElementChild && ol.parentNode === textEl) {
                        textEl.removeChild(ol);
                    }
                    const freshOl = document.createElement("ol");
                    freshOl.appendChild(li);
                    rightText.insertBefore(freshOl, rightText.firstChild);
                    break;
                }
                continue;
            }

            rightText.removeChild(firstNode);
            textEl.appendChild(firstNode);
            if (textEl.scrollHeight > textEl.clientHeight + 1) {
                textEl.removeChild(firstNode);
                rightText.insertBefore(firstNode, rightText.firstChild);
                break;
            }
        }
    }

    function getPlainTextOffsetIn(container) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return 0;
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        const measure = document.createRange();
        measure.selectNodeContents(container);
        try {
            measure.setEnd(range.endContainer, range.endOffset);
        } catch (e) {
            return 0;
        }
        return measure.toString().length;
    }

    function setPlainTextOffsetIn(el, offset) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let remaining = Math.max(0, offset);
        let target = null;
        let targetOffset = 0;
        while (node) {
            if (remaining <= node.textContent.length) {
                target = node;
                targetOffset = remaining;
                break;
            }
            remaining -= node.textContent.length;
            node = walker.nextNode();
        }
        const sel = window.getSelection();
        const range = document.createRange();
        if (target) {
            range.setStart(target, targetOffset);
        } else {
            const firstPad = Array.from(el.childNodes).find(
                (n) => n.nodeType === 1 && n.tagName === "BR" && n.hasAttribute("data-pad"),
            );
            if (firstPad) {
                range.setStartBefore(firstPad);
            } else {
                range.selectNodeContents(el);
                range.collapse(false);
            }
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        if (document.activeElement !== el) el.focus();
    }

    function getCaretPageState() {
        const active = document.activeElement;
        if (active !== textEl && active !== rightText) return null;
        return { el: active, offset: getPlainTextOffsetIn(active) };
    }

    function restoreCaretAfterSync(caretState, oldTextLen) {
        if (!caretState) return;
        const newTextLen = textEl.textContent.length;

        if (caretState.el === textEl) {
            if (caretState.offset <= newTextLen) {
                setPlainTextOffsetIn(textEl, caretState.offset);
            } else {
                setPlainTextOffsetIn(rightText, caretState.offset - newTextLen);
            }
            return;
        }

        const pulledIn = newTextLen - oldTextLen;
        if (pulledIn > 0) {
            if (caretState.offset < pulledIn) {
                setPlainTextOffsetIn(textEl, oldTextLen + caretState.offset);
            } else {
                setPlainTextOffsetIn(rightText, caretState.offset - pulledIn);
            }
        } else {
            const newRightLen = rightText.textContent.length;
            setPlainTextOffsetIn(rightText, Math.min(caretState.offset, newRightLen));
        }
    }

    function focusEnd(el) {
        el.focus();
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function placeCaretAtStart(el) {
        const sel = window.getSelection();
        const range = document.createRange();
        range.selectNodeContents(el);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function placeCaretAtOffset(offset) {
        const leftLen = textEl.textContent.length;
        if (offset <= leftLen) {
            setPlainTextOffsetIn(textEl, offset);
        } else {
            setPlainTextOffsetIn(rightText, offset - leftLen);
        }
    }

    function moveOverflowToNextEntry(nodes) {
        const wrapper = document.createElement("div");
        nodes.forEach((n) => wrapper.appendChild(n));
        const overflowPlainLen = wrapper.textContent.length;
        const overflowHtml = sanitizeEntryHtml(wrapper.innerHTML);
        const nextIdx = universityCurrentEntry + 1;
        const isNewEntry = !universityEntries[nextIdx];

        if (isNewEntry) {
            universityEntries.splice(nextIdx, 0, { id: uniUid(), text: overflowHtml, autoContinuation: true });
        } else {
            universityEntries[nextIdx] = {
                ...universityEntries[nextIdx],
                text: overflowHtml + universityEntries[nextIdx].text,
            };
        }
        saveUniversityEntries(universityEntries);

        universityCurrentEntry = nextIdx;
        renderCurrentEntry();
        saveUniversityCurrentEntry(universityCurrentEntry);
        textEl.focus();
        placeCaretAtOffset(overflowPlainLen);
    }

    let sawDeletionKey = false;
    function markDeletionKey(e) {
        if (e.key === "Backspace" || e.key === "Delete") sawDeletionKey = true;
    }
    textEl.addEventListener("keydown", markDeletionKey);
    rightText.addEventListener("keydown", markDeletionKey);

    function cascadePullForwardFromNextEntries() {
        let guard = 0;
        while (guard < 50) {
            guard += 1;
            if (rightText.scrollHeight > rightText.clientHeight + 1) break;

            const nextIdx = universityCurrentEntry + 1;
            const nextEntry = universityEntries[nextIdx];
            if (!nextEntry) break;
            // Only reflow content that is itself an auto-created overflow continuation of
            // THIS entry (created by moveOverflowToNextEntry). A genuinely separate entry
            // (a different diary page the user wrote/added) must never be pulled backward
            // and merged into whatever is currently being edited.
            if (!nextEntry.autoContinuation) break;

            const temp = document.createElement("div");
            temp.innerHTML = sanitizeEntryHtml(nextEntry.text);
            const incomingNodes = Array.from(temp.childNodes);
            if (!incomingNodes.length) {
                universityEntries.splice(nextIdx, 1);
                continue;
            }

            incomingNodes.forEach((n) => {
                const lastChild = rightText.lastChild;
                if (
                    n.nodeType === 1 &&
                    n.tagName === "OL" &&
                    lastChild &&
                    lastChild.nodeType === 1 &&
                    lastChild.tagName === "OL"
                ) {
                    Array.from(n.childNodes).forEach((li) => lastChild.appendChild(li));
                } else {
                    rightText.appendChild(n);
                }
            });

            const leftover = extractOverflowNodes(rightText);
            if (leftover.length) {
                const wrapper = document.createElement("div");
                leftover.forEach((n) => wrapper.appendChild(n));
                universityEntries[nextIdx] = { ...nextEntry, text: sanitizeEntryHtml(wrapper.innerHTML) };
                break;
            }

            universityEntries.splice(nextIdx, 1);
        }
    }

    function distributeEntryForRender() {
        const overflow = extractOverflowNodes(textEl);
        if (overflow.length) {
            normalizeAndPrepend(rightText, overflow);
        }
    }

    function normalizeTrailingDoubleBr(el) {
        // Collapse AT MOST ONE redundant trailing bare <br> (the extra line-break some
        // browsers leave behind purely to keep a final empty line rendering/host a caret).
        // This must never loop: looping here would silently eat through every real blank
        // line the user typed, collapsing several of them in one shot and making the caret
        // appear to "jump" up multiple lines instead of moving up exactly one at a time.
        if (el.childNodes.length < 2) return;
        const last = el.lastChild;
        const prev = last.previousSibling;
        const isBareBr = (n) => n.nodeType === 1 && n.tagName === "BR" && !n.hasAttribute("data-pad");
        if (!isBareBr(last) || !isBareBr(prev)) return;

        const idx = Array.prototype.indexOf.call(el.childNodes, last);
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            const range = sel.getRangeAt(0);
            const touchesLast =
                range.collapsed &&
                (range.startContainer === last ||
                    (range.startContainer === el && range.startOffset >= idx));
            if (touchesLast) {
                const r = document.createRange();
                r.setStart(el, idx);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
            }
        }
        el.removeChild(last);
    }

    function syncPages(e) {
        consumePendingLineAnchor();
        revertPendingClickAnchor();

        const caretState = captureExactCaret();

        stripPadding(textEl);
        stripPadding(rightText);
        // NOTE: normalizeTrailingDoubleBr() used to run here on every deletion. It collapsed
        // trailing bare <br> lines beyond what the browser's own native Backspace already
        // removed, so whenever the debounced sync settled while 2+ blank lines sat at the end
        // of the page, it silently deleted an EXTRA line on top of the one the user actually
        // deleted - the caret then visibly jumped up multiple lines instead of exactly one.
        // Native Backspace already merges/removes lines correctly on its own; this extra pass
        // is not needed and is intentionally left disabled.

        const editedRight = e && e.target === rightText;

        if (!editedRight) {
            const overflow1 = extractOverflowNodes(textEl);
            if (overflow1.length) {
                normalizeAndPrepend(rightText, overflow1);
            } else if (sawDeletionKey) {
                pullBackward();
            }
        }

        if (sawDeletionKey) {
            cascadePullForwardFromNextEntries();
            sawDeletionKey = false;
        }
        saveUniversityEntries(universityEntries);
        updateCounter();

        restoreExactCaret(caretState);

        const overflow2 = extractOverflowNodes(rightText);
        if (overflow2.length) {
            saveCurrentEntry();
            moveOverflowToNextEntry(overflow2);
        } else {
            saveCurrentEntry();
        }
    }

    function renderCurrentEntry() {
        const entry = universityEntries[universityCurrentEntry];
        textEl.innerHTML = sanitizeEntryHtml(entry.text);
        rightText.innerHTML = "";
        distributeEntryForRender();
        padToCapacity(textEl);
        padToCapacity(rightText);
        updateCounter();
    }

    function handleEditableKeydown(e) {
        if (e.key !== "Enter" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        consumePendingLineAnchor();
        revertPendingClickAnchor();
        const container = e.currentTarget;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return;
        const node = sel.getRangeAt(0).startContainer;
        const startEl = node.nodeType === 1 ? node : node.parentElement;
        const insideList = startEl && startEl.closest && startEl.closest("li") && container.contains(startEl.closest("li"));
        const insideParagraph = startEl && startEl.closest && startEl.closest("p") && container.contains(startEl.closest("p"));
        if (insideList || insideParagraph) return;

        e.preventDefault();
        stripPadding(container);
        const range = sel.getRangeAt(0);
        range.deleteContents();
        const br = document.createElement("br");
        range.insertNode(br);
        if (br.nextSibling && br.nextSibling.nodeType === 3 && br.nextSibling.textContent === "") {
            br.parentNode.removeChild(br.nextSibling);
        }

        function placeCaretAfterBr() {
            const s = window.getSelection();
            const r = document.createRange();
            r.setStartAfter(br);
            r.collapse(true);
            s.removeAllRanges();
            s.addRange(r);
        }
        placeCaretAfterBr();

        if (syncDebounceTimer) {
            window.clearTimeout(syncDebounceTimer);
            syncDebounceTimer = null;
        }
        saveCurrentEntry();
        syncPages({ target: container });

        if (!br.isConnected) return;

        const finalParent = br.parentNode;
        if (document.activeElement !== finalParent) finalParent.focus();

        if (!br.nextSibling) {
            const anchor = document.createTextNode(" ");
            pendingLineAnchor = anchor;
            finalParent.appendChild(anchor);
            const s = window.getSelection();
            const r = document.createRange();
            r.setStart(anchor, 0);
            r.collapse(true);
            s.removeAllRanges();
            s.addRange(r);
            return;
        }
        placeCaretAfterBr();
    }

    textEl.addEventListener("keydown", handleEditableKeydown);
    rightText.addEventListener("keydown", handleEditableKeydown);

    function containerTextOffset(container) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return null;
        if (range.startContainer !== container && !container.contains(range.startContainer)) return null;
        const measure = document.createRange();
        measure.selectNodeContents(container);
        try {
            measure.setEnd(range.startContainer, range.startOffset);
        } catch (e) {
            return null;
        }
        return measure.toString().length;
    }

    function selectionStartOffsetIn(container) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (range.startContainer !== container && !container.contains(range.startContainer)) return null;
        const measure = document.createRange();
        measure.selectNodeContents(container);
        try {
            measure.setEnd(range.startContainer, range.startOffset);
        } catch (e) {
            return null;
        }
        return measure.toString().length;
    }

    function handleBoundaryKeydown(e) {
        if (e.key === "Backspace" && window.__universityHandleListBackspaceAtStart) {
            window.__universityHandleListBackspaceAtStart(e);
            if (e.defaultPrevented) return;
        }
        if (e.key === "Backspace" && e.currentTarget === rightText) {
            if (selectionStartOffsetIn(rightText) === 0 && textEl.textContent.length > 0) {
                e.preventDefault();
                const sel = window.getSelection();
                const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
                if (range && !range.collapsed) {
                    range.deleteContents();
                    rightText.dispatchEvent(new Event("input", { bubbles: true }));
                }
                focusEnd(textEl);
            }
            return;
        }
        if (e.key === "Delete" && e.currentTarget === textEl) {
            const offset = containerTextOffset(textEl);
            if (offset !== null && offset === textEl.textContent.length && rightText.textContent.length > 0) {
                e.preventDefault();
                rightText.focus();
                placeCaretAtStart(rightText);
            }
        }
    }

    textEl.addEventListener("keydown", handleBoundaryKeydown);
    rightText.addEventListener("keydown", handleBoundaryKeydown);

    // ArrowRight/ArrowDown at the very end of the left page, and ArrowLeft/ArrowUp at the very
    // start of the right page, should hop to the adjacent page - mirroring how Backspace/Delete
    // already cross the page boundary above. We deliberately do NOT decide this from plain-text
    // length (that would skip over blank lines still sitting on the current page). Instead we
    // let the native key handling run first, then check on the next tick whether the caret
    // actually moved. If it's still in the exact same spot, the browser had nowhere left to go
    // on this page, so we move it onto the other one.
    function caretVisualPosition() {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        if (!range.collapsed) return null;
        let rect = range.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0) {
            // A collapsed range right at certain positions (e.g. a text node end that sits
            // against an element boundary) reports an all-zero rect instead of the caret's real
            // on-screen spot. Insert a temporary zero-width marker to get a trustworthy rect.
            const marker = document.createElement("span");
            marker.textContent = "​";
            const markerRange = range.cloneRange();
            markerRange.insertNode(marker);
            rect = marker.getBoundingClientRect();
            const parent = marker.parentNode;
            if (parent) parent.removeChild(marker);
            if (parent) parent.normalize();
        }
        return { top: rect.top, left: rect.left, container: range.startContainer, offset: range.startOffset };
    }

    function handleCrossPageArrowKeys(e) {
        if (e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
        const backward = e.key === "ArrowLeft" || e.key === "ArrowUp";
        if (!forward && !backward) return;
        const el = e.currentTarget;
        if (forward && el !== textEl) return;
        if (backward && el !== rightText) return;

        const before = caretVisualPosition();
        if (!before) return;

        window.setTimeout(() => {
            if (document.activeElement !== el) return;
            const after = caretVisualPosition();
            // Trailing <br> padding can leave the DOM container/offset identical to before a
            // horizontal move even though the browser did move the caret onto a new line, so we
            // compare the caret's on-screen position (not raw container/offset) to decide
            // whether native handling actually had anywhere left to go on this page.
            const stillAtSameSpot =
                after &&
                Math.abs(after.top - before.top) < 1 &&
                Math.abs(after.left - before.left) < 1 &&
                after.container === before.container &&
                after.offset === before.offset;
            if (!stillAtSameSpot) return;
            if (forward) {
                rightText.focus();
                placeCaretAtStart(rightText);
            } else {
                focusEnd(textEl);
            }
        }, 0);
    }

    textEl.addEventListener("keydown", handleCrossPageArrowKeys);
    rightText.addEventListener("keydown", handleCrossPageArrowKeys);

    const SYNC_DEBOUNCE_MS = 220;
    let syncDebounceTimer = null;

    function scheduleSyncPages(e) {
        saveCurrentEntry();
        const target = e && e.target;
        if (syncDebounceTimer) window.clearTimeout(syncDebounceTimer);
        syncDebounceTimer = window.setTimeout(() => {
            syncDebounceTimer = null;
            syncPages({ target });
        }, SYNC_DEBOUNCE_MS);
    }

    textEl.addEventListener("input", scheduleSyncPages);
    rightText.addEventListener("input", scheduleSyncPages);

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (universityCurrentEntry > 0) {
                saveCurrentEntry();
                animateEntrySwitch(() => {
                    universityCurrentEntry -= 1;
                    renderCurrentEntry();
                    saveUniversityCurrentEntry(universityCurrentEntry);
                });
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (universityCurrentEntry < universityEntries.length - 1) {
                saveCurrentEntry();
                animateEntrySwitch(() => {
                    universityCurrentEntry += 1;
                    renderCurrentEntry();
                    saveUniversityCurrentEntry(universityCurrentEntry);
                });
            }
        });
    }

    if (newBtn) {
        newBtn.addEventListener("click", () => {
            saveCurrentEntry();
            animateEntrySwitch(() => {
                universityEntries.push({ id: uniUid(), text: "" });
                universityCurrentEntry = universityEntries.length - 1;
                renderCurrentEntry();
                saveUniversityEntries(universityEntries);
                saveUniversityCurrentEntry(universityCurrentEntry);
                textEl.focus();
            });
        });
    }

    function hideDeleteConfirm() {
        if (deleteConfirm) deleteConfirm.classList.remove("is-visible");
    }

    if (deleteBtn && deleteConfirm) {
        deleteBtn.addEventListener("click", () => {
            deleteConfirm.classList.add("is-visible");
        });
    }

    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener("click", hideDeleteConfirm);
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener("click", () => {
            hideDeleteConfirm();
            if (universityEntries.length <= 1) {
                universityEntries[universityCurrentEntry] = { id: uniUid(), text: "" };
            } else {
                universityEntries.splice(universityCurrentEntry, 1);
                if (universityCurrentEntry >= universityEntries.length) {
                    universityCurrentEntry = universityEntries.length - 1;
                }
            }
            saveUniversityEntries(universityEntries);
            animateEntrySwitch(() => {
                renderCurrentEntry();
                saveUniversityCurrentEntry(universityCurrentEntry);
            });
        });
    }

    [
        { pageContent: leftPageContent, target: textEl },
        { pageContent: rightPageContent, target: rightText },
    ].forEach(({ pageContent, target }) => {
        if (!pageContent) return;
        pageContent.addEventListener("mousedown", (e) => {
            if (e.target === pageContent) {
                e.preventDefault();
                focusEnd(target);
            }
        });
    });

    function getCaretRangeFromPoint(x, y) {
        if (document.caretRangeFromPoint) {
            return document.caretRangeFromPoint(x, y);
        }
        if (document.caretPositionFromPoint) {
            const pos = document.caretPositionFromPoint(x, y);
            if (!pos || !pos.offsetNode) return null;
            const range = document.createRange();
            range.setStart(pos.offsetNode, pos.offset);
            range.collapse(true);
            return range;
        }
        return null;
    }

    [textEl, rightText].forEach((container) => {
        container.addEventListener("mousedown", (e) => {
            if (e.button !== 0) return;
            const range = getCaretRangeFromPoint(e.clientX, e.clientY);
            if (!range || range.startContainer !== container) return;
            e.preventDefault();
            placeCaretAtBlankSpot(container, range.startOffset);
        });
    });

    [textEl, rightText].forEach((container) => {
        container.addEventListener("blur", () => {
            revertPendingClickAnchor();
        });
    });

    window.__universityCommitPendingCarets = function () {
        consumePendingLineAnchor();
        revertPendingClickAnchor();
    };

    window.__universityRegisterLineAnchor = function (node) {
        pendingLineAnchor = node;
    };

    renderCurrentEntry();

    if (window.document && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(() => {
            const focusedRight = document.activeElement === rightText;
            const focusedLeft = document.activeElement === textEl;
            if (focusedLeft || focusedRight) {
                syncPages({ target: focusedRight ? rightText : textEl });
            } else {
                renderCurrentEntry();
            }
        });
    }
})();

(() => {
    const toolbar = document.getElementById("universityFormatToolbar");
    const textEl = document.getElementById("universityEntryText");
    const rightText = document.getElementById("universityEntryTextRight");
    if (!toolbar || !textEl || !rightText) return;

    function getActiveTextEl() {
        return document.activeElement === rightText ? rightText : textEl;
    }

    function getTopLevelNode(node, container) {
        while (node && node.parentNode !== container) {
            node = node.parentNode;
        }
        return node;
    }

    function getCurrentLine(container) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return null;
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        if (node !== container && !container.contains(node)) return null;

        let top;
        if (node === container) {
            const siblings = Array.from(container.childNodes);
            const offset = range.startOffset;
            const before = offset > 0 ? siblings[offset - 1] : null;
            const isBoundary = (n) => n && n.nodeType === 1 && (n.tagName === "BR" || n.tagName === "P" || n.tagName === "OL");
            if (!before || isBoundary(before)) {
                return { type: "plain", nodes: [], nextBoundary: siblings[offset] || null };
            }
            top = before;
        } else {
            const startEl = node.nodeType === 1 ? node : node.parentElement;
            const li = startEl && startEl.closest ? startEl.closest("li") : null;
            if (li && container.contains(li)) {
                return { type: "li", el: li };
            }
            const p = startEl && startEl.closest ? startEl.closest("p") : null;
            if (p && container.contains(p)) {
                return { type: "p", el: p };
            }

            top = getTopLevelNode(node, container);
            if (!top) return null;
        }
        const children = Array.from(container.childNodes);
        const idx = children.indexOf(top);
        if (idx === -1) return null;

        let start = idx;
        while (start > 0) {
            const prev = children[start - 1];
            if (prev.nodeType === 1 && (prev.tagName === "BR" || prev.tagName === "P" || prev.tagName === "OL")) break;
            start -= 1;
        }
        let end = idx;
        while (end < children.length - 1) {
            const next = children[end + 1];
            if (next.nodeType === 1 && (next.tagName === "BR" || next.tagName === "P" || next.tagName === "OL")) break;
            end += 1;
        }
        return {
            type: "plain",
            nodes: children.slice(start, end + 1),
            nextBoundary: end < children.length - 1 ? children[end + 1] : null,
        };
    }

    function getCaretOffsetInLine(line) {
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount) return 0;
        const caret = sel.getRangeAt(0).cloneRange();
        caret.collapse(true);
        const measure = document.createRange();
        try {
            if (line.type === "plain") {
                if (!line.nodes.length) return 0;
                measure.setStartBefore(line.nodes[0]);
            } else {
                measure.setStart(line.el, 0);
            }
            measure.setEnd(caret.endContainer, caret.endOffset);
            return measure.toString().length;
        } catch (e) {
            return 0;
        }
    }

    function setCaretOffsetInNodes(nodes, offset) {
        let remaining = offset;
        let target = null;
        let targetOffset = 0;
        for (const node of nodes) {
            const len = node.textContent.length;
            if (remaining <= len) {
                target = node;
                targetOffset = remaining;
                break;
            }
            remaining -= len;
        }
        const sel = window.getSelection();
        const range = document.createRange();
        if (target) {
            range.setStart(target, targetOffset);
        } else if (nodes.length) {
            const last = nodes[nodes.length - 1];
            range.setStart(last, last.textContent.length);
        } else {
            return;
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function setCaretOffsetInElement(el, offset) {
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
        let node = walker.nextNode();
        let remaining = offset;
        let target = null;
        let targetOffset = 0;
        while (node) {
            if (remaining <= node.textContent.length) {
                target = node;
                targetOffset = remaining;
                break;
            }
            remaining -= node.textContent.length;
            node = walker.nextNode();
        }
        const sel = window.getSelection();
        const range = document.createRange();
        if (target) {
            range.setStart(target, targetOffset);
        } else {
            range.selectNodeContents(el);
            range.collapse(false);
        }
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    }

    function splitOlAroundLi(ol, li, container) {
        const allLis = Array.from(ol.children);
        const idx = allLis.indexOf(li);
        const before = allLis.slice(0, idx);
        const after = allLis.slice(idx + 1);
        li.remove();

        let insertBeforeNode;
        if (!before.length && !after.length) {
            insertBeforeNode = ol.nextSibling;
            ol.remove();
        } else if (!before.length) {
            insertBeforeNode = ol;
        } else if (!after.length) {
            insertBeforeNode = ol.nextSibling;
        } else {
            const olAfter = document.createElement("ol");
            after.forEach((item) => olAfter.appendChild(item));
            container.insertBefore(olAfter, ol.nextSibling);
            insertBeforeNode = olAfter;
        }
        return insertBeforeNode;
    }

    function isPlainBr(n) {
        return !!n && n.nodeType === 1 && n.tagName === "BR" && !n.hasAttribute("data-pad");
    }

    function needsLeadingBr(n) {
        if (!n) return false;
        if (n.nodeType === 1 && (n.tagName === "BR" || n.tagName === "P" || n.tagName === "OL")) return false;
        return true;
    }

    function needsTrailingBr(n) {
        if (!n) return false;
        if (n.nodeType === 1 && (n.tagName === "P" || n.tagName === "OL")) return false;
        if (n.nodeType === 1 && n.tagName === "BR" && n.hasAttribute("data-pad")) return false;
        return true;
    }

    function spliceNodesWithBoundaries(container, nodes, prevAnchor, nextAnchor) {
        nodes.forEach((n) => container.insertBefore(n, nextAnchor));
        let boundaryAfter = nextAnchor;
        if (needsTrailingBr(nextAnchor)) {
            const br = document.createElement("br");
            container.insertBefore(br, nextAnchor);
            boundaryAfter = br;
        }
        if (needsLeadingBr(prevAnchor)) {
            container.insertBefore(document.createElement("br"), nodes.length ? nodes[0] : boundaryAfter);
        }
        return boundaryAfter;
    }

    function unwrapLineToPlain(line, container) {
        if (line.type === "plain") {
            return { nodes: line.nodes, insertBeforeNode: line.nextBoundary || null };
        }
        if (line.type === "p") {
            const prev = line.el.previousSibling;
            const next = line.el.nextSibling;
            const nodes = Array.from(line.el.childNodes);
            line.el.remove();
            const insertBeforeNode = spliceNodesWithBoundaries(container, nodes, prev, next);
            return { nodes, insertBeforeNode };
        }
        const ol = line.el.parentNode;
        const nodes = Array.from(line.el.childNodes);
        const next = splitOlAroundLi(ol, line.el, container);
        const prev = next ? next.previousSibling : container.lastChild;
        const insertBeforeNode = spliceNodesWithBoundaries(container, nodes, prev, next);
        return { nodes, insertBeforeNode };
    }

    function wrapPlainAsBlock(container, plainInfo, tagName, className) {
        let nodes = plainInfo.nodes.slice();
        let insertionPoint = plainInfo.insertBeforeNode;

        if (isPlainBr(insertionPoint)) {
            const after = insertionPoint.nextSibling;
            insertionPoint.parentNode.removeChild(insertionPoint);
            insertionPoint = after;
        }

        nodes.forEach((n) => {
            if (n.parentNode) n.parentNode.removeChild(n);
        });
        let emptyAnchor = null;
        if (!nodes.length) {
            emptyAnchor = document.createTextNode(" ");
            nodes = [emptyAnchor];
        }

        if (tagName === "li") {
            const prevSibling = insertionPoint ? insertionPoint.previousSibling : container.lastChild;
            let ol;
            if (prevSibling && prevSibling.nodeType === 1 && prevSibling.tagName === "OL") {
                ol = prevSibling;
            } else if (insertionPoint && insertionPoint.nodeType === 1 && insertionPoint.tagName === "OL") {
                ol = insertionPoint;
            } else {
                ol = document.createElement("ol");
                container.insertBefore(ol, insertionPoint);
            }
            const li = document.createElement("li");
            nodes.forEach((n) => li.appendChild(n));
            if (ol === insertionPoint) {
                ol.insertBefore(li, ol.firstChild);
            } else {
                ol.appendChild(li);
            }
            li.__universityEmptyAnchor = emptyAnchor;
            return li;
        }

        const p = document.createElement("p");
        if (className) p.className = className;
        nodes.forEach((n) => p.appendChild(n));
        container.insertBefore(p, insertionPoint);
        p.__universityEmptyAnchor = emptyAnchor;
        return p;
    }

    function applyLineFormat(kind) {
        const container = getActiveTextEl();
        container.focus();
        const line = getCurrentLine(container);
        if (!line) return;
        const offset = getCaretOffsetInLine(line);

        let isSameFormat = false;
        if (kind === "paragraph" && line.type === "p" && !line.el.classList.contains("is-center")) isSameFormat = true;
        if (kind === "center" && line.type === "p" && line.el.classList.contains("is-center")) isSameFormat = true;
        if (kind === "list" && line.type === "li") isSameFormat = true;

        const plainInfo = unwrapLineToPlain(line, container);

        let newEl = null;
        if (!isSameFormat) {
            if (kind === "paragraph") {
                newEl = wrapPlainAsBlock(container, plainInfo, "p", "");
            } else if (kind === "center") {
                newEl = wrapPlainAsBlock(container, plainInfo, "p", "is-center");
            } else if (kind === "list") {
                newEl = wrapPlainAsBlock(container, plainInfo, "li", "");
            }
        }

        let skipSave = false;
        if (newEl) {
            if (newEl.__universityEmptyAnchor) {
                const anchor = newEl.__universityEmptyAnchor;
                delete newEl.__universityEmptyAnchor;
                if (window.__universityRegisterLineAnchor) window.__universityRegisterLineAnchor(anchor);
                const sel = window.getSelection();
                const range = document.createRange();
                range.setStart(anchor, 0);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                skipSave = true;
            } else {
                setCaretOffsetInElement(newEl, offset);
            }
        } else {
            setCaretOffsetInNodes(plainInfo.nodes, offset);
        }

        if (!skipSave) {
            container.dispatchEvent(new Event("input", { bubbles: true }));
        }
    }

    function handleListBackspaceAtStart(e) {
        if (e.key !== "Backspace" || e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
        const sel = window.getSelection();
        if (!sel || !sel.rangeCount || !sel.isCollapsed) return;
        const container = e.currentTarget;
        const line = getCurrentLine(container);
        if (!line || line.type !== "li") return;
        if (line.el.previousElementSibling) return;
        if (getCaretOffsetInLine(line) !== 0) return;
        e.preventDefault();
        if (window.__universityCommitPendingCarets) window.__universityCommitPendingCarets();
        applyLineFormat("list");
    }

    textEl.addEventListener("keydown", handleListBackspaceAtStart);
    rightText.addEventListener("keydown", handleListBackspaceAtStart);
    window.__universityHandleListBackspaceAtStart = handleListBackspaceAtStart;

    const formatButtons = {
        paragraph: toolbar.querySelector('[data-format="paragraph"]'),
        list: toolbar.querySelector('[data-format="list"]'),
        center: toolbar.querySelector('[data-format="center"]'),
    };

    function updateToolbarActiveState() {
        if (document.activeElement !== textEl && document.activeElement !== rightText) {
            Object.values(formatButtons).forEach((btn) => btn && btn.classList.remove("is-active"));
            return;
        }
        const container = getActiveTextEl();
        const line = getCurrentLine(container);
        let active = null;
        if (line) {
            if (line.type === "li") active = "list";
            else if (line.type === "p") active = line.el.classList.contains("is-center") ? "center" : "paragraph";
        }
        Object.keys(formatButtons).forEach((key) => {
            const btn = formatButtons[key];
            if (!btn) return;
            btn.classList.toggle("is-active", key === active);
        });
    }

    document.addEventListener("selectionchange", updateToolbarActiveState);
    [textEl, rightText].forEach((el) => {
        el.addEventListener("keyup", updateToolbarActiveState);
        el.addEventListener("click", updateToolbarActiveState);
        el.addEventListener("focus", updateToolbarActiveState);
        el.addEventListener("blur", updateToolbarActiveState);
    });

    toolbar.addEventListener("mousedown", (e) => {
        e.preventDefault();
    });

    toolbar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-format]");
        if (!btn) return;
        if (window.__universityCommitPendingCarets) window.__universityCommitPendingCarets();
        applyLineFormat(btn.dataset.format);
        updateToolbarActiveState();
    });

    updateToolbarActiveState();
})();