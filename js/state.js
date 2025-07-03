// js/state.js

// 应用状态管理
export let accessToken = null;
export let tokenExpiry = 0;
export let downloadSource = 'nerinyan';
export let currentPlayer = null;
export let recentPlaysLoaded = false;
export let originalTopPlaysDetails = [];
export let recentPlaysDetails = [];
export let processedPlayDetailsForChart = [];

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
    isFetchingRecentPlays: false,
    allRecentPlaysLoaded: false,
    recentPlaysOffset: 0,
    beatmapSearchCursor: null,
    isFetchingBeatmaps: false,
};

export const activeCharts = {};

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
    appState.beatmapSearchCursor = null;
    appState.isFetchingBeatmaps = false;
}
