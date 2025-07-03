// js/utils.js

// 通用辅助函数
export const formatNumber = (num, options = {}) => (Number(num) || 0).toLocaleString('en-US', options);
export const formatPlaytime = (s) => {
    if (!s) return 'N/A';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    return `${days}d${hours}h${minutes}m`;
};
export const formatDuration = (s) => isNaN(s) || s === null ? '00:00' : `${String(Math.floor(s/60)).padStart(2, '0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
export const calculateAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
export const calculateVariance = (arr, mean) => arr.length ? arr.reduce((a, v) => a + (v - mean)**2, 0) / arr.length : 0;
export const getPpIcon = (pp) => {
    if (pp === 0) return '🛌';
    if (pp > 0 && pp <= 1) return '🧑‍🦽';
    if (pp > 1 && pp <= 10) return '🚶';
    if (pp > 10 && pp <= 20) return '🚴';
    if (pp > 20 && pp <= 40) return '🚗';
    if (pp > 40 && pp <= 60) return '🚅';
    if (pp > 60 && pp <= 100) return '🛫';
    if (pp > 100) return '🚀';
    return '➖';
};

// 根据谱面难度星级返回对应的颜色
export function getDifficultyColor(stars) {
    const domain = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
    const range = ['#4290FB', '#4FC0FF', '#4FFFD5', '#7CFF4F', '#F6F05C', '#FF8068', '#FF4E6F', '#C645B8', '#6563DE', '#18158E', '#000000'];
    if (stars < domain[0]) return range[0];
    for (let i = 1; i < domain.length; i++) {
        if (stars < domain[i]) return range[i - 1];
    }
    return range[range.length - 1];
}
