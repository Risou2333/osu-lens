/**
 * 日漫黑白风主题背景动画
 * 实现：速度线 (Speed Lines) 或墨迹点阵效果
 */

let animationId = null;
let canvas, ctx;
let lines = [];

class speedLine {
    constructor(w, h) {
        this.reset(w, h);
    }

    reset(w, h) {
        this.x = Math.random() * w;
        this.y = Math.random() * h;
        this.length = Math.random() * 100 + 50;
        this.speed = Math.random() * 15 + 10;
        this.width = Math.random() * 2 + 0.5;
        this.opacity = Math.random() * 0.3 + 0.1;
    }

    update(w, h) {
        this.x -= this.speed;
        if (this.x + this.length < 0) {
            this.reset(w, h);
            this.x = w;
        }
    }

    draw(ctx) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(0, 0, 0, ${this.opacity})`;
        ctx.lineWidth = this.width;
        ctx.moveTo(this.x, this.y);
        ctx.lineTo(this.x + this.length, this.y);
        ctx.stroke();
    }
}

export function setupBackgroundAnimation() {
    // 清理之前的动画
    if (animationId) {
        cancelAnimationFrame(animationId);
    }

    canvas = document.getElementById('background-animation-canvas');
    if (!canvas) return;

    ctx = canvas.getContext('2d');
    
    const resize = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initLines();
    };

    const initLines = () => {
        lines = [];
        const count = Math.floor(canvas.width / 15);
        for (let i = 0; i < count; i++) {
            lines.push(new speedLine(canvas.width, canvas.height));
        }
    };

    window.addEventListener('resize', resize);
    resize();

    const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        lines.forEach(line => {
            line.update(canvas.width, canvas.height);
            line.draw(ctx);
        });

        animationId = requestAnimationFrame(animate);
    };

    animate();
}
