// js/state.js

/**
 * 管理应用的可变状态
 */

// 认证和数据源状态
export let accessToken = null;
export let tokenExpiry = 0;
export let downloadSource = 'nerinyan';

// 玩家数据状态
export let currentPlayer = null;
export let recentPlaysLoaded = false;
export let originalTopPlaysDetails = [];
export let recentPlaysDetails = [];
export let processedPlayDetailsForChart = [];

// UI 和筛选状态
export const appState = {
    sortCriteria: 'pp',
    sortOrder: 'desc',
    activeModFilters: [],
    fcFilterStatus: 'all',
    modMatchMode: 'contains',
    activePage: 'playerInfoSection',
    recentPassOnly: false,
    recentBpOnly: false,
    searchHistory: [],
    isFetchingRecentPlays: false, // 标志位：是否正在获取数据
    allRecentPlaysLoaded: false,  // 标志位：是否所有记录都已加载完毕
    recentPlaysOffset: 0,         // 记录当前已加载的偏移量
};

// 图表实例状态
export const activeCharts = {};

// PP 计算器状态
export const calculatorState = {
    currentMap: null,
    currentBeatmapData: null,
    currentDiffAttrs: null,
    totalObjects: 0,
    isAdvancedMode: true,
    isLazerMode: false,
    isInternalUpdate: false,
    osuFileCache: new Map(),
};

// 提供方法来修改状态，这是一种良好的实践，可以跟踪状态变更
export function setAccessToken(token, expiry) {
    accessToken = token;
    tokenExpiry = expiry;
}

export function setDownloadSource(source) {
    downloadSource = source;
}

export function setCurrentPlayer(player) {
    currentPlayer = player;
}

export function setRecentPlaysLoaded(loaded) {
    recentPlaysLoaded = loaded;
}

export function setOriginalTopPlays(plays) {
    originalTopPlaysDetails = plays;
}

export function setRecentPlays(plays) {
    recentPlaysDetails = plays;
}

export function setProcessedPlaysForChart(plays) {
    processedPlayDetailsForChart = plays;
}

export function resetPlayerData() {
    setCurrentPlayer(null);
    setRecentPlaysLoaded(false);
    setOriginalTopPlays([]);
    setRecentPlays([]);
    setProcessedPlaysForChart([]);
    Object.values(activeCharts).forEach(chart => chart?.destroy());
    Object.keys(activeCharts).forEach(key => delete activeCharts[key]);
    appState.isFetchingRecentPlays = false;
    appState.allRecentPlaysLoaded = false;
    appState.recentPlaysOffset = 0;
}
