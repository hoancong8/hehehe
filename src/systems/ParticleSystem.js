/**
 * ParticleSystem.js — 50k (desktop) / 15k (mobile) morphing particle system
 *
 * FIXES applied from code review:
 *   - FIX #1: `time` variable shadow removed — single `time` from animate loop
 *   - FIX #3: Pre-allocated Vector3 objects outside render loop (eliminates GC)
 *   - FIX #7: Race condition fixed — clearTimeout() before each new setTimeout()
 *   - FIX #10: Adaptive particle count for mobile devices
 *   - FIX: dispose() cleans up geometry, materials, and pending timers
 *
 * PERF: Main loop iterates typed arrays directly (no object allocations per frame).
 */

import * as THREE from 'three';

// Detect mobile to reduce particle count
const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

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

    ctx.shadowBlur = 10;
    ctx.shadowColor = 'white';
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class ParticleSystem {
    /** @param {THREE.Scene} scene */
    constructor(scene) {
        this._scene = scene;

        // ── Particle count (adaptive) ─────────────────────────────────────
        this.count = IS_MOBILE ? 15_000 : 50_000;

        // ── Typed arrays (pre-allocated, never recreated) ─────────────────
        this.spherePositions = new Float32Array(this.count * 3);
        this.currentPositions = new Float32Array(this.count * 3);
        this.textPositions = new Float32Array(this.count * 3);
        this.superTextPositions = new Float32Array(this.count * 3);
        this.heartPositions = new Float32Array(this.count * 3); // FEAT: heart

        // Active morph target (points to one of the arrays above)
        this.targetPositions = this.spherePositions;

        this.isText = false;
        this.isHeart = false;   // FEAT: heart mode flag
        this._morphTimeout = null;

        // ── Build ─────────────────────────────────────────────────────────
        this._buildSpherePositions();
        this._buildHeartPositions();   // FEAT
        this._buildGeometry();
        this._buildMaterials();
        this._buildPoints();
    }

    // ── Private builders ─────────────────────────────────────────────────────

    _buildSpherePositions() {
        const radius = 150;
        for (let i = 0; i < this.count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            const r = radius * Math.pow(Math.random(), 1.2);

            const sx = Math.sin(phi) * Math.cos(theta);
            const sy = Math.sin(phi) * Math.sin(theta);
            const sz = Math.cos(phi);

            this.spherePositions[i * 3] = r * sx + (Math.random() - 0.5) * 2;
            this.spherePositions[i * 3 + 1] = r * sy + (Math.random() - 0.5) * 2;
            this.spherePositions[i * 3 + 2] = r * sz + (Math.random() - 0.5) * 2;
        }
        // Initialize current positions = sphere
        this.currentPositions.set(this.spherePositions);
    }

    // ── FEAT: Heart positions ─────────────────────────────────────────────────

    /**
     * FEAT: "Many small hearts forming a big heart"
     * We group particles into clusters. Each cluster forms a small heart,
     * and these small hearts are positioned along the outline of a massive heart!
     */
    _buildHeartPositions() {
        const BIG_Y_OFFSET = -8; // User's preferred centering
        const VOLUME_SCALE = IS_MOBILE ? 4.5 : 7.0; // Responsive scale
        
        const particlesPerSmallHeart = 20; 
        
        // Reserve 2000 particles for a magical floating dust aura
        const dustParticles = 2000;
        const numSmallHearts = Math.floor((this.count - dustParticles) / particlesPerSmallHeart);

        let particleIdx = 0;

        for (let i = 0; i < numSmallHearts; i++) {
            // 1. Calculate the center position for this small heart
            const bigT = Math.random() * Math.PI * 2;
            
            // Distribute on the 3D surface (dome profile)
            const zProfile = Math.random(); // 0 (edge) to 1 (center max thickness)
            const s = Math.sqrt(1 - zProfile * zProfile); // Radius scale factor
            
            // Base 2D heart outline
            const outlineX = 16 * Math.pow(Math.sin(bigT), 3);
            const outlineY = 13 * Math.cos(bigT) - 5 * Math.cos(2 * bigT) - 2 * Math.cos(3 * bigT) - Math.cos(4 * bigT);

            let centerPosX = outlineX * s * VOLUME_SCALE;
            let centerPosY = outlineY * s * VOLUME_SCALE;
            
            const maxThickness = IS_MOBILE ? 22 : 35; // How puffy the heart is
            const sign = Math.random() > 0.5 ? 1 : -1;
            let centerPosZ = zProfile * maxThickness * sign;
            
            // MAGIC INNER CORE: 40% of small hearts are pulled inside to give glowing 3D depth
            if (Math.random() < 0.4) {
                const r3 = Math.pow(Math.random(), 1/3); // Uniform volume distribution
                centerPosX *= r3;
                centerPosY *= r3;
                centerPosZ *= r3;
            }
            
            // Apply Y offset after volume scaling
            centerPosY += BIG_Y_OFFSET * VOLUME_SCALE;

            // 3. Generate the particles for THIS small heart
            // Since the material itself is now a heart texture, we just cluster points
            // closely together at the exact same spot (with tiny jitter) to form a very distinct small heart.
            for (let j = 0; j < particlesPerSmallHeart; j++) {
                if (particleIdx >= this.count) break;

                const jitterX = (Math.random() - 0.5) * 0.3;
                const jitterY = (Math.random() - 0.5) * 0.3;
                const jitterZ = (Math.random() - 0.5) * 0.3;

                this.heartPositions[particleIdx * 3]     = centerPosX + jitterX;
                this.heartPositions[particleIdx * 3 + 1] = centerPosY + jitterY;
                this.heartPositions[particleIdx * 3 + 2] = centerPosZ + jitterZ;
                
                particleIdx++;
            }
        }
        
        // 4. MAGICAL FLOATING AURA: dust particles orbiting the huge heart
        const dustRadiusScale = IS_MOBILE ? 100 : 160;
        for (let i = 0; i < dustParticles; i++) {
            if (particleIdx >= this.count) break;
            
            // Random position in a massive sphere around the heart
            const r = dustRadiusScale * Math.pow(Math.random(), 0.6); // Slightly denser near center
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            this.heartPositions[particleIdx * 3]     = r * Math.sin(phi) * Math.cos(theta);
            this.heartPositions[particleIdx * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) + (BIG_Y_OFFSET * VOLUME_SCALE);
            this.heartPositions[particleIdx * 3 + 2] = r * Math.cos(phi);
            
            particleIdx++;
        }
        
        // Failsafe for any remaining particles
        while (particleIdx < this.count) {
             this.heartPositions[particleIdx * 3]     = 0;
             this.heartPositions[particleIdx * 3 + 1] = 0;
             this.heartPositions[particleIdx * 3 + 2] = 0;
             particleIdx++;
        }
    }

    _buildGeometry() {
        this._geometry = new THREE.BufferGeometry();
        this._geometry.setAttribute(
            'position',
            new THREE.BufferAttribute(this.currentPositions, 3)
        );
    }

    _buildMaterials() {
        this._discTex = new THREE.TextureLoader().load(
            'https://threejs.org/examples/textures/sprites/disc.png',
            undefined,
            undefined,
            () => console.warn('ParticleSystem: failed to load disc texture')
        );
        
        this._heartTex = createHeartTexture();

        this._material = new THREE.PointsMaterial({
            map: this._discTex,
            size: 0.8,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            color: 0xff4fa3,
        });

        this._glowMaterial = new THREE.PointsMaterial({
            map: this._discTex,
            size: 1.3,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true,
            opacity: 0.14,
            color: 0xff77cc,
        });
    }

    _buildPoints() {
        this._points = new THREE.Points(this._geometry, this._material);
        this._glow = new THREE.Points(this._geometry, this._glowMaterial);
        this._scene.add(this._points);
        this._scene.add(this._glow);
    }

    // ── Public API ────────────────────────────────────────────────────────────

    /**
     * Store sampled text positions (called after font loads).
     * @param {Float32Array} textPos1  - Positions for text 1
     * @param {Float32Array} textPos2  - Positions for text 2
     */
    setTextPositions(textPos1, textPos2) {
        this.textPositions.set(textPos1);
        this.superTextPositions.set(textPos2);
    }

    /** Morph particles → text then → superText after 2 seconds */
    morphToText() {
        this.isText = true;
        this.isHeart = false;
        this._resetColor();

        // FIX: Clear pending morph before scheduling a new one
        if (this._morphTimeout !== null) {
            clearTimeout(this._morphTimeout);
            this._morphTimeout = null;
        }

        this.targetPositions = this.textPositions;

        this._morphTimeout = setTimeout(() => {
            // Only update if we're still in text mode (user hasn't clicked back)
            if (this.isText) {
                this.targetPositions = this.superTextPositions;
            }
            this._morphTimeout = null;
        }, 2000);
    }

    /** Morph particles → sphere */
    morphToSphere() {
        this.isText = false;
        this.isHeart = false;
        this._resetColor();

        // FIX: Cancel any pending morph to superText
        if (this._morphTimeout !== null) {
            clearTimeout(this._morphTimeout);
            this._morphTimeout = null;
        }

        this.targetPositions = this.spherePositions;
        // Reset scale from heartbeat
        this._points.scale.setScalar(1);
        this._glow.scale.setScalar(1);
    }

    /**
     * FEAT: Morph particles → heart shape.
     * Color shifts to deep pink/red; heartbeat pulse animation activates.
     */
    morphToHeart() {
        this.isText = false;
        this.isHeart = true;

        // Clear any pending text timeout
        if (this._morphTimeout !== null) {
            clearTimeout(this._morphTimeout);
            this._morphTimeout = null;
        }

        this.targetPositions = this.heartPositions;

        // Ethereal misty look: Soft pastel colors and drastically lower opacity 
        // to compensate for massive 3D particle overlap
        this._material.color.setHex(0xff99cc); // Soft pastel pink
        this._glowMaterial.color.setHex(0xcc66ff); // Ethereal purple
        this._material.opacity = 0.5;
        this._glowMaterial.opacity = 0.1;
        
        // Swap texture to perfect hearts and increase size so they are clearly seen
        this._material.map = this._heartTex;
        this._glowMaterial.map = this._heartTex;
        this._material.size = IS_MOBILE ? 2.5 : 3.5;
        this._glowMaterial.size = IS_MOBILE ? 4.0 : 5.0;
        this._material.needsUpdate = true;
        this._glowMaterial.needsUpdate = true;
    }

    /** Restore original color, texture, and opacity */
    _resetColor() {
        this._material.color.setHex(0xff4fa3);
        this._glowMaterial.color.setHex(0xff77cc);
        this._material.opacity = 1.0;
        this._glowMaterial.opacity = 0.14;
        
        // Swap back to circles
        this._material.map = this._discTex;
        this._glowMaterial.map = this._discTex;
        this._material.size = 0.8;
        this._glowMaterial.size = 1.3;
        this._material.needsUpdate = true;
        this._glowMaterial.needsUpdate = true;
    }

    /**
     * Update particle positions each frame.
     * FIX: `time` parameter passed in — no longer shadowed internally.
     *
     * @param {number} time  - Elapsed time in seconds (from animation loop)
     */
    update(time) {
        const pos = this.currentPositions;
        const target = this.targetPositions;
        const isText = this.isText;

        // Slow rotation when in sphere mode
        if (!isText && !this.isHeart) {
            this._points.rotation.y += 0.001;
        } else if (isText) {
            // Smoothly rotate back to facing the camera (0) so text is readable
            let r = this._points.rotation.y % (Math.PI * 2);
            if (r > Math.PI) r -= Math.PI * 2;
            else if (r < -Math.PI) r += Math.PI * 2;
            this._points.rotation.y = r + (0 - r) * 0.05;
        } else if (this.isHeart) {
            // FEAT: Gentle wobble rotation for the heart to show its full 3D puffy volume
            // Math.sin(time) oscillates back and forth slightly so the silhouette isn't lost
            this._points.rotation.y = Math.sin(time * 0.8) * 0.25;
        }

        // FEAT: Heartbeat pulse when in heart mode
        if (this.isHeart) {
            // Double-beat pattern: lub-dub  (quick in, quick out, pause)
            const beat = (time * 1.4) % 1;          // 1.4 beats/sec
            let pulse;
            if (beat < 0.12) pulse = 1 + beat / 0.12 * 0.07;   // lub up
            else if (beat < 0.25) pulse = 1.07 - (beat - 0.12) / 0.13 * 0.04; // lub down
            else if (beat < 0.37) pulse = 1.03 + (beat - 0.25) / 0.12 * 0.05; // dub up
            else if (beat < 0.50) pulse = 1.08 - (beat - 0.37) / 0.13 * 0.08; // dub down
            else pulse = 1;                          // rest
            this._points.scale.setScalar(pulse);
            this._glow.scale.setScalar(pulse);
        }

        // ── Morph loop (hot path) ─────────────────────────────────────────
        // Pure typed-array math — zero allocations per frame
        for (let i = 0; i < this.count; i++) {
            const ix = i * 3;
            const iy = ix + 1;
            const iz = ix + 2;

            // Exponential lerp toward target
            pos[ix] += (target[ix] - pos[ix]) * 0.05;
            pos[iy] += (target[iy] - pos[iy]) * 0.05;
            pos[iz] += (target[iz] - pos[iz]) * 0.05;

            // Subtle shimmer when displaying text
            if (isText) {
                pos[ix] += Math.sin(time * 3 + i) * 0.02;
                pos[iy] += Math.cos(time * 2 + i) * 0.02;
            }
        }

        // Pulse particle size (breathing effect)
        this._material.size = 0.5 + Math.sin(time * 3) * 0.1;

        // Keep glow rotation in sync
        this._glow.rotation.copy(this._points.rotation);

        // Signal Three.js that position buffer changed
        this._geometry.attributes.position.needsUpdate = true;
    }

    dispose() {
        if (this._morphTimeout !== null) {
            clearTimeout(this._morphTimeout);
            this._morphTimeout = null;
        }
        this._geometry.dispose();
        this._material.dispose();
        this._glowMaterial.dispose();
        this._scene.remove(this._points);
        this._scene.remove(this._glow);
    }
}
