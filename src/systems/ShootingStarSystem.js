/**
 * ShootingStarSystem.js — Shooting star streaks across the background
 *
 * Uses a pool of Line objects recycled after each star completes.
 * Stars spawn randomly every 1.5–5 seconds, streak diagonally, then fade out.
 * Color matches the pink/purple theme of the particle system.
 */

import * as THREE from 'three';

const POOL_SIZE    = 7;
const MIN_INTERVAL = 1500;  // ms
const MAX_INTERVAL = 4500;  // ms

export class ShootingStarSystem {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this._scene     = scene;
        this._pool      = [];
        this._nextSpawn = 0;

        this._buildPool();
    }

    // ── Pool ─────────────────────────────────────────────────────────────────

    _buildPool() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const geo = new THREE.BufferGeometry();
            geo.setAttribute(
                'position',
                new THREE.BufferAttribute(new Float32Array(6), 3) // 2 points
            );

            const mat = new THREE.LineBasicMaterial({
                color:       0xffccee,
                transparent: true,
                opacity:     0,
                blending:    THREE.AdditiveBlending,
                depthWrite:  false,
            });

            const line = new THREE.Line(geo, mat);
            line.visible = false;
            this._scene.add(line);

            this._pool.push({
                line, geo, mat,
                alive:    false,
                elapsed:  0,
                duration: 0,
                sx: 0, sy: 0, sz: 0,  // start
                dx: 0, dy: 0,          // total delta
                trailFrac: 0.22,
            });
        }
    }

    // ── Spawn ─────────────────────────────────────────────────────────────────

    _activate(star) {
        // Random start: mostly from top-left or top-right quadrant
        star.sx = (Math.random() - 0.5) * 900;
        star.sy = 150 + Math.random() * 350;
        star.sz = -150 - Math.random() * 300;

        // Diagonal angle: 30–60° off horizontal, pointing down
        const angle  = Math.PI * 0.18 + Math.random() * Math.PI * 0.14;
        const side   = Math.random() > 0.5 ? 1 : -1;
        const dist   = 120 + Math.random() * 100;

        star.dx = side * Math.cos(angle) * dist;
        star.dy = -Math.sin(angle) * dist;

        star.duration  = 0.7 + Math.random() * 0.6;  // 0.7–1.3 s
        star.elapsed   = 0;
        star.trailFrac = 0.18 + Math.random() * 0.12;

        // Pink-to-white color for variety
        const hue = 0.85 + Math.random() * 0.1;
        star.mat.color.setHSL(hue, 0.9, 0.85);

        star.alive = true;
        star.line.visible = true;
    }

    // ── Update ────────────────────────────────────────────────────────────────

    /** @param {number} delta - seconds since last frame */
    update(delta) {
        const now = performance.now();

        // Spawn check
        if (now >= this._nextSpawn) {
            const idle = this._pool.find(s => !s.alive);
            if (idle) this._activate(idle);
            this._nextSpawn = now + MIN_INTERVAL + Math.random() * (MAX_INTERVAL - MIN_INTERVAL);
        }

        // Animate each active star
        this._pool.forEach(star => {
            if (!star.alive) return;

            star.elapsed += delta;
            const t = Math.min(star.elapsed / star.duration, 1);

            // Head position
            const hx = star.sx + star.dx * t;
            const hy = star.sy + star.dy * t;

            // Tail position (lags behind by trailFrac)
            const tailT = Math.max(0, t - star.trailFrac);
            const tx = star.sx + star.dx * tailT;
            const ty = star.sy + star.dy * tailT;

            const pos = star.geo.attributes.position.array;
            pos[0] = tx;  pos[1] = ty;  pos[2] = star.sz;  // tail
            pos[3] = hx;  pos[4] = hy;  pos[5] = star.sz;  // head
            star.geo.attributes.position.needsUpdate = true;

            // Opacity: fade in (0→0.1), hold (0.1→0.75), fade out (0.75→1)
            if      (t < 0.10) star.mat.opacity = t / 0.10;
            else if (t > 0.75) star.mat.opacity = 1 - (t - 0.75) / 0.25;
            else               star.mat.opacity = 1;

            if (t >= 1) {
                star.alive = false;
                star.line.visible = false;
            }
        });
    }

    // ── Dispose ───────────────────────────────────────────────────────────────

    dispose() {
        this._pool.forEach(s => {
            s.geo.dispose();
            s.mat.dispose();
            this._scene.remove(s.line);
        });
        this._pool = [];
    }
}
