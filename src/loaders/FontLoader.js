/**
 * FontLoader.js — Font loading + MeshSurfaceSampler text position generator
 *
 * FIXES applied from code review:
 *   - FIX #9: textMesh and textMesh2 are now properly disposed after sampling
 *   - FIX #10: TextGeometry height reduced (2 vs 5) → fewer vertices to sample
 *   - FEAT: Returns Promise — clean async/await integration
 */

import * as THREE                 from 'three';
import { FontLoader as ThreeFL }  from 'three/addons/loaders/FontLoader.js';
import { TextGeometry }           from 'three/addons/geometries/TextGeometry.js';
import { MeshSurfaceSampler }     from 'three/addons/math/MeshSurfaceSampler.js';

const IS_MOBILE = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

export class FontSystem {
    /**
     * @param {number} sampleCount - Number of sample points per text (= particle count)
     */
    constructor(sampleCount) {
        this._count  = sampleCount;
        this._loader = new ThreeFL();
    }

    /**
     * Load a typeface.json font file.
     *
     * @param {string}   url        - URL to typeface.json
     * @param {Function} [onProgress]
     * @returns {Promise<THREE.Font>}
     */
    loadFont(url, onProgress) {
        return new Promise((resolve, reject) => {
            this._loader.load(url, resolve, onProgress, (err) => {
                console.error('FontSystem: failed to load font', err);
                reject(err);
            });
        });
    }

    /**
     * Create a TextGeometry, sample N points on its surface, then dispose it.
     *
     * @param {THREE.Font} font
     * @param {string}     text
     * @param {number}     [count]  - Defaults to this._count
     * @returns {Float32Array}      - Packed xyz positions (length = count * 3)
     */
    sampleText(font, text, count = this._count) {
        // ── Build geometry ────────────────────────────────────────────────
        const geo = new TextGeometry(text, {
            font,
            size:          IS_MOBILE ? 22 : 40,
            height:        2,          // Reduced: smaller volume → fewer surface triangles
            curveSegments: 8,          // Reduced from 12 → 33% fewer curve vertices
            bevelEnabled:  false,
        });
        geo.center();

        // ── Sample surface ────────────────────────────────────────────────
        const mesh    = new THREE.Mesh(geo);   // No material needed for sampling
        const sampler = new MeshSurfaceSampler(mesh).build();

        const positions = new Float32Array(count * 3);
        const temp      = new THREE.Vector3();  // Reused across samples (no allocations)

        for (let i = 0; i < count; i++) {
            sampler.sample(temp);
            positions[i * 3]     = temp.x;
            positions[i * 3 + 1] = temp.y;
            positions[i * 3 + 2] = temp.z;
        }

        // ── FIX: Dispose geometry immediately after sampling ──────────────
        // TextGeometry is only needed for surface sampling — not rendering.
        geo.dispose();
        // mesh has no material to dispose; geometry is already disposed.

        return positions;
    }
}
