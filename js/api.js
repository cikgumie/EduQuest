/**
 * api.js
 * 
 * API client to communicate with the Google Apps Script backend.
 * Bypasses CORS preflight issues by sending POST bodies as plain text.
 */

const GAS_API_URL = "https://script.google.com/macros/s/AKfycbwjV4jz6cRo6Lw8SQLGFueaYHg2GR7dX7Kq6hptCM1GXCpwkFjtjzT6O70pMQy20AAPjw/exec";

const ApiClient = {
    /**
     * Internal request wrapper
     */
    async request(action, method = "POST", data = {}) {
        let url = `${GAS_API_URL}?action=${action}`;
        
        const options = {
            method: method,
            mode: "cors"
        };

        if (method === "POST") {
            // Crucial: Use text/plain to avoid CORS preflight pre-checks (OPTIONS)
            // Google Apps Script doesn't support OPTIONS requests properly.
            options.body = JSON.stringify(data);
            options.headers = {
                "Content-Type": "text/plain;charset=utf-8"
            };
        } else if (method === "GET") {
            const params = new URLSearchParams(data);
            url = `${url}&${params.toString()}`;
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} - ${response.statusText}`);
            }
            const json = await response.json();
            if (!json.success) {
                throw new Error(json.error || "Backend returned an unsuccessful response");
            }
            return json.data;
        } catch (error) {
            console.error(`API Call failed [${action}]:`, error);
            throw error;
        }
    },

    /**
     * Health check
     */
    ping() {
        return this.request("ping", "GET");
    },

    /**
     * Get list of educational topics
     */
    getTopics() {
        return this.request("getTopics", "GET");
    },

    /**
     * Initialize a new game topic (Teacher action)
     */
    initTopic(topicData) {
        // topicData: { title, subject, form, notes, theme, difficulty }
        return this.request("initTopic", "POST", topicData);
    },

    /**
     * Initialize a new game session
     */
    initGame(playerData) {
        // playerData: { playerName, topicId, classId, difficulty }
        return this.request("initGame", "POST", playerData);
    },

    /**
     * Send player choice to advance story
     */
    processChoice(sessionId, choiceId) {
        return this.request("processChoice", "POST", { sessionId, choiceId });
    },

    /**
     * Submit answer for AI evaluation
     */
    submitAnswer(sessionId, questionId, answer, extraData = {}) {
        return this.request("answerQuestion", "POST", {
            sessionId,
            questionId,
            answer,
            ...extraData // optional fields like questionText, options, etc. if fallback needed
        });
    },

    /**
     * Use assistance item from inventory
     */
    useItem(sessionId, itemId) {
        return this.request("useItem", "POST", { sessionId, itemId });
    },

    /**
     * Fetch current player state (for resuming)
     */
    getPlayerState(sessionId) {
        return this.request("getPlayerState", "GET", { sessionId });
    },

    /**
     * Explicitly save game progress to Sheets
     */
    saveGame(sessionId) {
        return this.request("saveGame", "POST", { sessionId });
    },

    /**
     * Revive player on defeat
     */
    revive(sessionId) {
        return this.request("revive", "POST", { sessionId });
    }
};
