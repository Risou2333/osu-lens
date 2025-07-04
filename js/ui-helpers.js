// js/ui-helpers.js

// UI 辅助功能，如 Toast、动画、拖拽选择等
import { dom } from './dom.js';

let toastTimeout;

export function showToast(message) {
    const toastElement = dom.toast;
    
    // 先清除旧的计时器和动画效果
    clearTimeout(toastTimeout);
    toastElement.classList.remove('visible');

    // 强制浏览器重新计算样式，以便动画能够重新开始
    // 这行代码虽然看起来没什么用，但它是一个强制浏览器重绘的小技巧
    void toastElement.offsetWidth;

    // 确保在设置新内容和显示之前，元素是隐藏的
    setTimeout(() => {
        toastElement.textContent = message;
        toastElement.classList.add('visible');

        // 设置新的计时器来隐藏提示
        toastTimeout = setTimeout(() => {
            toastElement.classList.remove('visible');
        }, 1800); // 稍微延长显示时间，体验更好
    }, 50); // 添加一个微小的延迟，确保移除/添加class的动作被浏览器正确处理
}

// 设置背景粒子动画
export function setupBackgroundAnimation() {
    const canvas = document.getElementById('background-animation-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;
    const options = { particleCount: window.innerWidth > 768 ? 70 : 35, particleSpeed: 0.3, lineDistance: 160, particleRadius: 2, };
    function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; options.particleCount = window.innerWidth > 768 ? 70 : 35; }
    function getThemeColors() { return ['rgba(255, 105, 180, 0.6)', 'rgba(78, 186, 255, 0.6)', 'rgba(204, 150, 255, 0.6)']; }
    class Particle { constructor(x, y, vx, vy, radius, color) { this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.radius = radius; this.baseColor = color; this.color = this.baseColor.replace(/rgba?\((\d+, \d+, \d+), [\d\.]+\)/, 'rgb($1)'); } draw() { ctx.beginPath(); ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2, false); ctx.fillStyle = this.color; ctx.fill(); } update() { if (this.x < 0 || this.x > canvas.width) this.vx = -this.vx; if (this.y < 0 || this.y > canvas.height) this.vy = -this.vy; this.x += this.vx; this.y += this.vy; } }
    function init() { resizeCanvas(); particles = []; const colors = getThemeColors(); for (let i = 0; i < options.particleCount; i++) { const radius = Math.random() * options.particleRadius + 1; const x = Math.random() * (canvas.width - radius * 2) + radius; const y = Math.random() * (canvas.height - radius * 2) + radius; const vx = (Math.random() - 0.5) * options.particleSpeed; const vy = (Math.random() - 0.5) * options.particleSpeed; const color = colors[Math.floor(Math.random() * colors.length)]; particles.push(new Particle(x, y, vx, vy, radius, color)); } }
    function connect() { for (let i = 0; i < particles.length; i++) { for (let j = i + 1; j < particles.length; j++) { const dx = particles[i].x - particles[j].x; const dy = particles[i].y - particles[j].y; const distance = Math.sqrt(dx * dx + dy * dy); if (distance < options.lineDistance) { const opacity = 1 - distance / options.lineDistance; ctx.strokeStyle = particles[i].baseColor.replace(/[\d\.]+\)$/, `${opacity * 0.7})`); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(particles[i].x, particles[i].y); ctx.lineTo(particles[j].x, particles[j].y); ctx.stroke(); } } } }
    function animate() { ctx.clearRect(0, 0, canvas.width, canvas.height); particles.forEach(p => { p.update(); p.draw(); }); connect(); animationFrameId = requestAnimationFrame(animate); }
    function startAnimation() { if (animationFrameId) cancelAnimationFrame(animationFrameId); init(); animate(); }
    window.restartBgAnimation = startAnimation;
    let resizeTimeout;
    window.addEventListener('resize', () => { clearTimeout(resizeTimeout); resizeTimeout = setTimeout(startAnimation, 300); });
    startAnimation();
}

// 设置拖拽选择功能
export function setupDragToSelect(config) {
    const { container, selectAllCheckbox, cardSelector = '.glass-card' } = config;
    if (!container) return;

    let isDragging = false;
    let dragHappened = false;
    let startIndex = -1;
    let dragAction = 'select';
    let allCards = [];
    let scrollInterval = null;
    let startX = 0;
    let startY = 0;

    const updateSelectionPreview = (currentIndex) => {
        if (startIndex === -1) return;
        allCards.forEach(card => card.classList.remove('drag-over'));
        const min = Math.min(startIndex, currentIndex);
        const max = Math.max(startIndex, currentIndex);
        for (let i = min; i <= max; i++) {
            if (allCards[i]) allCards[i].classList.add('drag-over');
        }
    };

    container.addEventListener('mousedown', e => {
        if (e.target.closest('a, button, .beatmap-cover-container, .pp-calc-btn')) return;
        e.preventDefault();
        const card = e.target.closest(cardSelector);
        if (card) {
            isDragging = true;
            dragHappened = false;
            document.body.classList.add('is-drag-selecting');
            allCards = Array.from(container.querySelectorAll(cardSelector));
            startIndex = allCards.indexOf(card);
            dragAction = card.classList.contains('selected') ? 'deselect' : 'select';
            startX = e.clientX;
            startY = e.clientY;
        }
    });

    container.addEventListener('mousemove', e => {
        if (!isDragging) return;
        if (!dragHappened) {
            const moved = Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5;
            if (moved) {
                dragHappened = true;
            }
        }
        if (dragHappened) {
            allCards = Array.from(container.querySelectorAll(cardSelector));
            const currentCard = e.target.closest(cardSelector);
            if (currentCard) {
                const currentIndex = allCards.indexOf(currentCard);
                if (currentIndex !== -1) {
                    updateSelectionPreview(currentIndex);
                }
            }
        }
    });

    window.addEventListener('mouseup', e => {
        if (!isDragging) return;
        allCards = Array.from(container.querySelectorAll(cardSelector));
        allCards.forEach(card => card.classList.remove('drag-over'));
        document.body.classList.remove('is-drag-selecting');
        clearInterval(scrollInterval);
        if (dragHappened) {
            const endCard = e.target.closest(cardSelector);
            if (startIndex !== -1 && endCard) {
                const endIndex = allCards.indexOf(endCard);
                const min = Math.min(startIndex, endIndex);
                const max = Math.max(startIndex, endIndex);
                for (let i = min; i <= max; i++) {
                    if (allCards[i]) {
                        allCards[i].classList.toggle('selected', dragAction === 'select');
                    }
                }
            }
            if (selectAllCheckbox) {
                const selectedCardCount = container.querySelectorAll(`${cardSelector}.selected`).length;
                selectAllCheckbox.checked = allCards.length > 0 && selectedCardCount === allCards.length;
            }
        }
        isDragging = false;
    }, true);

    container.addEventListener('click', e => {
        if (e.target.closest('a, button, .beatmap-cover-container, .pp-calc-btn')) return;
        if (dragHappened) {
            dragHappened = false;
            return;
        }
        const card = e.target.closest(cardSelector);
        if (card) {
            card.classList.toggle('selected');
            if (selectAllCheckbox) {
                allCards = Array.from(container.querySelectorAll(cardSelector));
                const selectedCardCount = container.querySelectorAll(`${cardSelector}.selected`).length;
                selectAllCheckbox.checked = allCards.length > 0 && selectedCardCount === allCards.length;
            }
        }
    });

    const handleAutoScroll = e => {
        if (!isDragging) return;
        clearInterval(scrollInterval);
        const viewportHeight = window.innerHeight;
        const scrollThreshold = 80;
        const scrollSpeed = 15;
        if (e.clientY < scrollThreshold) {
            scrollInterval = setInterval(() => window.scrollBy(0, -scrollSpeed), 15);
        } else if (e.clientY > viewportHeight - scrollThreshold) {
            scrollInterval = setInterval(() => window.scrollBy(0, scrollSpeed), 15);
        }
    };
    window.addEventListener('mousemove', handleAutoScroll);
}
// 设置加载状态的显示
export function setLoading(isLoading, message = "正在加载数据...", isGlobalReset = true) {
    dom.loadingDiv.querySelector('p').textContent = message;
    dom.loadingDiv.classList.toggle('hidden', !isLoading);

    // 【核心修改】通过给 body 添加/移除 class 来控制全局加载状态
    document.body.classList.toggle('is-loading', isLoading);

    if (isLoading && isGlobalReset) {
        dom.errorMessageDiv.classList.add('hidden');
        dom.playerDataContainer.classList.add('hidden');
        // 【核心修改】移除下面这行，我们不再隐藏导航链接
        // dom.navLinksContainer.classList.add('hidden'); 
        dom.beatmapSearchPage.page.classList.add('hidden');
        dom.beatmapSearchPage.resultsContainer.innerHTML = '';
    }
}

// 显示错误信息
export function displayError(message) {
    dom.errorMessageDiv.textContent = message;
    dom.errorMessageDiv.classList.remove('hidden');
    dom.playerDataContainer.classList.add('hidden');
    dom.navLinksContainer.classList.add('hidden');
}
