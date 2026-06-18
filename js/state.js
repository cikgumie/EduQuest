/**
 * state.js
 * 
 * Manages player local state and persistence via LocalStorage.
 */

const GameState = {
    sessionId: null,
    playerName: "",
    level: 1,
    xp: 0,
    xpToNextLevel: 100,
    hp: 100,
    maxHp: 100,
    currentWorld: "",
    currentLocation: "",
    currentNPC: null,
    activeQuest: null,
    completedQuests: [],
    inventory: [],
    skills: {
        knowledge: 1,
        logic: 1,
        creativity: 1,
        communication: 1,
        problemSolving: 1
    },
    storyHistory: [],
    currentChoices: [],
    activeQuestion: null,
    inCombat: false,
    bossHp: 100,
    bossMaxHp: 100,
    combatPhase: 1,
    currentStreak: 0,
    lastSaved: null,

    /**
     * Initialize state with data from backend
     */
    init(data) {
        this.sessionId = data.sessionId || this.sessionId;
        this.updateFromPlayerState(data.playerState);
        
        if (data.story) {
            const storyText = typeof data.story === 'object' 
                ? (data.story.narrative || data.story.text || "") 
                : String(data.story);
            
            this.storyHistory = [{
                type: "story",
                text: storyText,
                npc: data.story.npc || null
            }];
            this.currentChoices = data.story.choices || data.choices || [];
        }
        
        if (data.quests) {
            this.activeQuest = data.quests.active || null;
        }

        this.saveToLocalStorage();
    },

    /**
     * Update state properties from backend playerState object
     */
    updateFromPlayerState(state) {
        if (!state) return;
        this.playerName = state.playerName || this.playerName;
        this.level = state.level !== undefined ? state.level : this.level;
        this.xp = state.xp !== undefined ? state.xp : this.xp;
        this.xpToNextLevel = state.xpToNextLevel !== undefined ? state.xpToNextLevel : this.xpToNextLevel;
        this.hp = state.hp !== undefined ? state.hp : this.hp;
        this.maxHp = state.maxHp !== undefined ? state.maxHp : this.maxHp;
        this.currentLocation = state.currentLocation || this.currentLocation;
        this.currentWorld = state.currentWorld || this.currentWorld;
        this.completedQuests = state.completedQuests || this.completedQuests;
        this.inventory = state.inventory || this.inventory;
        this.skills = state.skills || this.skills;
        this.currentStreak = state.streak !== undefined ? state.streak : this.currentStreak;
        
        // Handle combat variables if present
        if (state.inCombat !== undefined) {
            this.inCombat = state.inCombat;
            this.bossHp = state.bossHp || this.bossHp;
            this.bossMaxHp = state.bossMaxHp || this.bossMaxHp;
            this.combatPhase = state.combatPhase || this.combatPhase;
        }
        
        this.lastSaved = new Date().toISOString();
        this.saveToLocalStorage();
    },

    /**
     * Add a story segment to history
     */
    addStorySegment(text, choices = [], npc = null) {
        const storyText = typeof text === 'object' && text !== null
            ? (text.narrative || text.text || "")
            : String(text || "");

        this.storyHistory.push({
            type: "story",
            text: storyText,
            npc: npc
        });
        this.currentChoices = choices;
        this.saveToLocalStorage();
    },

    /**
     * Add a question segment to history
     */
    setQuestion(question) {
        this.activeQuestion = question;
        if (question) {
            this.storyHistory.push({
                type: "question",
                text: String(question.question || ""),
                id: question.questionId,
                options: question.options,
                qType: question.type
            });
        }
        this.saveToLocalStorage();
    },

    /**
     * Add response feedback to history
     */
    addFeedbackSegment(feedback, correct, xpGained, hpChange) {
        this.storyHistory.push({
            type: "feedback",
            text: String(feedback || ""),
            correct: correct,
            xpGained: xpGained,
            hpChange: hpChange
        });
        this.activeQuestion = null;
        this.saveToLocalStorage();
    },

    /**
     * Save current state to LocalStorage
     */
    saveToLocalStorage() {
        try {
            const stateJson = JSON.stringify({
                sessionId: this.sessionId,
                playerName: this.playerName,
                level: this.level,
                xp: this.xp,
                xpToNextLevel: this.xpToNextLevel,
                hp: this.hp,
                maxHp: this.maxHp,
                currentWorld: this.currentWorld,
                currentLocation: this.currentLocation,
                completedQuests: this.completedQuests,
                inventory: this.inventory,
                skills: this.skills,
                storyHistory: this.storyHistory,
                currentChoices: this.currentChoices,
                activeQuestion: this.activeQuestion,
                inCombat: this.inCombat,
                bossHp: this.bossHp,
                bossMaxHp: this.bossMaxHp,
                combatPhase: this.combatPhase,
                currentStreak: this.currentStreak,
                lastSaved: this.lastSaved
            });
            localStorage.setItem("ai_rpg_game_state", stateJson);
        } catch (e) {
            console.error("Failed to save state to localStorage:", e);
        }
    },

    /**
     * Load state from LocalStorage
     */
    loadFromLocalStorage() {
        try {
            const stateJson = localStorage.getItem("ai_rpg_game_state");
            if (!stateJson) return false;
            
            const savedState = JSON.parse(stateJson);
            Object.assign(this, savedState);
            
            // Sanitize storyHistory to prevent object-typed text crashes on load
            if (Array.isArray(this.storyHistory)) {
                this.storyHistory = this.storyHistory.map(segment => {
                    if (segment && typeof segment === 'object') {
                        let text = segment.text;
                        if (typeof text === 'object' && text !== null) {
                            text = text.narrative || text.text || JSON.stringify(text);
                        }
                        segment.text = String(text || "");
                    }
                    return segment;
                });
            }
            
            return true;
        } catch (e) {
            console.error("Failed to load state from localStorage:", e);
            return false;
        }
    },

    /**
     * Clear local game state (Reset)
     */
    clear() {
        this.sessionId = null;
        this.playerName = "";
        this.level = 1;
        this.xp = 0;
        this.xpToNextLevel = 100;
        this.hp = 100;
        this.maxHp = 100;
        this.currentWorld = "";
        this.currentLocation = "";
        this.currentNPC = null;
        this.activeQuest = null;
        this.completedQuests = [];
        this.inventory = [];
        this.skills = {
            knowledge: 1,
            logic: 1,
            creativity: 1,
            communication: 1,
            problemSolving: 1
        };
        this.storyHistory = [];
        this.currentChoices = [];
        this.activeQuestion = null;
        this.inCombat = false;
        this.bossHp = 100;
        this.bossMaxHp = 100;
        this.combatPhase = 1;
        this.currentStreak = 0;
        this.lastSaved = null;
        
        localStorage.removeItem("ai_rpg_game_state");
    }
};
