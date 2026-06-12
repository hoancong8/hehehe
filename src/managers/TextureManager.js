/**
 * TextureManager.js — Texture cache with deduplication and proper dispose
 *
 * FIX: Prevents duplicate texture loads (img1–5 were loaded 2× in original code).
 * FIX: Provides dispose() to free GPU memory when textures are no longer needed.
 */

import * as THREE from 'three';

export class TextureManager {
    constructor() {
        /** @type {Map<string, THREE.Texture>} URL → cached texture */
        this._cache  = new Map();
        this._loader = new THREE.TextureLoader();
    }

    /**
     * Load a texture from URL, returning from cache if already loaded.
     *
     * @param {string} url
     * @returns {Promise<THREE.Texture>}
     */
    load(url) {
        // Return cached instance immediately (deduplication)
        if (this._cache.has(url)) {
            return Promise.resolve(this._cache.get(url));
        }

        return new Promise((resolve, reject) => {
            this._loader.load(
                url,
                (texture) => {
                    texture.colorSpace = THREE.SRGBColorSpace;
                    this._cache.set(url, texture);
                    resolve(texture);
                },
                undefined, // onProgress not used (no Content-Length for images typically)
                (err) => {
                    console.warn(`TextureManager: failed to load "${url}"`, err);
                    reject(err);
                }
            );
        });
    }

    /**
     * Batch load multiple URLs, deduplicating them first.
     *
     * @param {string[]} urls
     * @param {Function} [onProgress] - Called with (loaded, total) counts
     * @returns {Promise<Map<string, THREE.Texture>>} url → texture
     */
    async loadAll(urls, onProgress) {
        const unique = [...new Set(urls)];
        let loaded = 0;

        const results = await Promise.allSettled(
            unique.map(url =>
                this.load(url).then(tex => {
                    loaded++;
                    onProgress?.(loaded, unique.length);
                    return tex;
                })
            )
        );

        const map = new Map();
        unique.forEach((url, i) => {
            if (results[i].status === 'fulfilled') {
                map.set(url, results[i].value);
            }
        });
        return map;
    }

    /** Get a cached texture (returns undefined if not cached) */
    get(url) {
        return this._cache.get(url);
    }

    /** Dispose one texture and remove from cache */
    dispose(url) {
        const tex = this._cache.get(url);
        if (tex) {
            tex.dispose();
            this._cache.delete(url);
        }
    }

    /** Dispose all cached textures */
    disposeAll() {
        this._cache.forEach(tex => tex.dispose());
        this._cache.clear();
    }
}
