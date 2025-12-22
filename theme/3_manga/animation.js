/**
 * 黑白日漫主题背景动画
 * 漂浮符号 + 对话框气泡 + 爆炸效果
 */
export function setupBackgroundAnimation() {
    const canvas = document.getElementById('background-animation-canvas');
    if (!canvas) return;

    // 确保 canvas 是可见的
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    let particles = [];
    let speechBubbles = [];
    let explosions = [];
    let animationFrameId;
    let mouse = { x: null, y: null, radius: 200 };

    // 鼠标移动监听
    window.addEventListener('mousemove', event => {
        mouse.x = event.x;
        mouse.y = event.y;
    });
    window.addEventListener('mouseout', () => {
        mouse.x = null;
        mouse.y = null;
    });

    // 鼠标点击创建爆炸效果
    canvas.addEventListener('click', event => {
        explosions.push(new Explosion(event.x, event.y));
    });

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // 漫画符号粒子类
    class MangaParticle {
        constructor() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 18 + 10;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.opacity = Math.random() * 0.5 + 0.15;
            this.rotation = Math.random() * Math.PI * 2;
            this.rotationSpeed = (Math.random() - 0.5) * 0.03;

            // 更丰富的漫画风格符号
            const symbols = [
                '★', '☆', '✦', '✧', '◆', '◇', '▲', '△', '●', '○', '■', '□',
                '⚡', '💢', '💫', '✨', '❤', '♪', '♫', '☀', '☁', '✕', '✓',
                '!', '?', '!?', '...', '♡', '※'
            ];
            this.symbol = symbols[Math.floor(Math.random() * symbols.length)];

            // 灰度颜色,更多层次
            const grayValue = Math.floor(Math.random() * 120 + 40); // 40-160的灰度
            this.color = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${this.opacity})`;

            // 随机脉动效果
            this.pulse = Math.random() * Math.PI * 2;
            this.pulseSpeed = Math.random() * 0.05 + 0.02;
        }

        update() {
            // 粒子漂移
            this.x += this.speedX;
            this.y += this.speedY;
            this.rotation += this.rotationSpeed;
            this.pulse += this.pulseSpeed;

            // 边界循环
            if (this.x > canvas.width + this.size) this.x = -this.size;
            if (this.x < -this.size) this.x = canvas.width + this.size;
            if (this.y > canvas.height + this.size) this.y = -this.size;
            if (this.y < -this.size) this.y = canvas.height + this.size;

            // 鼠标交互 - 推开效果
            if (mouse.x && mouse.y) {
                const dx = mouse.x - this.x;
                const dy = mouse.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < mouse.radius) {
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const force = (mouse.radius - distance) / mouse.radius;
                    const directionX = forceDirectionX * force * 3;
                    const directionY = forceDirectionY * force * 3;
                    this.x -= directionX;
                    this.y -= directionY;
                }
            }
        }

        draw() {
            ctx.save();
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rotation);

            // 脉动缩放
            const scale = 1 + Math.sin(this.pulse) * 0.2;
            ctx.scale(scale, scale);

            ctx.globalAlpha = this.opacity;
            ctx.font = `${this.size}px Arial`;
            ctx.fillStyle = this.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.symbol, 0, 0);
            ctx.restore();
        }
    }

    // 对话框气泡类
    class SpeechBubble {
        constructor() {
            this.reset();
        }

        reset() {
            this.x = Math.random() * canvas.width;
            this.y = Math.random() * canvas.height;
            this.size = Math.random() * 40 + 30;
            this.speedY = -(Math.random() * 0.3 + 0.2);
            this.opacity = 0;
            this.fadeSpeed = 0.01;
            this.maxOpacity = Math.random() * 0.15 + 0.05;
            this.phase = 0; // 0: fade in, 1: hold, 2: fade out
            this.holdTime = Math.random() * 100 + 50;
            this.holdCounter = 0;

            // 灰度
            const grayValue = Math.floor(Math.random() * 80 + 100);
            this.color = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${this.opacity})`;
        }

        update() {
            this.y += this.speedY;

            if (this.phase === 0) {
                this.opacity += this.fadeSpeed;
                if (this.opacity >= this.maxOpacity) {
                    this.opacity = this.maxOpacity;
                    this.phase = 1;
                }
            } else if (this.phase === 1) {
                this.holdCounter++;
                if (this.holdCounter >= this.holdTime) {
                    this.phase = 2;
                }
            } else if (this.phase === 2) {
                this.opacity -= this.fadeSpeed;
                if (this.opacity <= 0) {
                    this.reset();
                }
            }

            if (this.y < -this.size) {
                this.reset();
            }
        }

        draw() {
            ctx.save();
            const grayValue = parseInt(this.color.match(/\d+/)[0]);
            ctx.fillStyle = `rgba(${grayValue}, ${grayValue}, ${grayValue}, ${this.opacity})`;
            ctx.strokeStyle = `rgba(${grayValue - 30}, ${grayValue - 30}, ${grayValue - 30}, ${this.opacity * 1.5})`;
            ctx.lineWidth = 2;

            // 绘制气泡
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size * 0.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // 绘制气泡尾巴
            ctx.beginPath();
            ctx.moveTo(this.x - this.size * 0.3, this.y + this.size * 0.6);
            ctx.lineTo(this.x - this.size * 0.5, this.y + this.size * 1.2);
            ctx.lineTo(this.x - this.size * 0.1, this.y + this.size * 0.7);
            ctx.fill();
            ctx.stroke();

            ctx.restore();
        }
    }

    // 爆炸效果类
    class Explosion {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.particles = [];
            this.maxParticles = 20;
            this.age = 0;
            this.maxAge = 60;

            for (let i = 0; i < this.maxParticles; i++) {
                const angle = (Math.PI * 2 * i) / this.maxParticles;
                const speed = Math.random() * 3 + 2;
                this.particles.push({
                    x: this.x,
                    y: this.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: Math.random() * 4 + 2,
                    opacity: 1
                });
            }
        }

        update() {
            this.age++;
            for (let p of this.particles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vx *= 0.95;
                p.vy *= 0.95;
                p.opacity = 1 - (this.age / this.maxAge);
            }
        }

        draw() {
            ctx.save();
            for (let p of this.particles) {
                ctx.fillStyle = `rgba(50, 50, 50, ${p.opacity})`;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            }

            // 爆炸中心闪光
            const flashOpacity = Math.max(0, 1 - (this.age / (this.maxAge * 0.3)));
            ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity * 0.8})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, 15 * (1 - this.age / this.maxAge), 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        isDead() {
            return this.age >= this.maxAge;
        }
    }

    // 绘制网点效果背景(漫画印刷风格)
    function drawHalftonePattern() {
        ctx.save();
        const dotSize = 2;
        const spacing = 10;
        const opacity = 0.04;

        // 添加呼吸效果
        const breathe = Math.sin(Date.now() * 0.001) * 0.02 + 0.04;

        ctx.fillStyle = `rgba(0, 0, 0, ${breathe})`;
        for (let x = 0; x < canvas.width; x += spacing) {
            for (let y = 0; y < canvas.height; y += spacing) {
                ctx.beginPath();
                ctx.arc(x, y, dotSize, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        ctx.restore();
    }

    function init() {
        resizeCanvas();
        particles = [];
        speechBubbles = [];
        explosions = [];

        const particleCount = window.innerWidth > 768 ? 50 : 25;
        for (let i = 0; i < particleCount; i++) {
            particles.push(new MangaParticle());
        }

        const bubbleCount = window.innerWidth > 768 ? 8 : 4;
        for (let i = 0; i < bubbleCount; i++) {
            speechBubbles.push(new SpeechBubble());
        }
    }

    function animate() {
        // 清空画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // 绘制网点背景
        drawHalftonePattern();

        // 绘制对话框气泡
        for (let i = 0; i < speechBubbles.length; i++) {
            speechBubbles[i].update();
            speechBubbles[i].draw();
        }

        // 绘制爆炸效果
        for (let i = explosions.length - 1; i >= 0; i--) {
            explosions[i].update();
            explosions[i].draw();
            if (explosions[i].isDead()) {
                explosions.splice(i, 1);
            }
        }

        // 绘制漫画符号粒子
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

    // 暴露给全局,以便在需要时(如切换主题后)可以重新启动
    window.restartBgAnimation = startAnimation;

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(startAnimation, 300);
    });

    startAnimation();
}
