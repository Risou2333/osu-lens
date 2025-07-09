/**
 * 设置背景动画：日系像素风的蓝天白云和CRT效果
 */
export function setupBackgroundAnimation() {
    const canvas = document.getElementById('background-animation-canvas');
    if (!canvas) return;

    // 确保 canvas 是可见的
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    // 禁用图像平滑以保持像素感
    ctx.imageSmoothingEnabled = false;

    let clouds = [];
    let animationFrameId;

    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    // 预设几种像素云的形状
    const cloudShapes = [
        [
            [0, 1, 1, 0],
            [1, 1, 1, 1],
            [0, 1, 1, 0]
        ],
        [
            [1, 1, 1],
            [1, 1, 1]
        ],
        [
            [0, 0, 1, 1, 0, 0],
            [0, 1, 1, 1, 1, 0],
            [1, 1, 1, 1, 1, 1],
            [0, 1, 1, 1, 1, 0],
        ]
    ];

    class Cloud {
        constructor() {
            this.shape = cloudShapes[Math.floor(Math.random() * cloudShapes.length)];
            this.pixelSize = Math.floor(Math.random() * 8) + 8;
            this.width = this.shape[0].length * this.pixelSize;
            this.height = this.shape.length * this.pixelSize;
            
            this.speed = (Math.random() * 0.3 + 0.1);
            this.x = Math.random() * (canvas.width + this.width) - this.width;
            this.y = Math.random() * (canvas.height * 0.6); // 云朵出现在上半部分
        }

        update() {
            this.x += this.speed;
            // 如果云朵飘出屏幕，则从另一侧重新进入
            if (this.x > canvas.width) {
                this.x = -this.width;
                this.y = Math.random() * (canvas.height * 0.6);
            }
        }

        draw() {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = this.pixelSize / 4;
            ctx.shadowOffsetY = this.pixelSize / 4;

            for (let r = 0; r < this.shape.length; r++) {
                for (let c = 0; c < this.shape[r].length; c++) {
                    if (this.shape[r][c]) {
                        ctx.fillRect(
                            Math.floor(this.x + c * this.pixelSize),
                            Math.floor(this.y + r * this.pixelSize),
                            this.pixelSize,
                            this.pixelSize
                        );
                    }
                }
            }
            // 重置阴影
            ctx.shadowColor = 'transparent';
        }
    }
    
    // 绘制CRT屏幕的弧面和暗角效果
    function drawCRTEffect() {
        ctx.save();
        // 暗角
        const vignetteGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, canvas.width / 2.5,
            canvas.width / 2, canvas.height / 2, canvas.width / 1.2
        );
        vignetteGradient.addColorStop(0, 'rgba(0,0,0,0)');
        vignetteGradient.addColorStop(1, 'rgba(0,0,0,0.4)');
        ctx.fillStyle = vignetteGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // 弧面高光
        const curveGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        curveGradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        curveGradient.addColorStop(0.4, 'rgba(255, 255, 255, 0)');
        curveGradient.addColorStop(0.6, 'rgba(0, 0, 0, 0)');
        curveGradient.addColorStop(1, 'rgba(0, 0, 0, 0.2)');
        ctx.fillStyle = curveGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.restore();
    }


    function init() {
        resizeCanvas();
        clouds = [];
        const cloudCount = 15;
        for (let i = 0; i < cloudCount; i++) {
            clouds.push(new Cloud());
        }
    }

    function animate() {
        // 绘制天空背景
        const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        skyGradient.addColorStop(0, '#89c4f4'); // 天空顶部
        skyGradient.addColorStop(1, '#5f9cff'); // 天空底部
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制所有云朵
        for (let i = 0; i < clouds.length; i++) {
            clouds[i].update();
            clouds[i].draw();
        }

        // 绘制CRT效果
        drawCRTEffect();

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
