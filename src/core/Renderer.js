/**
 * Renderer.js — WebGLRenderer + UnrealBloom post-processing + resize handler
 *
 * FIX: Adds proper resize handler (was missing in original code).
 * FIX: Limits devicePixelRatio to 2 for mobile GPU savings.
 * FEAT: UnrealBloomPass for cinematic glow effect.
 * FEAT: OutputPass for correct sRGB color space output.
 */

import * as THREE from 'three';
import { EffectComposer }   from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }       from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass }  from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }       from 'three/addons/postprocessing/OutputPass.js';

export class AppRenderer {
    constructor() {
        // ── WebGL Renderer ────────────────────────────────────────────────
        this._renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: 'high-performance',
            alpha: false,
        });
        this._renderer.setSize(window.innerWidth, window.innerHeight);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // FIX: cap at 2
        this._renderer.outputColorSpace = THREE.SRGBColorSpace;
        this._renderer.toneMapping = THREE.NoToneMapping;    // FIX: NoToneMapping keeps photos true-to-life
        this._renderer.toneMappingExposure = 1.0;            // FIX: was 1.2 → overexposed photos
        document.body.appendChild(this._renderer.domElement);

        // ── State ─────────────────────────────────────────────────────────
        this._composer  = null;
        this._camera    = null;
        this._bloomPass = null;

        // ── Resize handler ────────────────────────────────────────────────
        this._onResize = this._onResize.bind(this);
        window.addEventListener('resize', this._onResize);
    }

    /**
     * Initialize EffectComposer with Bloom + OutputPass.
     * Must be called after scene and camera are created.
     *
     * @param {THREE.Scene}  scene
     * @param {THREE.Camera} camera
     */
    setupPostProcessing(scene, camera) {
        this._camera = camera;

        const w = window.innerWidth;
        const h = window.innerHeight;

        this._composer = new EffectComposer(this._renderer);

        // 1. Standard render
        this._composer.addPass(new RenderPass(scene, camera));

        // 2. Bloom (cinematic glow — only hits ultra-bright additive particles)
        this._bloomPass = new UnrealBloomPass(
            new THREE.Vector2(w, h),
            0.40,  // strength  — reduced: was 0.55, photos were getting bloomed
            0.25,  // radius    — tighter spread: was 0.40, blur was bleeding onto sprites
            0.88   // threshold — HIGH: only pixels > 0.88 brightness bloom (particles yes, photos no)
        );
        this._composer.addPass(this._bloomPass);

        // 3. Color space correction (must be last)
        this._composer.addPass(new OutputPass());
    }

    /** Set bloom strength (0 = off, 1+ = heavy glow) */
    setBloomStrength(value) {
        if (this._bloomPass) this._bloomPass.strength = value;
    }

    /** Render one frame */
    render() {
        if (this._composer) {
            this._composer.render();
        }
    }

    _onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;

        // Update camera
        if (this._camera) {
            this._camera.aspect = w / h;
            this._camera.updateProjectionMatrix();
        }

        // Update renderer
        this._renderer.setSize(w, h);
        this._renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // Update composer
        this._composer?.setSize(w, h);
        this._bloomPass?.setSize(w, h);
    }

    /** Raw THREE.WebGLRenderer (for systems that need it) */
    get renderer()   { return this._renderer; }
    /** Canvas DOM element */
    get domElement() { return this._renderer.domElement; }

    dispose() {
        window.removeEventListener('resize', this._onResize);
        this._composer?.dispose();
        this._renderer.dispose();
    }
}
