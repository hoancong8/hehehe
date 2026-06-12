/**
 * Button.js — Multi-state cycle button with ripple animation
 *
 * FEAT: Now supports N-state cycling (not just 2-state toggle).
 * Pass an array of label strings to cycle through them on each click.
 */
export class Button {
    /**
     * @param {string}   id            - DOM element ID
     * @param {string[]} labels        - Array of button labels (one per state)
     * @param {Function} onStateChange - Callback(stateIndex: number) on each click
     */
    constructor(id, labels, onStateChange) {
        this._btn     = document.getElementById(id);
        this._textEl  = document.getElementById('btn-text');
        this._ripple  = document.getElementById('btn-ripple');

        this._labels        = Array.isArray(labels) ? labels : [labels];
        this._onStateChange = onStateChange;
        this._state         = 0;
        this._enabled       = false;

        if (!this._btn) {
            console.warn(`Button: element #${id} not found`);
            return;
        }

        this._handleClick = this._handleClick.bind(this);
        this._btn.addEventListener('click', this._handleClick);

        // Set initial label
        this._updateLabel();
    }

    /** Make the button interactive and fade it in */
    enable() {
        this._enabled = true;
        this._btn?.classList.add('ready');
    }

    /** Disable all interaction */
    disable() {
        this._enabled = false;
        this._btn?.classList.remove('ready');
    }

    /** Current state index (0-based) */
    get state() { return this._state; }

    _handleClick() {
        if (!this._enabled) return;

        // Advance to next state (wraps around)
        this._state = (this._state + 1) % this._labels.length;
        this._updateLabel();
        this._triggerRipple();
        this._onStateChange(this._state);
    }

    _updateLabel() {
        if (this._textEl) {
            this._textEl.textContent = this._labels[this._state];
        }
    }

    _triggerRipple() {
        if (!this._ripple) return;
        this._ripple.classList.remove('active');
        void this._ripple.offsetWidth; // Force reflow to restart animation
        this._ripple.classList.add('active');
    }

    dispose() {
        this._btn?.removeEventListener('click', this._handleClick);
    }
}
