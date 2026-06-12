/**
 * SceneSetup.js — Scene, PerspectiveCamera, and OrbitControls
 *
 * FIX: OrbitControls now has enableDamping for smoother feel.
 * FIX: Camera starts far (z=500) to allow fly-in animation.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class SceneSetup {
    /**
     * @param {HTMLElement} domElement - Renderer canvas (for mouse events)
     */
    constructor(domElement) {
        // ── Scene ─────────────────────────────────────────────────────────
        this.scene = new THREE.Scene();

        // ── Camera ────────────────────────────────────────────────────────
        this.camera = new THREE.PerspectiveCamera(
            75,                                    // FOV
            window.innerWidth / window.innerHeight,// Aspect
            0.1,                                   // Near clip
            1000                                   // Far clip
        );
        // Start far back for the fly-in animation
        this.camera.position.set(0, 0, 500);

        // ── OrbitControls ─────────────────────────────────────────────────
        this.controls = new OrbitControls(this.camera, domElement);
        this.controls.mouseButtons.RIGHT = null;  // Disable right-click pan
        this.controls.enablePan     = false;
        this.controls.enableDamping = true;       // Smooth deceleration
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance   = 10;
        this.controls.maxDistance   = 1000;
        this.controls.enabled       = false;      // Disabled until fly-in completes
    }

    /** Call every frame inside animate() */
    update() {
        this.controls.update();
    }

    dispose() {
        this.controls.dispose();
    }
}
