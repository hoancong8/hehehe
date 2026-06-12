/**
 * ConfettiSystem.js — Colorful confetti particle burst
 *
 * Call burst() to trigger a celebration confetti shower.
 * Uses a Points object with vertex colors, simple physics (gravity + drag).
 * Re-triggerable: burst() can be called multiple times.
 */

import * as THREE from 'three';

const COUNT = 400; // More confetti
const DURATION = 5.0;   // seconds the confetti stays visible
const GRAVITY = -60;   // Floatier gravity
const DRAG = 0.98;  // velocity damping per frame

function createHeartTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(64, 30);
    ctx.bezierCurveTo(64, 25, 55, 10, 35, 10);
    ctx.bezierCurveTo(0, 10, 0, 52, 0, 52);
    ctx.bezierCurveTo(0, 72, 28, 97, 64, 120);
    ctx.bezierCurveTo(100, 97, 128, 72, 128, 52);
    ctx.bezierCurveTo(128, 52, 128, 10, 93, 10);
    ctx.bezierCurveTo(73, 10, 64, 25, 64, 30);
    ctx.fill();

    // Soft glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'white';
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

// Soft pastel pink color palette for falling hearts
const PALETTE = [
    0xffb6c1,  // LightPink
    0xffc0cb,  // Pink
    0xffd1dc,  // Pastel Pink
    0xffe4e1,  // MistyRose
    0xff99cc,  // Soft ethereal pink
];

export class ConfettiSystem {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this._scene = scene;
        this._active = false;
        this._elapsed = 0;
        this._built = false;
    }

    // ── Lazy build ────────────────────────────────────────────────────────────

    _build() {
        const positions = new Float32Array(COUNT * 3);
        const colors = new Float32Array(COUNT * 3);
        this._velocities = new Float32Array(COUNT * 3);

        // Assign random colors per particle
        for (let i = 0; i < COUNT; i++) {
            const col = new THREE.Color(PALETTE[i % PALETTE.length]);
            colors[i * 3] = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const mat = new THREE.PointsMaterial({
            size: 15, // Make hearts visible
            map: createHeartTexture(),
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.NormalBlending, // Normal blending prevents "glare" (white blowout)
            depthWrite: false,
            sizeAttenuation: true,
        });

        this._points = new THREE.Points(geo, mat);
        this._scene.add(this._points);
        this._geo = geo;
        this._mat = mat;
        this._built = true;
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Trigger a confetti burst from the center of the scene.
     * Safe to call multiple times — resets state each time.
     */
    burst() {
        if (!this._built) this._build();

        const pos = this._geo.attributes.position.array;
        const vel = this._velocities;

        for (let i = 0; i < COUNT; i++) {
            // All start near center, clustered around particle origin
            pos[i * 3] = (Math.random() - 0.5) * 60;
            pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
            pos[i * 3 + 2] = (Math.random() - 0.5) * 60;

            // Explosive outward velocity
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            const speed = 40 + Math.random() * 80;
            vel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
            vel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta) + 40; // Bias upward strongly for fountain effect
            vel[i * 3 + 2] = speed * Math.cos(phi) * 0.4;
        }

        this._geo.attributes.position.needsUpdate = true;
        this._elapsed = 0;
        this._active = true;
        this._mat.opacity = 0.85; // Slightly softer base opacity
    }

    // ── Per-frame update ──────────────────────────────────────────────────────

    /** @param {number} delta - seconds since last frame */
    update(delta) {
        if (!this._active || !this._built) return;

        this._elapsed += delta;
        const t = this._elapsed / DURATION;

        if (t >= 1) {
            this._active = false;
            this._mat.opacity = 0;
            return;
        }

        const pos = this._geo.attributes.position.array;
        const vel = this._velocities;

        for (let i = 0; i < COUNT; i++) {
            // Gravity + drag
            vel[i * 3 + 1] += GRAVITY * delta;
            vel[i * 3] *= DRAG;
            vel[i * 3 + 1] *= DRAG;
            vel[i * 3 + 2] *= DRAG;

            pos[i * 3] += vel[i * 3] * delta;
            pos[i * 3 + 1] += vel[i * 3 + 1] * delta;
            pos[i * 3 + 2] += vel[i * 3 + 2] * delta;
        }

        this._geo.attributes.position.needsUpdate = true;

        // Fade out in final 35% of duration
        if (t > 0.65) {
            this._mat.opacity = 0.85 * (1 - (t - 0.65) / 0.35);
        }
        
        // Gentle rotation/wobble for the falling hearts
        this._mat.rotation = Math.sin(this._elapsed * 2) * 0.2;
    }

    // ── Dispose ───────────────────────────────────────────────────────────────

    dispose() {
        if (!this._built) return;
        this._geo.dispose();
        this._mat.dispose();
        this._scene.remove(this._points);
    }
}
