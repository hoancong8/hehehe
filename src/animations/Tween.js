/**
 * Tween.js — Minimal zero-dependency animation utility
 * Replaces GSAP for simple property animations
 */

// ── Easing functions ─────────────────────────────────────────────────────────

export const Easing = {
    linear:     t => t,
    power2In:   t => t * t,
    power2Out:  t => 1 - (1 - t) * (1 - t),
    power2InOut:t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    power3Out:  t => 1 - Math.pow(1 - t, 3),
    power3InOut:t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    power4Out:  t => 1 - Math.pow(1 - t, 4),
    sineOut:    t => Math.sin((t * Math.PI) / 2),
    sineInOut:  t => -(Math.cos(Math.PI * t) - 1) / 2,
    elasticOut: t => {
        if (t === 0 || t === 1) return t;
        const c4 = (2 * Math.PI) / 3;
        return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    backOut: t => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
};

// ── Active tweens registry ───────────────────────────────────────────────────

const activeTweens = new Set();
let rafId = null;

function tick(timestamp) {
    const done = [];
    for (const tw of activeTweens) {
        tw._update(timestamp);
        if (tw._done) done.push(tw);
    }
    done.forEach(tw => activeTweens.delete(tw));
    if (activeTweens.size > 0) {
        rafId = requestAnimationFrame(tick);
    } else {
        rafId = null;
    }
}

function schedule() {
    if (!rafId) rafId = requestAnimationFrame(tick);
}

// ── TweenInstance ────────────────────────────────────────────────────────────

class TweenInstance {
    constructor(target, toProps, options = {}) {
        this._target   = target;
        this._toProps  = toProps;
        this._duration = (options.duration ?? 1) * 1000; // ms
        this._ease     = typeof options.ease === 'function'
            ? options.ease
            : (Easing[options.ease] ?? Easing.power3Out);
        this._onUpdate   = options.onUpdate ?? null;
        this._onComplete = options.onComplete ?? null;
        this._startTime  = null;
        this._fromProps  = null;
        this._done       = false;
        this._resolve    = null;

        this._promise = new Promise(res => { this._resolve = res; });
    }

    start() {
        // Capture start values on first frame
        this._fromProps = {};
        for (const key in this._toProps) {
            this._fromProps[key] = this._target[key];
        }
        this._startTime = null; // set on first _update
        activeTweens.add(this);
        schedule();
        return this;
    }

    _update(timestamp) {
        if (this._startTime === null) this._startTime = timestamp;
        const elapsed = timestamp - this._startTime;
        const t = Math.min(elapsed / this._duration, 1);
        const e = this._ease(t);

        for (const key in this._toProps) {
            this._target[key] = this._fromProps[key] + (this._toProps[key] - this._fromProps[key]) * e;
        }

        this._onUpdate?.(t, e);

        if (t >= 1) {
            this._done = true;
            this._onComplete?.();
            this._resolve?.();
        }
    }

    /** Kill this tween immediately */
    kill() {
        this._done = true;
        activeTweens.delete(this);
    }

    then(fn) { return this._promise.then(fn); }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Tween properties of `target` object to `toProps`.
 *
 * @param {Object} target      - The object whose properties to animate
 * @param {Object} toProps     - Target property values
 * @param {Object} [options]   - { duration (s), ease, onUpdate, onComplete }
 * @returns {TweenInstance}    - Returns thenable TweenInstance
 *
 * @example
 *   await Tween.to(camera.position, { z: 250 }, { duration: 2.5, ease: 'power3Out' });
 */
export const Tween = {
    to(target, toProps, options = {}) {
        return new TweenInstance(target, toProps, options).start();
    },

    /**
     * Kill all tweens targeting a specific object
     */
    killTweensOf(target) {
        for (const tw of activeTweens) {
            if (tw._target === target) tw.kill();
        }
    },
};
