/**
 * main.js — Application entry point and orchestrator
 *
 * NEW EFFECTS added:
 *   - FEAT: ShootingStarSystem — sao băng liên tục qua background
 *   - FEAT: ConfettiSystem     — pháo giấy khi chuyển sang text
 *   - FEAT: Heart formation    — state thứ 3, particles tạo trái tim + heartbeat
 *   - FEAT: Mouse parallax    — stars nhẹ nhàng follow chuột (depth illusion)
 *   - FEAT: 3-state button    — sphere / text+sprites / heart
 *   - FEAT: Particle color shift — đỏ/hồng khi heart mode
 *
 * Button cycle:
 *   State 0 → 1: Sphere → Text "HOAN DZ"→"HOAN SIEU DZ" + ảnh + confetti
 *   State 1 → 2: Text → Heart (trái tim đập + màu đỏ hồng)
 *   State 2 → 0: Heart → Sphere (reset tất cả)
 */

import { AppRenderer } from './core/Renderer.js';
import { SceneSetup } from './core/SceneSetup.js';
import { TextureManager } from './managers/TextureManager.js';
import { ParticleSystem } from './systems/ParticleSystem.js';
import { SpriteSystem } from './systems/SpriteSystem.js';
import { StarSystem } from './systems/StarSystem.js';
import { ShootingStarSystem } from './systems/ShootingStarSystem.js';
import { ConfettiSystem } from './effects/ConfettiSystem.js';
import { FontSystem } from './loaders/FontLoader.js';
import { LoadingScreen } from './ui/LoadingScreen.js';
import { Button } from './ui/Button.js';
import { Tween } from './animations/Tween.js';

// ── Configuration ─────────────────────────────────────────────────────────────

const CONFIG = {
    imageUrls: [
        'img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg',
        'img5.jpg', 'img6.jpg', 'img7.jpg', 'img8.jpg',
    ],
    fontUrl: 'https://threejs.org/examples/fonts/gentilis_regular.typeface.json',
    text1: 'HOAN DZ',
    text2: 'HOAN SIEU DZ',
    cameraZ: 250,
    flyInDuration: 2.4,
};

// Button labels for each state (0 = sphere, 1 = text, 2 = heart)
const BTN_LABELS = [
    '✨ Click vào đây',
    '💖 Trái Tim',
    '↩ Quay lại',
];

// ── Bootstrap ─────────────────────────────────────────────────────────────────

async function main() {
    // ── Core setup ────────────────────────────────────────────────────────────
    const loading = new LoadingScreen();
    const appRenderer = new AppRenderer();
    const setup = new SceneSetup(appRenderer.domElement);
    const { scene, camera, controls } = setup;
    appRenderer.setupPostProcessing(scene, camera);

    loading.setProgress(5, 'Đang khởi tạo renderer...');

    // ── Systems ───────────────────────────────────────────────────────────────
    const texManager = new TextureManager();
    const stars = new StarSystem(scene);
    const shootStars = new ShootingStarSystem(scene);   // FEAT
    const particles = new ParticleSystem(scene);
    const confetti = new ConfettiSystem(scene);        // FEAT

    loading.setProgress(10, `Khởi tạo ${particles.count.toLocaleString()} particles...`);

    // ── Load font ─────────────────────────────────────────────────────────────
    loading.setProgress(12, 'Đang tải font chữ...');
    const fontSystem = new FontSystem(particles.count);
    let font;

    try {
        font = await fontSystem.loadFont(
            CONFIG.fontUrl,
            (xhr) => {
                if (xhr.lengthComputable) {
                    const pct = 12 + (xhr.loaded / xhr.total) * 28;
                    loading.setProgress(pct, 'Đang tải font chữ...');
                }
            }
        );
    } catch (err) {
        console.error('Font load failed:', err);
        loading.setProgress(40, '⚠️ Font không tải được');
    }

    // ── Sample text positions ─────────────────────────────────────────────────
    if (font) {
        loading.setProgress(42, `Đang tạo "${CONFIG.text1}"...`);
        const textPos1 = fontSystem.sampleText(font, CONFIG.text1);
        loading.setProgress(62, `Đang tạo "${CONFIG.text2}"...`);
        const textPos2 = fontSystem.sampleText(font, CONFIG.text2);
        particles.setTextPositions(textPos1, textPos2);
    }

    // ── Load sprite textures ──────────────────────────────────────────────────
    loading.setProgress(65, 'Đang tải ảnh...');
    const sprites = new SpriteSystem(scene, texManager);
    await sprites.init(CONFIG.imageUrls, camera);
    loading.setProgress(90, 'Hoàn tất tải ảnh!');

    // ── Hide loading + fly-in ─────────────────────────────────────────────────
    loading.setProgress(100, '✨ Sẵn sàng!');
    await loading.hide();

    await Tween.to(camera.position, { z: CONFIG.cameraZ }, {
        duration: CONFIG.flyInDuration,
        ease: 'power3Out',
    });

    controls.target.set(0, 0, 0);
    controls.update();
    controls.enabled = true;

    // ── Mouse parallax ────────────────────────────────────────────────────────
    // FEAT: Stars gently drift opposite to mouse movement for depth illusion
    let mouseNdcX = 0;
    let mouseNdcY = 0;

    window.addEventListener('mousemove', (e) => {
        mouseNdcX = (e.clientX / window.innerWidth) * 2 - 1;
        mouseNdcY = -(e.clientY / window.innerHeight) * 2 + 1;
    }, { passive: true });

    // ── UI ────────────────────────────────────────────────────────────────────
    const clickHint = document.getElementById('click-hint');

    // FEAT: 3-state cycle button
    const btn = new Button('btn', BTN_LABELS, (state) => {
        switch (state) {

            case 1:
                // Sphere → Text
                if (font) particles.morphToText();
                sprites.hide();
                animateBloom(appRenderer, 0.40, 0.55, 0.5);
                clickHint?.classList.remove('visible');
                break;

            case 2:
                // Text → Heart + Sprites
                particles.morphToHeart();                  // FEAT: heart
                sprites.show();                            // Images orbit the heart!
                confetti.burst();                          // Heart reveal confetti
                animateBloom(appRenderer, 0.55, 0.40, 0.4); // Reduced bloom to prevent glare
                clickHint?.classList.add('visible');
                document.getElementById('heart-title')?.classList.add('visible');
                break;

            case 0:
                // Heart → Sphere (reset)
                particles.morphToSphere();
                sprites.hide();
                animateBloom(appRenderer, 0.40, 0.40, 0.6);
                clickHint?.classList.remove('visible');
                break;
        }
    });

    btn.enable();

    // ── Animation loop ────────────────────────────────────────────────────────
    let lastTime = 0;

    function animate(timestamp) {
        requestAnimationFrame(animate);

        const time = timestamp * 0.001;
        const delta = Math.min(time - lastTime, 0.1);
        lastTime = time;

        setup.update();
        stars.update(delta);
        stars.setParallax(mouseNdcX, mouseNdcY);    // FEAT: mouse parallax
        shootStars.update(delta);                    // FEAT: shooting stars
        particles.update(time);
        sprites.update(time);
        confetti.update(delta);                      // FEAT: confetti physics

        appRenderer.render();
    }

    requestAnimationFrame(animate);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function animateBloom(appRenderer, from, to, duration) {
    const proxy = { value: from };
    appRenderer.setBloomStrength(from);
    Tween.to(proxy, { value: to }, {
        duration,
        ease: 'sineInOut',
        onUpdate: () => appRenderer.setBloomStrength(proxy.value),
    });
}

// ── Start ─────────────────────────────────────────────────────────────────────

main().catch((err) => {
    console.error('Fatal error in main():', err);
    const loadText = document.getElementById('loading-text');
    if (loadText) loadText.textContent = '❌ Có lỗi xảy ra. Vui lòng reload trang.';
});
