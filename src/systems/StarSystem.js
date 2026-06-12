/**
 * StarSystem.js — Background star field
 * Creates decorative star particles in the far background.
 */

import * as THREE from 'three';

const STAR_COUNT = 3000;

export class StarSystem {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this._scene = scene;
        this._build();
    }

    _build() {
        const positions = new Float32Array(STAR_COUNT * 3);

        for (let i = 0; i < STAR_COUNT; i++) {
            positions[i * 3]     = (Math.random() - 0.5) * 2200;
            positions[i * 3 + 1] = (Math.random() - 0.5) * 2200;
            positions[i * 3 + 2] = (Math.random() - 0.5) * 2200;
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const mat = new THREE.PointsMaterial({
            size:        1.4,
            color:       0xff66cc,
            transparent: true,
            opacity:     0.75,
            blending:    THREE.AdditiveBlending,
            depthWrite:  false,
            sizeAttenuation: true,
        });

        this._points = new THREE.Points(geo, mat);
        this._scene.add(this._points);
    }

    /** @param {number} delta - seconds since last frame */
    update(delta) {
        // Very slow auto-rotation for depth feeling
        this._points.rotation.y += delta * 0.008;
        this._points.rotation.x += delta * 0.003;
    }

    /**
     * FEAT: Mouse parallax — stars drift slightly opposite to mouse.
     * Creates a subtle depth illusion (stars appear further away).
     *
     * @param {number} ndcX - Mouse X in Normalized Device Coordinates (-1 to 1)
     * @param {number} ndcY - Mouse Y in NDC (-1 to 1)
     */
    setParallax(ndcX, ndcY) {
        // Stars move opposite to mouse (parallax: far objects move less, opposite direction)
        this._points.position.x += (-ndcX * 12 - this._points.position.x) * 0.04;
        this._points.position.y += ( ndcY * 8  - this._points.position.y) * 0.04;
    }

    dispose() {
        this._points.geometry.dispose();
        this._points.material.dispose();
        this._scene.remove(this._points);
    }
}
