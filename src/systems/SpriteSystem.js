import * as THREE from 'three';

function createRoundedTexture(image, radius = 120) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = image.width;
    canvas.height = image.height;

    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(canvas.width - radius, 0);
    ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
    ctx.lineTo(canvas.width, canvas.height - radius);
    ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
    ctx.lineTo(radius, canvas.height);
    ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();

    ctx.clip();
    ctx.drawImage(image, 0, 0);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
}

export class SpriteSystem {
    constructor(scene, textureManager) {
        this.scene = scene;
        this.textureManager = textureManager;
        this.sprites = [];
        this.visible = false;
        
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.camera = null;
        this.focusedSprite = null;

        this._targetPos = new THREE.Vector3();
        this._dir = new THREE.Vector3();
        this._scaleTarget = new THREE.Vector3();
        this._pointerDownPos = { x: 0, y: 0 };
        
        this._onPointerDown = this._onPointerDown.bind(this);
        this._onPointerUp = this._onPointerUp.bind(this);
        window.addEventListener('pointerdown', this._onPointerDown);
        window.addEventListener('pointerup', this._onPointerUp);
    }

    async init(imageUrls, camera) {
        this.camera = camera;
        
        // Deduplicate URLs
        const uniqueUrls = [...new Set(imageUrls)];
        
        const loader = new THREE.TextureLoader();
        
        for (let i = 0; i < uniqueUrls.length; i++) {
            const url = uniqueUrls[i];
            
            // Calculate a nice circular spread
            const t = (i / uniqueUrls.length) * Math.PI * 2;
            const r = 80;
            const x = Math.cos(t) * r;
            const y = Math.sin(t) * r;
            const z = (Math.random() - 0.5) * 40;

            const material = new THREE.SpriteMaterial({
                transparent: true,
                depthWrite: false,
                opacity: 0, // start invisible
            });

            const sprite = new THREE.Sprite(material);
            sprite.position.set(0, 0, 0);
            sprite.visible = false;
            
            sprite.userData = {
                targetPos: new THREE.Vector3(x, y, z),
                baseScale: null,
                isFocused: false
            };

            this.scene.add(sprite);
            this.sprites.push(sprite);

            // Load texture
            try {
                const tex = await new Promise((resolve, reject) => {
                    loader.load(url, resolve, undefined, reject);
                });
                
                tex.colorSpace = THREE.SRGBColorSpace;
                const roundedTex = createRoundedTexture(tex.image, 120);
                material.map = roundedTex;
                tex.dispose(); // clean up raw texture

                const ratio = tex.image.width / tex.image.height;
                const size = 30; // A bit smaller than original
                
                sprite.userData.baseScale = new THREE.Vector3(size * ratio, size, 1);
                sprite.scale.copy(sprite.userData.baseScale);
                
            } catch(e) {
                console.error("Failed to load sprite", url, e);
            }
        }
    }

    show() {
        this.visible = true;
        this.sprites.forEach(s => {
            s.visible = true;
        });
    }

    hide() {
        this.visible = false;
        this.focusedSprite = null;
        this.sprites.forEach(s => {
            s.userData.isFocused = false;
        });
    }

    update(time) {
        if (!this.visible) {
            this.sprites.forEach(s => {
                if (s.material.opacity > 0) {
                    s.material.opacity -= 0.05;
                } else {
                    s.visible = false;
                }
            });
            return;
        }

        this.sprites.forEach((sprite, idx) => {
            // Fade in
            if (sprite.material.opacity < 0.95) {
                sprite.material.opacity += 0.05;
            }

            if (sprite.userData.isFocused && this.camera) {
                // Fly to camera
                this._dir.copy(this.camera.position).normalize();
                this._targetPos.copy(this.camera.position).sub(this._dir.multiplyScalar(60)); // distance from cam
                sprite.position.lerp(this._targetPos, 0.05);

                if (sprite.userData.baseScale) {
                    // Calculate responsive focus scale so horizontal images fit on mobile screens
                    const aspect = window.innerWidth / window.innerHeight;
                    const visibleWidth = 50 * aspect * 0.9; // Safe width at z=60 distance with 45deg fov
                    const visibleHeight = 50 * 0.9; // Safe height
                    
                    const maxWidthScale = visibleWidth / sprite.userData.baseScale.x;
                    const maxHeightScale = visibleHeight / sprite.userData.baseScale.y;
                    
                    // Take the most restrictive scale, but don't exceed 2.0 (desktop default)
                    const focusMultiplier = Math.min(2.0, maxWidthScale, maxHeightScale);
                    
                    this._scaleTarget.copy(sprite.userData.baseScale).multiplyScalar(focusMultiplier);
                    sprite.scale.lerp(this._scaleTarget, 0.05);
                }
            } else {
                // Normal orbit
                const t = time * 0.2 + idx;
                const r = window.innerWidth < 768 ? 45 : 80; // Responsive orbit radius
                
                // Add some bobbing
                this._targetPos.copy(sprite.userData.targetPos);
                this._targetPos.x = Math.cos(t) * r;
                this._targetPos.y += Math.sin(time * 2 + idx) * 0.1;
                this._targetPos.z = Math.sin(t) * r;
                
                sprite.position.lerp(this._targetPos, 0.02);

                if (sprite.userData.baseScale) {
                    sprite.scale.lerp(sprite.userData.baseScale, 0.05);
                }
            }
        });
    }

    _onPointerDown(event) {
        if (!this.visible || !this.camera) return;
        this._pointerDownPos.x = event.clientX;
        this._pointerDownPos.y = event.clientY;
    }

    _onPointerUp(event) {
        if (!this.visible || !this.camera) return;

        // Ignore UI clicks
        if (event.target.id === 'btn' || event.target.tagName === 'BUTTON') return;

        const clientX = event.clientX;
        const clientY = event.clientY;
        
        // Calculate drag distance to ensure it's a tap, not a swipe
        const dx = clientX - this._pointerDownPos.x;
        const dy = clientY - this._pointerDownPos.y;
        if (dx * dx + dy * dy > 25) return; // Moved more than 5px -> dragging, ignore

        this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.sprites);

        if (intersects.length > 0) {
            const clicked = intersects[0].object;

            // Toggle focus
            if (clicked.userData.isFocused) {
                clicked.userData.isFocused = false;
                this.focusedSprite = null;
            } else {
                // Unfocus all others
                this.sprites.forEach(s => s.userData.isFocused = false);
                clicked.userData.isFocused = true;
                this.focusedSprite = clicked;
            }
        } else {
            // Clicked empty space
            this.sprites.forEach(s => s.userData.isFocused = false);
            this.focusedSprite = null;
        }
    }

    dispose() {
        window.removeEventListener('click', this._onClick);
        window.removeEventListener('touchend', this._onClick);
        this.sprites.forEach(sprite => {
            sprite.material.map?.dispose();
            sprite.material.dispose();
            this.scene.remove(sprite);
        });
        this.sprites = [];
    }
}