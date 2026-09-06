(() => {
    const homeView = document.getElementById("home-view");
    if (!homeView) return;

    homeView.style.display = "flex";

    setupCardEffects();
    setupPageTransition();
    setupClickWaterRipples();
})();

const croakAudio = new Audio("audio/frog.mp3");
croakAudio.preload = "auto";
croakAudio.volume = 0.6;
croakAudio.load();

function setupPageTransition() {
    const NAV_DELAY_MS = 550;

    const cards = Array.from(document.querySelectorAll(".home-card[data-page]"));
    if (!cards.length) return;

    const grid = document.querySelector(".home-grid");

    const overlay = document.createElement("div");
    overlay.className = "page-transition";
    document.body.appendChild(overlay);

    let isTransitioning = false;

    cards.forEach((card) => {
        card.addEventListener("click", (event) => {
            const page = card.dataset.page;
            if (!page) return;
            if (isTransitioning) return;
            isTransitioning = true;

            playCroak();
            spawnRipple(card, event.clientX, event.clientY);

            card.classList.add("is-transitioning-target");
            cards.forEach((other) => {
                if (other !== card) other.classList.add("is-transitioning-other");
            });
            if (grid) grid.classList.add("is-locked");

            overlay.classList.add("is-active");

            window.setTimeout(() => {
                window.location.href = page;
            }, NAV_DELAY_MS);
        });
    });
}

function setupCardEffects() {
    const cards = document.querySelectorAll(".home-card");
    if (!cards.length) return;

    const MAX_TILT_DEG = 7;
    const MAX_MAGNET_PX = 6;

    const finePointerQuery = window.matchMedia("(hover: hover) and (pointer: fine)");

    const canAnimate = () => finePointerQuery.matches;

    const setVars = (card, vars) => {
        Object.entries(vars).forEach(([prop, value]) => {
            card.style.setProperty(prop, value);
        });
    };

    const resetCard = (card) => {
        card.classList.remove("is-tilting");
        setVars(card, {
            "--rx": "0deg",
            "--ry": "0deg",
            "--glow-opacity": "0",
            "--magnet-x": "0px",
            "--magnet-y": "0px",
        });
    };

    cards.forEach((card) => {
        let rafId = null;

        setVars(card, {
            "--rx": "0deg",
            "--ry": "0deg",
            "--glow-x": "50%",
            "--glow-y": "50%",
            "--glow-opacity": "0",
            "--magnet-x": "0px",
            "--magnet-y": "0px",
        });

        card.addEventListener("pointerenter", (event) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
            if (!canAnimate()) return;
            card.classList.add("is-tilting");
            card.style.setProperty("--glow-opacity", "1");
        });

        card.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
            if (!canAnimate()) return;

            const clientX = event.clientX;
            const clientY = event.clientY;

            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                const rect = card.getBoundingClientRect();
                const x = clientX - rect.left;
                const y = clientY - rect.top;

                const percentX = (x / rect.width) * 2 - 1; // -1 .. 1
                const percentY = (y / rect.height) * 2 - 1; // -1 .. 1

                const rotateY = percentX * MAX_TILT_DEG;
                const rotateX = -percentY * MAX_TILT_DEG;

                const magnetX = percentX * MAX_MAGNET_PX;
                const magnetY = percentY * MAX_MAGNET_PX;

                setVars(card, {
                    "--rx": `${rotateX.toFixed(2)}deg`,
                    "--ry": `${rotateY.toFixed(2)}deg`,
                    "--glow-x": `${x.toFixed(1)}px`,
                    "--glow-y": `${y.toFixed(1)}px`,
                    "--magnet-x": `${magnetX.toFixed(2)}px`,
                    "--magnet-y": `${magnetY.toFixed(2)}px`,
                });
            });
        });

        card.addEventListener("pointerleave", (event) => {
            if (event.pointerType !== "mouse" && event.pointerType !== "pen") return;
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
            resetCard(card);
        });
    });

    const handleCapabilityChange = () => {
        if (!canAnimate()) {
            cards.forEach(resetCard);
        }
    };

    finePointerQuery.addEventListener("change", handleCapabilityChange);
}

function setupClickWaterRipples() {
    const container = document.querySelector(".swamp-water-ripples");
    if (!container) return;

    const spawnClickBubble = (clientX, clientY) => {
        const rect = container.getBoundingClientRect();
        const leftPercent = ((clientX - rect.left) / rect.width) * 100;
        const topPercent = ((clientY - rect.top) / rect.height) * 100;

        const bubble = document.createElement("span");
        bubble.className = "water-ripple water-ripple-click";

        const duration = 3.5 + Math.random() * 1.5;
        const maxSize = 90 + Math.random() * 90;

        bubble.style.left = `${leftPercent.toFixed(1)}%`;
        bubble.style.top = `${topPercent.toFixed(1)}%`;
        bubble.style.animationDuration = `${duration.toFixed(2)}s`;
        bubble.style.setProperty("--ripple-max-size", `${maxSize.toFixed(0)}px`);

        container.appendChild(bubble);
        bubble.addEventListener("animationend", () => bubble.remove());
    };

    document.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        if (event.target.closest(".home-card")) return;

        spawnClickBubble(event.clientX, event.clientY);
    });
}

function playCroak() {
    try {
        croakAudio.currentTime = 0;
        croakAudio.play().catch(() => {

        });
    } catch (e) {

    }
}

function spawnRipple(card, clientX, clientY) {
    const rect = card.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const size = Math.max(rect.width, rect.height) * 1.4;

    const ripple = document.createElement("div");
    ripple.className = "ripple";
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;

    card.appendChild(ripple);
    ripple.addEventListener("animationend", () => ripple.remove());
}