/**
 * LoadingScreen.js — Controls the loading overlay UI
 */
export class LoadingScreen {
    constructor() {
        this._screen = document.getElementById('loading-screen');
        this._bar    = document.getElementById('loading-bar');
        this._text   = document.getElementById('loading-text');
        this._hidden = false;
    }

    /**
     * Update progress bar and status text.
     * @param {number} pct       - Progress percentage 0–100
     * @param {string} [message] - Status message to display
     */
    setProgress(pct, message) {
        if (this._hidden) return;
        if (this._bar) {
            this._bar.style.width = `${Math.min(Math.max(pct, 0), 100)}%`;
        }
        if (this._text && message !== undefined) {
            this._text.textContent = message;
        }
    }

    /**
     * Fade out and remove loading screen.
     * @returns {Promise<void>} Resolves after transition completes
     */
    hide() {
        if (this._hidden || !this._screen) return Promise.resolve();
        this._hidden = true;
        return new Promise(resolve => {
            // Ensure bar reaches 100% visually
            this.setProgress(100);
            setTimeout(() => {
                this._screen.style.opacity = '0';
                this._screen.addEventListener('transitionend', () => {
                    this._screen.style.display = 'none';
                    this._screen.setAttribute('aria-hidden', 'true');
                    resolve();
                }, { once: true });
            }, 300);
        });
    }
}
