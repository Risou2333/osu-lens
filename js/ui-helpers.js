// js/ui-helpers.js

// UI 辅助功能，如 Toast、动画、拖拽选择等
import { dom } from './dom.js';

let toastTimeout;

// 显示一个短暂的提示信息 (Toast)
export function showToast(message) {
    clearTimeout(toastTimeout);
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    toastTimeout = setTimeout(() => {
        dom.toast.classList.remove('visible');
    }, 2500);
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
    const { container, selectAllCheckbox } = config;
    if (!container) return;
    let isDragging = false;
    let dragHappened = false;
    let startIndex = -1;
    let dragAction = 'select';
    let allCards = [];
    let scrollInterval = null;
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
        const card = e.target.closest('.glass-card');
        if (card) {
            isDragging = true;
            dragHappened = false;
            allCards = Array.from(container.querySelectorAll('.glass-card'));
            startIndex = allCards.indexOf(card);
            dragAction = card.classList.contains('selected') ? 'deselect' : 'select';
            updateSelectionPreview(startIndex);
        }
    });
    container.addEventListener('mouseover', e => {
        if (!isDragging) return;
        dragHappened = true;
        const currentCard = e.target.closest('.glass-card');
        if (currentCard) {
            const currentIndex = allCards.indexOf(currentCard);
            updateSelectionPreview(currentIndex);
        }
    });
    const stopDragging = (e) => {
        if (!isDragging) return;
        allCards.forEach(card => card.classList.remove('drag-over'));
        if (dragHappened) {
            const endCard = e.target.closest('.glass-card');
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
        }
        isDragging = false;
        clearInterval(scrollInterval);
        setTimeout(() => {
            dragHappened = false;
            if (selectAllCheckbox) {
                const selectedCardCount = container.querySelectorAll('.glass-card.selected').length;
                allCards = Array.from(container.querySelectorAll('.glass-card'));
                selectAllCheckbox.checked = allCards.length > 0 && selectedCardCount === allCards.length;
            }
        }, 0);
    };
    const handleAutoScroll = (e) => {
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
    window.addEventListener('mouseup', stopDragging, true);
    window.addEventListener('mousemove', handleAutoScroll);
    container.addEventListener('click', e => {
        if (e.target.closest('a, button, .beatmap-cover-container, .pp-calc-btn')) return;
        if (!dragHappened) {
            const card = e.target.closest('.glass-card');
            if (card) {
                card.classList.toggle('selected');
                if (selectAllCheckbox) {
                    const selectedCardCount = container.querySelectorAll('.glass-card.selected').length;
                    allCards = Array.from(container.querySelectorAll('.glass-card'));
                    selectAllCheckbox.checked = allCards.length > 0 && selectedCardCount === allCards.length;
                }
            }
        }
    });
}

// 设置加载状态的显示
export function setLoading(isLoading, message = "正在加载数据...", isInitialLoad = false) {
    dom.loadingDiv.querySelector('p').textContent = message;
    dom.loadingDiv.classList.toggle('hidden', !isLoading);
    if(isLoading) {
        dom.errorMessageDiv.classList.add('hidden');
        dom.playerDataContainer.classList.add('hidden');
        dom.navLinksContainer.classList.add('hidden');
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
