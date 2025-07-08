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
