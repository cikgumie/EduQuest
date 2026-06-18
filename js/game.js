/**
 * game.js
 * 
 * Main game driver. Handles rendering, typewriter effect, inputs, combat overlays,
 * and calls the ApiClient.
 */

// Typewriter speed constant
const TYPEWRITER_SPEED = 12; // ms per character
let typewriterTimer = null;
let currentTypewriterText = "";
let typewriterElement = null;
let isTypewriterRunning = false;

// SVGs for Inventory Items
const ITEM_SVGS = {
    potion_clarity: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px rgba(167, 139, 250, 0.6));"><path d="M12 2v4M12 18h.01M8.5 22h7c1 0 2-.9 2-2V9.5c0-1.1-.9-2-2-2h-7c-1 0-2 .9-2 2V20c0 1.1.9 2 2 2z"></path><path d="M7.5 12h9M9 7.5l3-3 3 3"></path></svg>`,
    shield_wisdom: `<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="#F43F5E" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 0 8px rgba(244, 63, 94, 0.6));"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><circle cx="12" cy="11" r="3"></circle><path d="M12 8v6M10 11h4"></path></svg>`
};

/**
 * Check if session is active. If not, redirect to landing portal.
 */
function checkSession() {
    if (!GameState.loadFromLocalStorage() || !GameState.sessionId) {
        window.location.href = "index.html";
        return false;
    }
    return true;
}

/**
 * Sync game state with the backend spreadsheet on page load
 */
async function syncGameState() {
    const board = document.querySelector('.game-layout');

    // Render initial cached UI to avoid flash of empty states
    renderUI();

    try {
        const data = await ApiClient.getPlayerState(GameState.sessionId);

        // Update state
        GameState.updateFromPlayerState(data.playerState);

        if (data.activeQuest) {
            GameState.activeQuest = data.activeQuest;
        }

        renderUI();
    } catch (err) {
        console.warn("Failed to sync with GAS backend. Operating on local cache.", err);
    }
}

/**
 * Typewriter effect for text display
 */
function runTypewriter(element, text, onComplete) {
    // If a typewriter is already running, cancel it
    stopTypewriter();

    // Ensure text is a string
    if (typeof text === 'object' && text !== null) {
        text = text.narrative || text.text || JSON.stringify(text);
    }
    text = String(text || "");

    typewriterElement = element;
    currentTypewriterText = text;
    isTypewriterRunning = true;
    element.innerHTML = "";

    let index = 0;

    // Create skip handler
    const skipHandler = () => {
        stopTypewriter();
        element.innerHTML = text.replace(/\n/g, '<br>');
        onComplete();
    };

    // Attach skip listener to the log segment or body
    element.closest('.log-segment').addEventListener('click', skipHandler, { once: true });

    typewriterTimer = setInterval(() => {
        if (index < text.length) {
            const char = text.charAt(index);
            if (char === '\n') {
                element.innerHTML += '<br>';
            } else {
                element.innerHTML += char;
            }
            index++;

            // Auto-scroll log container to bottom
            const logContainer = document.getElementById("story-log");
            logContainer.scrollTop = logContainer.scrollHeight;
        } else {
            stopTypewriter();
            element.closest('.log-segment').removeEventListener('click', skipHandler);
            onComplete();
        }
    }, TYPEWRITER_SPEED);
}

function stopTypewriter() {
    if (typewriterTimer) {
        clearInterval(typewriterTimer);
        typewriterTimer = null;
    }
    isTypewriterRunning = false;
}

/**
 * Render HUD Header values
 */
function renderHUD() {
    document.getElementById("hud-player-name").textContent = GameState.playerName;

    // Level Badge description
    let levelTitle = "Novice Explorer";
    if (GameState.level >= 50) levelTitle = "Legend";
    else if (GameState.level >= 20) levelTitle = "Master Thinker";
    else if (GameState.level >= 10) levelTitle = "Scholar";
    else if (GameState.level >= 5) levelTitle = "Knowledge Seeker";
    document.getElementById("hud-player-level").textContent = `${levelTitle} (Lv. ${GameState.level})`;

    // Location name (both desktop HUD and mobile badge)
    const locationName = GameState.currentLocation
        ? GameState.currentLocation.replace(/_/g, ' ').toUpperCase()
        : "DUNIA RPG";

    const hudLoc = document.getElementById("hud-location-name");
    if (hudLoc) hudLoc.textContent = locationName;

    const mobileLoc = document.getElementById("mobile-location-name");
    if (mobileLoc) mobileLoc.textContent = locationName;

    // Health Bar
    const hpPct = Math.max(0, Math.min(100, (GameState.hp / GameState.maxHp) * 100));
    document.getElementById("hud-hp-text").textContent = `${GameState.hp}/${GameState.maxHp}`;
    const hpFill = document.getElementById("hud-hp-fill");
    hpFill.style.width = `${hpPct}%`;

    // Critical HP warning
    if (hpPct < 30) {
        hpFill.style.background = 'var(--color-danger)';
        hpFill.classList.add('critical');
    } else {
        hpFill.style.background = 'linear-gradient(90deg, #EF4444, #F43F5E)';
        hpFill.classList.remove('critical');
    }

    // Experience Bar
    const calc = calculateLevelProgress(GameState.xp);
    const xpPct = Math.max(0, Math.min(100, (calc.currentXpInLevel / calc.xpNeededForLevel) * 100));
    document.getElementById("hud-xp-text").textContent = `${Math.floor(calc.currentXpInLevel)}/${calc.xpNeededForLevel} XP`;
    document.getElementById("hud-xp-fill").style.width = `${xpPct}%`;
}

/**
 * Level curve helper
 */
function calculateLevelProgress(xp) {
    let level = 1;
    let accumulatedXp = 0;

    while (true) {
        let neededForNext = 100 * level * (level + 1) / 2;
        if (xp >= neededForNext) {
            level++;
            accumulatedXp = neededForNext;
        } else {
            return {
                level: level,
                currentXpInLevel: xp - accumulatedXp,
                xpNeededForLevel: neededForNext - accumulatedXp
            };
        }
    }
}

/**
 * Render Quest tracker, items, and attributes in sidebar
 */
function renderSidebar() {
    // Active Quest Title
    const questTitle = document.getElementById("sidebar-quest-title");
    const questDesc = document.getElementById("sidebar-quest-desc");

    if (GameState.activeQuest) {
        questTitle.textContent = GameState.activeQuest.title || "Misi Utama";
        questDesc.textContent = GameState.activeQuest.description || "Terokai lokasi semasa anda.";
    } else {
        questTitle.textContent = "Terokai Dunia";
        questDesc.textContent = "Cakap dengan NPC untuk menerima tugasan.";
    }

    // Inventory Slots
    const grid = document.getElementById("inventory-grid");
    grid.innerHTML = "";

    const slotsCount = 4; // Render 4 slots
    const inventory = GameState.inventory || [];

    // Count items by ID
    const itemCountMap = {};
    inventory.forEach(item => {
        const id = typeof item === 'object' ? item.id : item;
        itemCountMap[id] = (itemCountMap[id] || 0) + 1;
    });

    const uniqueItemIds = Object.keys(itemCountMap);

    for (let i = 0; i < slotsCount; i++) {
        const slotDiv = document.createElement("div");

        if (i < uniqueItemIds.length) {
            const itemId = uniqueItemIds[i];
            const qty = itemCountMap[itemId];
            const name = itemId.replace(/_/g, ' ').toUpperCase();

            let description = "Barangan sokongan pembelajaran.";
            if (itemId === "potion_clarity") {
                description = "Potion of Clarity: Memberikan analogi mudah (klu) atau membuang separuh pilihan salah.";
            } else if (itemId === "shield_wisdom") {
                description = "Shield of Wisdom: Menahan pemotongan HP/XP jika jawapan salah.";
            }

            slotDiv.className = "inventory-slot";
            slotDiv.innerHTML = `
                ${ITEM_SVGS[itemId] || ''}
                ${qty > 1 ? `<span class="item-count">${qty}</span>` : ''}
                <div class="item-tooltip">
                    <div class="tooltip-title">${name}</div>
                    <div class="tooltip-desc">${description}</div>
                    <div style="margin-top: 8px; color: var(--color-cta); font-weight: bold; font-size: 10px;">KLIK UNTUK GUNA</div>
                </div>
            `;

            // Click to use
            slotDiv.addEventListener("click", () => handleUseItem(itemId));
        } else {
            slotDiv.className = "inventory-slot empty";
            slotDiv.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>`;
        }

        grid.appendChild(slotDiv);
    }

    // Stats
    document.getElementById("stat-knowledge").textContent = GameState.skills.knowledge || 1;
    document.getElementById("stat-logic").textContent = GameState.skills.logic || 1;
    document.getElementById("stat-creativity").textContent = GameState.skills.creativity || 1;
    document.getElementById("stat-communication").textContent = GameState.skills.communication || 1;
    document.getElementById("stat-problemSolving").textContent = GameState.skills.problemSolving || 1;
}

/**
 * Render Story history logs
 */
function renderStoryLog() {
    const log = document.getElementById("story-log");
    log.innerHTML = "";

    const history = GameState.storyHistory || [];

    history.forEach((segment, index) => {
        if (!segment) return;

        // Ensure segment.text is a string
        let segmentText = segment.text;
        if (typeof segmentText === 'object' && segmentText !== null) {
            segmentText = segmentText.narrative || segmentText.text || JSON.stringify(segmentText);
        }
        segmentText = String(segmentText || "");

        const isLast = (index === history.length - 1);
        const segmentDiv = document.createElement("div");

        if (segment.type === "story") {
            segmentDiv.className = "log-segment story";
            segmentDiv.innerHTML = `
                <div class="segment-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                    ${segment.npc ? segment.npc : 'Pengembaraan'}
                </div>
                <div class="segment-body"></div>
            `;
            log.appendChild(segmentDiv);

            const bodyEl = segmentDiv.querySelector(".segment-body");
            if (isLast && isTypewriterRunning) {
                // If typewriter needs to run
                runTypewriter(bodyEl, segmentText, () => {
                    renderInteractionPanel();
                });
            } else {
                bodyEl.innerHTML = segmentText.replace(/\n/g, '<br>');
            }
        }

        else if (segment.type === "question") {
            segmentDiv.className = "log-segment question";
            segmentDiv.innerHTML = `
                <div class="segment-header" style="color: var(--color-warning);">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
                    Cabaran Pembelajaran (${segment.qType ? segment.qType.toUpperCase() : 'Recall'})
                </div>
                <div class="segment-body">${segmentText.replace(/\n/g, '<br>')}</div>
            `;
            log.appendChild(segmentDiv);
        }

        else if (segment.type === "feedback") {
            const isCorrect = segment.correct;
            segmentDiv.className = `log-segment feedback ${isCorrect ? '' : 'incorrect'}`;
            segmentDiv.innerHTML = `
                <div class="segment-header" style="color: ${isCorrect ? 'var(--color-success)' : 'var(--color-danger)'};">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${isCorrect
                    ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>'
                    : '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>'
                }
                    </svg>
                    EVALUASI AI - ${isCorrect ? 'TAHNIAH, JAWAPAN BETUL!' : 'JAWAPAN SILAP'}
                </div>
                <div class="segment-body" style="font-weight: 500;">${segmentText.replace(/\n/g, '<br>')}</div>
                <div style="font-family: var(--font-mono); font-size: 11px; margin-top: 8px; color: var(--color-text-muted);">
                    XP Gained: <span style="color: var(--color-success)">+${segment.xpGained} XP</span> 
                    ${segment.hpChange !== 0 ? `| HP Change: <span style="color: var(--color-danger)">${segment.hpChange} HP</span>` : ''}
                </div>
            `;
            log.appendChild(segmentDiv);
        }
    });

    // Scroll to bottom
    log.scrollTop = log.scrollHeight;
}

/**
 * Render choices or question inputs
 */
function renderInteractionPanel() {
    const normalPanel = document.getElementById("interaction-panel");
    const combatOverlay = document.getElementById("combat-overlay");
    const combatPanel = document.getElementById("combat-interaction");

    // Determine target panel
    const targetPanel = GameState.inCombat ? combatPanel : normalPanel;
    targetPanel.innerHTML = "";

    // Toggle Combat Overlay visibility
    if (GameState.inCombat) {
        combatOverlay.classList.add("active");
        document.getElementById("boss-hp-fill").style.width = `${GameState.bossHp}%`;
        document.getElementById("boss-hp-text").textContent = `${GameState.bossHp}/${GameState.bossMaxHp} HP`;
    } else {
        combatOverlay.classList.remove("active");
    }

    // Don't render inputs while typewriter is running
    if (isTypewriterRunning) {
        targetPanel.innerHTML = `
            <div style="text-align: center; color: var(--color-text-muted); font-family: var(--font-mono); font-size: 13px;">
                NPC sedang bercakap... Klik kotak teks di atas untuk skip.
            </div>
        `;
        return;
    }

    // Scenario 1: Active Question (Requires Answer Submit)
    if (GameState.activeQuestion) {
        const q = GameState.activeQuestion;

        // Parse options (could be JSON string, array, or object)
        let optionsList = null;
        if (q.options) {
            try {
                optionsList = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
            } catch (e) {
                console.error("Failed to parse options:", q.options);
            }
        }

        const questionContainer = document.createElement("div");
        questionContainer.className = "question-input-panel";

        // Scenario 1a: MCQ Options
        if (optionsList && (Array.isArray(optionsList) || typeof optionsList === 'object')) {
            const list = Array.isArray(optionsList) ? optionsList : Object.values(optionsList);
            const containerDiv = document.createElement("div");
            containerDiv.className = "choices-container multi-col";

            list.forEach((opt, idx) => {
                const optBtn = document.createElement("button");
                optBtn.className = "choice-btn";
                optBtn.innerHTML = `
                    <span class="choice-num">${String.fromCharCode(65 + idx)}</span>
                    <span style="flex: 1;">${opt}</span>
                `;
                optBtn.addEventListener("click", () => handleAnswerSubmit(opt, optBtn));
                containerDiv.appendChild(optBtn);
            });
            questionContainer.appendChild(containerDiv);
        }
        // Scenario 1b: Open-Ended / Fill-in-the-blank Textarea
        else {
            questionContainer.innerHTML = `
                <div class="form-group" style="margin-bottom: 12px;">
                    <textarea id="open-ended-answer" class="form-input" placeholder="Tulis jawapan anda berdasarkan pemahaman anda..." style="min-height: 80px;"></textarea>
                </div>
                <button class="btn btn-cta" id="btn-submit-answer" style="align-self: flex-end;">
                    Hantar Jawapan
                </button>
            `;

            const submitBtn = questionContainer.querySelector("#btn-submit-answer");
            submitBtn.addEventListener("click", () => {
                const val = document.getElementById("open-ended-answer").value.trim();
                if (!val) {
                    alert("Sila taip jawapan sebelum menghantar.");
                    return;
                }
                handleAnswerSubmit(val, submitBtn);
            });
        }
        targetPanel.appendChild(questionContainer);
    }

    // Scenario 2: Normal Choice Dialog
    else if (GameState.currentChoices && GameState.currentChoices.length > 0) {
        const containerDiv = document.createElement("div");
        containerDiv.className = "choices-container";

        GameState.currentChoices.forEach((ch, idx) => {
            const chBtn = document.createElement("button");
            chBtn.className = "choice-btn";
            chBtn.innerHTML = `
                <span class="choice-num">${idx + 1}</span>
                <span style="flex: 1;">${ch.text || ch}</span>
            `;

            const choiceId = ch.id || ch.choiceId || idx;
            chBtn.addEventListener("click", () => handleChoiceSelect(choiceId, chBtn));
            containerDiv.appendChild(chBtn);
        });

        targetPanel.appendChild(containerDiv);
    }

    // Scenario 3: Story Continue (Static transition)
    else {
        targetPanel.innerHTML = `
            <button class="btn btn-primary" id="btn-continue-adventure" style="width: 100%;">
                Teruskan Kembara
            </button>
        `;

        document.getElementById("btn-continue-adventure").addEventListener("click", () => {
            handleChoiceSelect("continue", document.getElementById("btn-continue-adventure"));
        });
    }
}

/**
 * Handle player selecting a dialogue choice
 */
async function handleChoiceSelect(choiceId, buttonElement) {
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.style.opacity = 0.7;
    }

    try {
        const response = await ApiClient.processChoice(GameState.sessionId, choiceId);

        // Update state
        GameState.updateFromPlayerState(response.playerState);

        // Add new segment
        if (response.story) {
            GameState.addStorySegment(
                response.story.narrative || response.story.text || response.story,
                response.choices || [],
                response.story.npc || null
            );
        }

        // Setup next question if it exists
        if (response.question) {
            GameState.setQuestion(response.question);
        }

        // Handle Level up
        if (response.levelUp && response.levelUp.leveledUp) {
            triggerLevelUpModal(response.levelUp);
        }

        renderUI();
    } catch (err) {
        alert(`Gagal memproses pilihan: ${err.message}`);
        if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.style.opacity = 1;
        }
    }
}

/**
 * Handle submitting answer for quiz evaluation
 */
async function handleAnswerSubmit(answerText, buttonElement) {
    if (buttonElement) {
        buttonElement.disabled = true;
        buttonElement.style.opacity = 0.7;
    }

    // Show loading spinner / state
    const originalText = buttonElement.innerHTML;
    buttonElement.innerHTML = "Menilai jawapan...";

    try {
        const q = GameState.activeQuestion;

        // Submit
        const response = await ApiClient.submitAnswer(
            GameState.sessionId,
            q.questionId,
            answerText,
            {
                questionText: q.question,
                options: JSON.stringify(q.options),
                correctAnswer: q.correctAnswer,
                explanation: q.explanation
            }
        );

        // Update player stats
        GameState.updateFromPlayerState(response.playerState);

        // Add feedback log
        GameState.addFeedbackSegment(
            response.feedback,
            response.result === "correct",
            response.xpGained,
            response.hpChange
        );

        // Handle Level up
        if (response.levelUp && response.levelUp.leveledUp) {
            triggerLevelUpModal(response.levelUp);
        }

        // Screen shake if took damage
        if (response.hpChange < 0) {
            triggerScreenShake();
        }

        // Check if player died
        if (response.isDead || GameState.hp <= 0) {
            triggerDeathModal();
        }

        renderUI();
    } catch (err) {
        alert(`Ralat memproses jawapan: ${err.message}`);
        buttonElement.disabled = false;
        buttonElement.innerHTML = originalText;
        buttonElement.style.opacity = 1;
    }
}

/**
 * Handle using help items from inventory
 */
async function handleUseItem(itemId) {
    if (GameState.hp <= 0) {
        alert("Anda telah tewas! Sila revive terlebih dahulu.");
        return;
    }

    try {
        const response = await ApiClient.useItem(GameState.sessionId, itemId);

        // Show success
        alert(`✅ Barangan Berjaya Digunakan!\n\nKesan: ${response.effect.message || "HP Dipulihkan!"}`);

        // Update stats
        GameState.updateFromPlayerState(response.playerState);

        // Add healing effect locally or log segment
        if (response.effect.type === "heal") {
            GameState.storyHistory.push({
                type: "story",
                text: `✨ Menggunakan ${itemId.replace(/_/g, ' ').toUpperCase()}. Memulihkan ${response.effect.amount} HP!`,
                npc: "Sistem Bantuan"
            });
        }

        renderUI();
    } catch (err) {
        alert(`Gagal menggunakan barangan: ${err.message}`);
    }
}

/**
 * Save game manual trigger
 */
async function handleSaveGame() {
    try {
        const response = await ApiClient.saveGame(GameState.sessionId);
        alert(`💾 Sesi berjaya disimpan ke Google Sheets pada ${new Date(response.timestamp).toLocaleTimeString()}`);
    } catch (err) {
        alert(`Gagal menyimpan sesi: ${err.message}`);
    }
}

/**
 * Handle reviving a dead player
 */
async function handleRevive() {
    try {
        const response = await ApiClient.revive(GameState.sessionId);

        // Close modal
        document.getElementById("death-modal").classList.remove("active");

        // Update local HP
        GameState.updateFromPlayerState(response.playerState);

        // Add revive log
        GameState.storyHistory.push({
            type: "story",
            text: "🛡️ Anda telah dibangkitkan semula oleh Professor Byte di kampung terdekat. Bersedia untuk mencuba lagi!",
            npc: "Sistem Bantuan"
        });

        renderUI();
    } catch (err) {
        alert(`Ralat kebangkitan: ${err.message}`);
    }
}

/**
 * Damage vibration shake animation
 */
function triggerScreenShake() {
    const layout = document.querySelector(".game-layout");
    layout.classList.add("shake");
    setTimeout(() => {
        layout.classList.remove("shake");
    }, 400);
}

/**
 * Level Up celebration modal popup
 */
function triggerLevelUpModal(levelUpInfo) {
    document.getElementById("levelup-title").textContent = `TAHAP BARU: LEVEL ${levelUpInfo.newLevel}`;
    document.getElementById("levelup-desc").textContent = `Anda bertambah hebat! Max HP meningkat sebanyak +${levelUpInfo.maxHpIncreased || 10} dan HP dipulihkan.`;
    document.getElementById("levelup-modal").classList.add("active");
}

function closeLevelUpModal() {
    document.getElementById("levelup-modal").classList.remove("active");
}

/**
 * Defeated death modal popup
 */
function triggerDeathModal() {
    document.getElementById("death-modal").classList.add("active");
}

/**
 * Main Render caller
 */
function renderUI() {
    renderHUD();
    renderSidebar();
    renderStoryLog();
    renderInteractionPanel();
}

// Global start
window.addEventListener("DOMContentLoaded", () => {
    if (checkSession()) {
        syncGameState();
    }
});
