// js/utils.js

/**
 * 存放通用的、无副作用的辅助函数
 */

// 格式化数字，例如添加千位分隔符
export const formatNumber = (num, options = {}) => (Number(num) || 0).toLocaleString('en-US', options);

// 格式化秒数为 "XdYhZm" 格式
export const formatPlaytime = (s) => {
    if (!s) return 'N/A';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    return `${days}d${hours}h${minutes}m`;
};

// 格式化秒数为 "MM:SS" 格式
export const formatDuration = (s) => isNaN(s) || s === null ? '00:00' : `${String(Math.floor(s/60)).padStart(2, '0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;

// 计算数组平均值
export const calculateAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

// 计算数组方差
export const calculateVariance = (arr, mean) => arr.length ? arr.reduce((a, v) => a + (v - mean)**2, 0) / arr.length : 0;

// 根据 PP 值返回一个表情符号
export const getPpIcon = (pp) => {
    if (pp === 0) return '🛌';
    if (pp > 0 && pp <= 1) return '🧑‍🦽';
    if (pp > 1 && pp <= 10) return '🚶';
    if (pp > 10 && pp <= 20) return '🚴';
    if (pp > 20 && pp <= 40) return '🚗';
    if (pp > 40 && pp <= 60) return '🚅';
    if (pp > 60 && pp <= 100) return '🛫';
    if (pp > 100) return '🚀';
    return '➖'; // Default for negative or other cases
};
