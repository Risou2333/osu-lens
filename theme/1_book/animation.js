// 设置背景粒子动画
export function setupBackgroundAnimation() {
    const canvas = document.getElementById('background-animation-canvas');
    if (!canvas) return;
    
    // 确保 canvas 是可见的
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    let particles = [];
    let animationFrameId;
    let mouse = { x: null, y: null, radius: 150 };

    // --- 新增：鼠标移动监听 ---
    window.addEventListener('mousemove', event => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // --- 修改：增强的粒子类 ---
    class Particle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.initialX = this.x;
            this.initialY = this.y;
            this.size = Math.random() * 2.5 + 1;
            this.speedX = (Math.random() - 0.5) * 0.5;
            this.speedY = (Math.random() - 0.5) * 0.5;
            this.opacity = Math.random() * 0.5 + 0.2;
            
            // 随机决定粒子类型
            if (Math.random() > 0.1) {
                // 90% 的概率是光尘
                this.isSymbol = false;
                this.color = `rgba(226, 179, 106, ${this.opacity})`;
            } else {
                // 10% 的概率是符号
                this.isSymbol = true;
                // 从一个字符集中随机选择一个像古代文字或炼金术符号的字符
                const symbols = ['✧', '·', '∘', '⬡', '⬧', '⬨', '⬩', '⬪', '⬫'];
                this.symbol = symbols[Math.floor(Math.random() * symbols.length)];
                this.color = `rgba(240, 210, 160, ${this.opacity * 1.5})`; // 符号更亮一些
                this.size = Math.random() * 8 + 6; // 符号更大一些
            }
        }

        update() {
            // 粒子漂移
            this.x += this.speedX;
            this.y += this.speedY;

            // 检查粒子是否超出边界，如果超出则从另一边回来，形成循环效果
            if (this.x > canvas.width + this.size) this.x = -this.size;
            if (this.x < -this.size) this.x = canvas.width + this.size;
            if (this.y > canvas.height + this.size) this.y = -this.size;
            if (this.y < -this.size) this.y = canvas.height + this.size;
            
            // --- 新增：鼠标交互 ---
            if (mouse.x && mouse.y) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius) {
                    // 当鼠标靠近时，将粒子推开
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    const directionX = forceDirectionX * force * this.size * 0.05;
                    const directionY = forceDirectionY * force * this.size * 0.05;
                    this.x -= directionX;
                    this.y -= directionY;
                }
            }
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.opacity;
            if (this.isSymbol) {
                ctx.font = `${this.size}px Arial`;
                ctx.fillText(this.symbol, this.x, this.y);
            } else {
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1; // 重置透明度
        }
    }

    function init() {
        resizeCanvas();
        particles = [];
        const particleCount = window.innerWidth > 768 ? 150 : 70; // 增加粒子数量
        for (let i = 0; i < particleCount; i++) {
            particles.push(new Particle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();
        }
        animationFrameId = requestAnimationFrame(animate);
    }

    function startAnimation() {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        init();
        animate();
    }
    
    // 暴露给全局，以便在需要时（如切换主题后）可以重新启动
    window.restartBgAnimation = startAnimation;

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(startAnimation, 300);
    });

    startAnimation();
}