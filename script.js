// --- 常量和全局变量定义 ---
const OSU_API_BASE_URL = 'https://osu.ppy.sh/api/v2';
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token';
const CORS_PROXY_URL = 'https://cors.eu.org/';

let accessToken = null;
let tokenExpiry = 0;

let downloadSource = 'nerinyan';
const downloadSourceInfo = {
    nerinyan: { name: 'Nerinyan', url: 'https://api.nerinyan.moe/d/' },
    osudirect: { name: 'Osu!direct', url: 'https://osu.direct/api/d/' }
};

// --- DOM 元素缓存 ---
const dom = {
    clientIdInput: document.getElementById('clientId'),
    clientSecretInput: document.getElementById('clientSecret'),
    sourceToggleBtn: document.getElementById('sourceToggleBtn'),
    searchButton: document.getElementById('searchButton'),
    toggleSearchBtn: document.getElementById('toggleSearchBtn'),
    searchCard: document.getElementById('searchCard'),
    usernameInput: document.getElementById('username'),
    loadingDiv: document.getElementById('loading'),
    errorMessageDiv: document.getElementById('errorMessage'),
    playerDataContainer: document.getElementById('playerDataContainer'),
    recentPlaysDiv: document.getElementById('recentPlays'),
    topPlaysDiv: document.getElementById('topPlays'),
    topPlaysAnalysisSection: document.getElementById('topPlaysAnalysisSection'),
    topPlaysSortAndFilterControls: document.getElementById('topPlaysSortAndFilterControls'),
    filteredPpDisplay: document.getElementById('filteredPpDisplay'),
    modMatchToggle: document.getElementById('modMatchToggle'),
    selectAllCheckbox: document.getElementById('selectAllCheckbox'),
    downloadSelectedBtn: document.getElementById('downloadSelectedBtn'),
    navLinksContainer: document.getElementById('navLinksContainer'),
    fcFilter: document.getElementById('fcFilter'),
    ppChartStats: document.getElementById('ppChartStats'),
    toast: document.getElementById('toast'),
    keySetupInstructions: document.getElementById('keySetupInstructions'),
    credentialsContainer: document.getElementById('credentialsContainer'),
    keyManagementContainer: document.getElementById('keyManagementContainer'),
    changeKeyBtn: document.getElementById('changeKeyBtn'),
    userSearchArea: document.getElementById('userSearchArea'),
    saveKeysBtn: document.getElementById('saveKeysBtn'),
    player: {
        container: document.getElementById('audioPlayer'),
        audio: document.getElementById('audioElement'),
        info: document.getElementById('player-info'),
        infoText: document.getElementById('player-info-text'),
        playPauseBtn: document.getElementById('player-play-pause-btn'),
        playIcon: document.getElementById('player-play-icon'),
        pauseIcon: document.getElementById('player-pause-icon'),
        progressBar: document.getElementById('player-progress-bar'),
        currentTime: document.getElementById('player-current-time'),
        duration: document.getElementById('player-duration'),
        volumeSlider: document.getElementById('player-volume-slider'),
        closeBtn: document.getElementById('player-close-btn'),
    },
    playerInfo: {
        banner: document.getElementById('player-banner'),
        profileLink: document.getElementById('playerProfileLink'),
        avatar: document.getElementById('playerAvatar'),
        name: document.getElementById('playerName'),
        flag: document.getElementById('countryFlag'),
        joinDate: document.getElementById('joinDate'),
        level: document.getElementById('playerLevel'),
        pp: document.getElementById('playerPP'),
        accuracy: document.getElementById('playerAccuracy'),
        playcount: document.getElementById('playerPlaycount'),
        playtime: document.getElementById('playerPlaytime'),
        globalRank: document.getElementById('playerGlobalRank'),
        countryRank: document.getElementById('playerCountryRank'),
        rankedScore: document.getElementById('playerRankedScore'),
    }
};

const chartCanvases = {
   pp: document.getElementById('ppScatterChart').getContext('2d'),
   mapperScatter: document.getElementById('mapperScatterChart').getContext('2d'),
   rank: document.getElementById('rankPieChart').getContext('2d'),
   length: document.getElementById('lengthPieChart').getContext('2d'),
   bpm: document.getElementById('bpmPieChart').getContext('2d'),
   mods: document.getElementById('modsPieChart').getContext('2d'),
};
const activeCharts = {};

// --- 应用状态管理 ---
let currentPlayer = null; // OPTIMIZATION: Store current player data
let recentPlaysLoaded = false; // OPTIMIZATION: Flag for lazy loading
let originalTopPlaysDetails = [];
let processedPlayDetailsForChart = [];
let state = {
    sortCriteria: 'pp',
    sortOrder: 'desc',
    activeModFilters: [],
    fcFilterStatus: 'all',
    modMatchMode: 'contains',
    activePage: 'playerInfoSection',
};
let toastTimeout;

// --- 工具函数 ---
const formatNumber = (num, options = {}) => (Number(num) || 0).toLocaleString('en-US', options);
const formatPlaytime = (s) => {
    if (!s) return 'N/A';
    const days = Math.floor(s / 86400);
    const hours = Math.floor((s % 86400) / 3600);
    const minutes = Math.floor((s % 3600) / 60);
    return `${days}d${hours}h${minutes}m`;
};
const formatDuration = (s) => isNaN(s) || s === null ? '00:00' : `${String(Math.floor(s/60)).padStart(2, '0')}:${String(Math.floor(s%60)).padStart(2,'0')}`;
const calculateAverage = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
const calculateVariance = (arr, mean) => arr.length ? arr.reduce((a, v) => a + (v - mean)**2, 0) / arr.length : 0;

// --- API & 数据获取 ---
async function getAccessToken(id, secret, isSilent = false) {
    if (accessToken && Date.now() < tokenExpiry) return accessToken;

    if (!id || !secret) {
        if (!isSilent) {
            showKeySetupUI(true);
            throw new Error("API 密钥缺失。请输入您的客户端ID和密钥。");
        }
        return null;
    }

    try {
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', id);
        body.append('client_secret', secret);
        body.append('scope', 'public');
        
        const response = await fetch(CORS_PROXY_URL + OSU_TOKEN_URL, {
            method: 'POST',
            headers: { 'Accept': 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body,
        });

        if (!response.ok) {
            const errorData = await response.json();
            let errorMessage = errorData.error || errorData.message || errorData.error_description || response.statusText;
            if (errorData.error === 'invalid_client') {
                errorMessage = "客户端身份验证失败。请仔细检查您的客户端ID和客户端密钥是否正确。";
            }
            if (!isSilent) {
                localStorage.removeItem('osuClientId');
                localStorage.removeItem('osuClientSecret');
                showKeySetupUI(true);
                throw new Error(`获取Token失败: ${errorMessage}`);
            }
            return null;
        }

        const data = await response.json();
        accessToken = data.access_token;
        tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        
        return accessToken;
    } catch (error) {
        if (!isSilent) {
           console.error('获取 Access Token 时出错:', error);
           displayError(error.message);
        }
        return null;
    }
}

async function fetchV2Api(endpoint) {
    const token = await getAccessToken(dom.clientIdInput.value, dom.clientSecretInput.value);
    if (!token) return null;

    const response = await fetch(CORS_PROXY_URL + `${OSU_API_BASE_URL}/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json', 'Content-Type': 'application/json' },
    });

    if (response.status === 404) return null;
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API 请求失败 (${response.status}): ${errorData.message || '未知错误'}`);
    }
    return await response.json();
}

// --- 核心业务逻辑 ---
async function handleSearch() {
    const query = dom.usernameInput.value.trim();
    if (!query) { displayError("请输入玩家名称或ID。"); return; }
    if (!dom.clientIdInput.value || !dom.clientSecretInput.value) {
        displayError("请输入您的客户端ID和客户端密钥。");
        showKeySetupUI(true);
        return;
    }
    
    setLoading(true, `正在加载玩家信息...`, true);
    
    try {
        const player = await fetchV2Api(`users/${query}/osu`);
        if (player === null) { 
            setLoading(false); 
            displayError(`未找到玩家 "${query}"。请检查拼写或ID是否正确。`);
            return; 
        }
        
        // OPTIMIZATION: Store player data and reset lazy load flag
        currentPlayer = player;
        recentPlaysLoaded = false;
        dom.recentPlaysDiv.innerHTML = '<p class="opacity-70 text-center p-4">点击标签页以加载最近游玩记录。</p>';

        setLoading(true, `正在加载 ${player.username} 的 Top Plays...`);
        
        // OPTIMIZATION: Only fetch top plays initially
        const topPlaysData = await fetchV2Api(`users/${player.id}/scores/best?limit=100&mode=osu`);

        let beatmapMap = new Map();
        const topIds = topPlaysData?.map(p => p.beatmap.id) || [];

        if (topIds.length > 0) {
            const idsQuery = topIds.map(id => `ids[]=${id}`).join('&');
            const fullBeatmapsData = await fetchV2Api(`beatmaps?${idsQuery}`);
            if (fullBeatmapsData?.beatmaps) {
                beatmapMap = new Map(fullBeatmapsData.beatmaps.map(b => [b.id, b]));
            }
        }

        dom.usernameInput.value = '';
        renderPlayerInfo(player);

        if (topPlaysData?.length) {
            originalTopPlaysDetails = topPlaysData
                .map((play, index) => ({
                    playData: play,
                    beatmapData: beatmapMap.get(play.beatmap.id) || play.beatmap,
                    beatmapsetData: play.beatmapset,
                    originalIndex: index
                }))
                .filter(detail => detail.beatmapData && detail.beatmapsetData);

            processedPlayDetailsForChart = [...originalTopPlaysDetails];
            updateSortHeadersUI();
            renderFilteredAndSortedTopPlays();
            dom.topPlaysSortAndFilterControls.classList.remove('hidden');
            dom.filteredPpDisplay.classList.remove('hidden');
        } else {
            dom.topPlaysDiv.innerHTML = '<p class="opacity-70 text-center p-4">该玩家暂无最佳表现记录。</p>';
            [dom.topPlaysSortAndFilterControls, dom.filteredPpDisplay].forEach(el => el.classList.add('hidden'));
        }
        
        dom.topPlaysAnalysisSection.classList.toggle('hidden', !processedPlayDetailsForChart.length);
        if (processedPlayDetailsForChart.length) {
            renderAllEmbeddedCharts(processedPlayDetailsForChart); 
        }

        dom.playerDataContainer.classList.remove('hidden');
        dom.navLinksContainer.classList.remove('hidden');
        dom.errorMessageDiv.classList.add('hidden');
        dom.searchCard.classList.add('hidden');
        
        showPage('playerInfoSection');

    } catch (error) {
        console.error("处理玩家数据时出错:", error);
        displayError(`${error.message}`);
    } finally {
        setLoading(false);
    }
}

// OPTIMIZATION: New function to lazy load recent plays
async function fetchAndRenderRecentPlays() {
    if (recentPlaysLoaded || !currentPlayer) return;

    dom.recentPlaysDiv.innerHTML = `<div class="text-center p-4">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style="border-color: var(--primary-color); border-top-color: transparent;"></div>
        <p class="mt-2 text-sm">正在加载最近游玩记录...</p>
    </div>`;
    
    try {
        const recentPlaysData = await fetchV2Api(`users/${currentPlayer.id}/scores/recent?limit=100&mode=osu`);
        
        let beatmapMap = new Map();
        const recentIds = recentPlaysData?.map(p => p.beatmap.id) || [];

        if (recentIds.length > 0) {
            const idsQuery = recentIds.map(id => `ids[]=${id}`).join('&');
            const fullBeatmapsData = await fetchV2Api(`beatmaps?${idsQuery}`);
            if (fullBeatmapsData?.beatmaps) {
                beatmapMap = new Map(fullBeatmapsData.beatmaps.map(b => [b.id, b]));
            }
        }

        if (recentPlaysData?.length) {
            const recentPlaysHTML = recentPlaysData.map((play, index) => {
                const fullBeatmap = beatmapMap.get(play.beatmap.id) || play.beatmap;
                return createPlayCardHTML(play, fullBeatmap, play.beatmapset, 'recent', index);
            }).join('');
            dom.recentPlaysDiv.innerHTML = recentPlaysHTML;
        } else {
            dom.recentPlaysDiv.innerHTML = '<p class="opacity-70 text-center p-4">该玩家暂无最近游玩记录。</p>';
        }
        recentPlaysLoaded = true;

    } catch(error) {
        console.error("获取最近游玩记录时出错:", error);
        dom.recentPlaysDiv.innerHTML = `<p class="text-red-400 text-center p-4">加载最近游玩记录失败: ${error.message}</p>`;
    }
}

// --- UI 渲染 & 更新 ---
function setLoading(isLoading, message = "正在加载数据...", isInitialLoad = false) {
    dom.loadingDiv.querySelector('p').textContent = message;
    dom.loadingDiv.classList.toggle('hidden', !isLoading);
    if(isLoading) {
        dom.errorMessageDiv.classList.add('hidden');
        dom.playerDataContainer.classList.add('hidden');
        dom.navLinksContainer.classList.add('hidden');

        if (isInitialLoad) {
            currentPlayer = null; // Reset current player
            recentPlaysLoaded = false;
            dom.recentPlaysDiv.innerHTML = '';
            dom.topPlaysDiv.innerHTML = '';
            dom.ppChartStats.innerHTML = '';
            Object.values(activeCharts).forEach(chart => chart?.destroy());
            Object.keys(activeCharts).forEach(key => delete activeCharts[key]);
            originalTopPlaysDetails = [];
            processedPlayDetailsForChart = [];
        }
    }
}

function displayError(message) {
    dom.errorMessageDiv.textContent = message;
    dom.errorMessageDiv.classList.remove('hidden');
    dom.playerDataContainer.classList.add('hidden');
    dom.navLinksContainer.classList.add('hidden');
}

function renderPlayerInfo(player) {
    const p = dom.playerInfo;
    const stats = player.statistics;
    p.banner.style.backgroundImage = `url('${player.cover_url}')`;
    p.avatar.src = player.avatar_url;
    p.profileLink.href = `https://osu.ppy.sh/users/${player.id}`;
    p.name.textContent = player.username;
    p.flag.src = `https://osu.ppy.sh/images/flags/${player.country_code}.png`;
    p.joinDate.textContent = `加入日期: ${new Date(player.join_date).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}`;
    
    p.level.textContent = `${stats.level.current} (${stats.level.progress}%)`;
    p.pp.textContent = `${formatNumber(stats.pp, {maximumFractionDigits: 0})} pp`;
    p.accuracy.textContent = `${(stats.hit_accuracy || 0).toFixed(2)}%`;
    p.playcount.textContent = formatNumber(stats.play_count);
    p.playtime.textContent = formatPlaytime(stats.play_time);
    p.globalRank.textContent = stats.global_rank ? `#${formatNumber(stats.global_rank)}` : 'N/A';
    p.countryRank.textContent = stats.country_rank ? `#${formatNumber(stats.country_rank)}` : 'N/A';
    p.rankedScore.textContent = formatNumber(stats.ranked_score);
}

function createPlayCardHTML(play, beatmap, beatmapset, type, index) {
    if (!play || !beatmap || !beatmapset) return '';
    const rank = play.rank.toUpperCase();
    const songTitle = `${beatmapset.artist} - ${beatmapset.title}`;
    const isFc = play.perfect && play.statistics.count_miss === 0;

    const ppValue = parseFloat(play.pp) || 0;
    const weightedPp = ppValue * (0.95 ** index);

    const ppAndDateHTML = type === 'top'
        ? `<div class="text-center">
                <span class="text-xs opacity-60">${new Date(play.created_at).toLocaleDateString('sv-SE')}</span>
                <div class="mt-1">
                    <p class="text-xl sm:text-2xl pp-display leading-tight">${ppValue.toFixed(0)}</p>
                    <p class="text-xs opacity-80 leading-tight">(${weightedPp.toFixed(0)})</p>
                    <p class="pp-label leading-tight">PP</p>
                </div>
           </div>`
        : `<div class="text-center">
                <p class="text-xl sm:text-2xl pp-display">${play.pp ? play.pp.toFixed(0) : '?'}</p>
                <p class="pp-label">PP</p>
           </div>`;

    const downloadUrl = `${downloadSourceInfo[downloadSource].url}${beatmap.beatmapset_id || beatmapset.id}`;

    return `
        <div id="${type}-play-${index}" class="glass-card p-2 flex items-stretch space-x-3" style="--bg-image-url: url('${beatmapset.covers.card}')" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}">
            <div class="beatmap-cover-container" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}" data-song-title="${songTitle}">
                <img src="${beatmapset.covers.cover}" alt="谱面封面" class="beatmap-cover" onerror="this.onerror=null;this.src='https://placehold.co/100x70/2a2a4e/e0e0e0?text=无封面';">
                ${type === 'top' ? `<div class="bp-indicator">BP ${index + 1}</div>` : ''}
            </div>
            <div class="flex-grow min-w-0 main-content py-1">
                <h4 class="text-base font-semibold leading-tight" style="color: var(--primary-color);"><a href="https://osu.ppy.sh/b/${beatmap.id}" target="_blank" rel="noopener noreferrer" class="beatmap-title-link">${songTitle} <span class="opacity-70 text-sm">[${beatmap.version}]</span></a></h4>
                <p class="text-xs opacity-70 mt-1.5" title="★${beatmap.difficulty_rating.toFixed(2)} | ${Math.round(beatmap.bpm)}bpm | CS${beatmap.cs.toFixed(1)} AR${beatmap.ar.toFixed(1)} OD${beatmap.accuracy.toFixed(1)} HP${beatmap.drain.toFixed(1)}"><span class="font-bold">★${beatmap.difficulty_rating.toFixed(2)}</span> | ${Math.round(beatmap.bpm)}bpm | CS${beatmap.cs.toFixed(1)} AR${beatmap.ar.toFixed(1)} OD${beatmap.accuracy.toFixed(1)} HP${beatmap.drain.toFixed(1)}</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2 opacity-80">
                    <div>
                        <p>作者: <span class="stat-value-secondary">${beatmapset.creator}</span></p>
                        <p>时长: <span class="stat-value-secondary">${formatDuration(beatmap.total_length)}</span></p>
                        <p>收藏: <span class="stat-value-secondary">${formatNumber(beatmapset.favourite_count)}</span> | 游玩: <span class="stat-value-secondary">${formatNumber(beatmap.playcount)}</span></p>
                        <p>圈数: <span class="stat-value-secondary">${beatmap.count_circles}</span> | 滑条: <span class="stat-value-secondary">${beatmap.count_sliders}</span> | 转盘: <span class="stat-value-secondary">${beatmap.count_spinners}</span></p>
                    </div>
                    <div>
                        <p>Mods: <span class="stat-value">${play.mods.length ? play.mods.join('') : 'NM'}</span></p>
                        <p>评级: <span class="rank-${rank.toLowerCase()} font-semibold ml-1">${rank}</span></p>
                        <p>连击: <span class="${isFc ? 'stat-value' : 'stat-value-imperfect'}">${play.max_combo}x</span> / <span class="stat-value">${beatmap.max_combo || '?'}x</span></p>
                        <p>Miss: <span class="stat-value">${play.statistics.count_miss}</span> | ACC: <span class="stat-value">${(play.accuracy * 100).toFixed(2)}%</span></p>
                    </div>
                </div>
            </div>
            <div class="flex-shrink-0 w-24 flex flex-col justify-between items-center p-1">
                ${ppAndDateHTML}
                <div class="flex items-center gap-2">
                     <a href="osu://b/${beatmap.id}" title="在游戏中打开" class="download-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/></svg></a>
                     <a href="${downloadUrl}" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}" target="_blank" rel="noopener noreferrer" title="下载铺面" class="download-btn beatmap-download-link"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg></a>
                </div>
            </div>
        </div>
    `;
}

function showPage(pageId) {
    // OPTIMIZATION: Trigger lazy load on tab click
    if (pageId === 'recentPlaysSection') {
        fetchAndRenderRecentPlays();
    }

    state.activePage = pageId;
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.toggle('hidden', page.id !== pageId);
    });
    document.querySelectorAll('#navLinksContainer .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
}

function renderFilteredAndSortedTopPlays() {
    if (!originalTopPlaysDetails?.length) return;

    let playsToDisplay = [...originalTopPlaysDetails];
    
    // Mods 筛选
    if (state.activeModFilters.length) {
        playsToDisplay = playsToDisplay.filter(detail => {
            const playMods = detail.playData.mods;
            const filterMods = state.activeModFilters;

            if (filterMods.includes('NM')) return playMods.length === 0;
            
            if (state.modMatchMode === 'exact') {
                // 完全匹配模式
                const normalizedPlayMods = playMods.map(m => m === 'NC' ? 'DT' : m).sort();
                const normalizedFilterMods = filterMods.map(m => m === 'NC' ? 'DT' : m).sort();
                return JSON.stringify(normalizedPlayMods) === JSON.stringify(normalizedFilterMods);
            }
            // 包含模式
            return filterMods.every(filterMod =>
                (filterMod === 'DT' && (playMods.includes('DT') || playMods.includes('NC'))) ||
                playMods.includes(filterMod)
            );
        });
    }

    // FC 状态筛选
    if (state.fcFilterStatus !== 'all') {
        playsToDisplay = playsToDisplay.filter(d => {
            const isFc = d.playData.perfect && d.playData.statistics.count_miss === 0;
            return state.fcFilterStatus === 'fc' ? isFc : !isFc;
        });
    }
    
    // 更新筛选后的加权 PP
    const totalFilteredWeightedPp = playsToDisplay.reduce((sum, d) => sum + (parseFloat(d.playData.pp) || 0) * (0.95 ** d.originalIndex), 0);
    dom.filteredPpDisplay.querySelector('span').textContent = formatNumber(totalFilteredWeightedPp, {maximumFractionDigits: 0});

    // 排序
    const sortFns = {
        accuracy: (a, b) => (a.playData.accuracy || 0) - (b.playData.accuracy || 0),
        difficulty: (a, b) => (a.beatmapData.difficulty_rating || 0) - (b.beatmapData.difficulty_rating || 0),
        length: (a, b) => (a.beatmapData.total_length || 0) - (b.beatmapData.total_length || 0),
        date: (a, b) => new Date(a.playData.created_at) - new Date(b.playData.created_at),
        pp: (a, b) => (a.playData.pp || 0) - (b.playData.pp || 0),
    };
    playsToDisplay.sort((a, b) => {
        const order = state.sortOrder === 'asc' ? 1 : -1;
        return (sortFns[state.sortCriteria] || sortFns.pp)(a, b) * order;
    });

    // 渲染列表
    dom.selectAllCheckbox.checked = false;
    dom.topPlaysDiv.innerHTML = playsToDisplay.length 
        ? playsToDisplay.map(d => createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'top', d.originalIndex)).join('')
        : '<p class="opacity-70 text-center p-4">没有符合筛选条件的 Top Plays。</p>';
}

function updateSortHeadersUI() {
    document.querySelectorAll('.sort-header[data-sort]').forEach(header => {
        const arrowSpan = header.querySelector('.sort-arrow');
        if (header.dataset.sort === state.sortCriteria) {
            header.classList.add('active');
            if(arrowSpan) arrowSpan.textContent = state.sortOrder === 'desc' ? '▼' : '▲';
        } else {
            header.classList.remove('active');
            if(arrowSpan) arrowSpan.textContent = '';
        }
    });
}

// --- 图表渲染 ---
function getChartColors() {
    const palette = [
        'rgba(255, 105, 180, 0.8)', 'rgba(78, 186, 255, 0.8)', 'rgba(255, 206, 86, 0.8)', 
        'rgba(119, 221, 119, 0.8)', 'rgba(204, 150, 255, 0.8)', 'rgba(75, 192, 192, 0.8)',
        'rgba(255, 138, 101, 0.8)'
    ];
    return {
        gridColor: 'rgba(224, 224, 224, 0.2)',
        tickColor: '#e0e0e0',
        titleColor: '#ff85c1',
        legendLabelColor: '#e0e0e0',
        tooltipBgColor: '#1a1a2e',
        tooltipBorderColor: '#ff69b4',
        fcColor: 'rgba(34, 197, 94, 0.7)',
        missColor: 'rgba(239, 68, 68, 0.7)',
        pieChartColors: palette,
        mapperColors: palette,
        primaryColor: 'rgba(255, 105, 180, 0.7)',
        otherMapperColor: 'rgba(156, 163, 175, 0.7)'
    };
}

function createPieChart(chartId, data) {
    if (activeCharts[chartId]) activeCharts[chartId].destroy();
    const colors = getChartColors();
    activeCharts[chartId] = new Chart(chartCanvases[chartId.replace('Pie', '')], {
        type: 'pie',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.values, ppValues: data.ppValues,
                backgroundColor: colors.pieChartColors,
                borderColor: 'var(--card-bg-color)', borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (chartId !== 'modsPie' || !elements.length) return;
                const modString = activeCharts[chartId].data.labels[elements[0].index];
                state.modMatchMode = 'exact';
                dom.modMatchToggle.textContent = '完全一致';
                document.querySelectorAll('input[name="modFilter"]').forEach(cb => cb.checked = false);
                
                const modsToTick = (modString === 'NM') ? ['NM'] : (modString.match(/.{1,2}/g) || []);
                modsToTick.forEach(mod => {
                    const cb = document.querySelector(`input[name="modFilter"][value="${mod === 'NC' ? 'DT' : mod}"]`);
                    if (cb) cb.checked = true;
                });

                state.activeModFilters = Array.from(document.querySelectorAll('input[name="modFilter"]:checked')).map(cb => cb.value);
                renderFilteredAndSortedTopPlays();
                showPage('topPlaysSection');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: colors.legendLabelColor, boxWidth: 12, padding: 15, font: { size: 12 } } },
                tooltip: {
                    backgroundColor: colors.tooltipBgColor, titleColor: colors.tickColor, bodyColor: colors.tickColor,
                    borderColor: colors.tooltipBorderColor, borderWidth: 1, padding: 10,
                    callbacks: {
                        label: c => `${c.label || ''}: ${c.raw || 0} (${formatNumber(c.dataset.ppValues[c.dataIndex], {maximumFractionDigits:0})}pp)`
                    }
                }
            }
        }
    });
}

function createScatterPlot(chartId, title, playDetails, config) {
    if (activeCharts[chartId]) activeCharts[chartId].destroy();
    const colors = getChartColors();
    let datasets = [];
    let showLegend = config.showLegend ?? false;

    const points = playDetails.map(d => ({ x: d.originalIndex + 1, y: config.yValueExtractor(d), originalPlayDetail: d }));

    if (config.colorConfig?.type === 'fcMiss') {
        const fcData = points.filter(p => p.originalPlayDetail.playData.statistics.count_miss === 0);
        const missData = points.filter(p => p.originalPlayDetail.playData.statistics.count_miss > 0);
        datasets.push({ label: `FC (${fcData.length})`, data: fcData, backgroundColor: colors.fcColor });
        datasets.push({ label: `Miss (${missData.length})`, data: missData, backgroundColor: colors.missColor });
        showLegend = true;
    } else if (config.colorConfig?.type === 'mapper') {
        const stats = playDetails.reduce((acc, d) => {
            const creator = d.beatmapsetData.creator;
            if (!acc[creator]) acc[creator] = { count: 0, weightedPp: 0 };
            acc[creator].count++;
            acc[creator].weightedPp += (parseFloat(d.playData.pp) || 0) * (0.95 ** d.originalIndex);
            return acc;
        }, {});
        const sortedMappers = Object.entries(stats).sort(([,a],[,b]) => b.count - a.count);
        const topMappers = sortedMappers.slice(0, 5).map(e => e[0]);
        
        topMappers.forEach((name, i) => {
            datasets.push({
                label: `${name}: ${stats[name].count} (${stats[name].weightedPp.toFixed(0)}pp)`,
                data: points.filter(p => p.originalPlayDetail.beatmapsetData.creator === name),
                backgroundColor: colors.mapperColors[i % colors.mapperColors.length]
            });
        });
        const othersData = points.filter(p => !topMappers.includes(p.originalPlayDetail.beatmapsetData.creator));
        if (othersData.length) {
            const otherStats = sortedMappers.slice(5).reduce((s, [,v]) => ({ count: s.count + v.count, weightedPp: s.weightedPp + v.weightedPp }), { count: 0, weightedPp: 0 });
            datasets.push({
                label: `其他: ${otherStats.count} (${otherStats.weightedPp.toFixed(0)}pp)`,
                data: othersData, backgroundColor: colors.otherMapperColor
            });
        }
        showLegend = true;
    } else {
         datasets.push({ label: config.datasetLabel || 'Play', data: points, backgroundColor: colors.primaryColor });
    }
    datasets.forEach(ds => { ds.pointRadius = 5; ds.pointHoverRadius = 7; });
    
    activeCharts[chartId] = new Chart(chartCanvases[chartId], {
        type: 'scatter', data: { datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            onClick: (e, elements) => {
                if (!elements.length) return;
                const detail = activeCharts[chartId].data.datasets[elements[0].datasetIndex].data[elements[0].index].originalPlayDetail;
                const target = detail ? document.getElementById(`top-play-${detail.originalIndex}`) : null;
                if (target) {
                    showPage('topPlaysSection');
                    setTimeout(() => {
                        document.querySelectorAll('.flash-bg-animation').forEach(el => el.classList.remove('flash-bg-animation', 'flash-glow-animation'));
                        target.classList.add('flash-bg-animation', 'flash-glow-animation');
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 100);
                }
            },
            scales: {
                x: { title: { display: true, text: config.xAxisLabel, color: colors.tickColor }, ticks: { color: colors.tickColor }, grid: { color: colors.gridColor } },
                y: { title: { display: true, text: config.yAxisLabel, color: colors.tickColor }, ticks: { color: colors.tickColor }, grid: { color: colors.gridColor }, ...config.yAxisConfig }
            },
            plugins: {
                title: { display: true, text: title, color: colors.titleColor, font: {size: 16} },
                legend: { display: showLegend, position: 'top', labels: { color: colors.legendLabelColor, boxWidth: 20, padding: 20, font: {size: 11} } },
                tooltip: {
                    backgroundColor: colors.tooltipBgColor, titleColor: colors.tickColor, bodyColor: colors.tickColor,
                    borderColor: colors.tooltipBorderColor, borderWidth: 1, padding: 10, displayColors: false,
                    callbacks: {
                        title: items => `BP #${items[0].raw.originalPlayDetail.originalIndex + 1}`,
                        label: ctx => {
                            const d = ctx.raw.originalPlayDetail;
                            return [
                                `谱面: ${d.beatmapsetData.artist} - ${d.beatmapsetData.title} [${d.beatmapData.version}]`,
                                `作者: ${d.beatmapsetData.creator}`, `PP: ${(parseFloat(d.playData.pp) || 0).toFixed(2)}`,
                                `ACC: ${(d.playData.accuracy * 100).toFixed(2)}%`, `Rank: ${d.playData.rank.toUpperCase()}`,
                                `Mods: ${d.playData.mods.join('') || 'NM'}`, `Miss: ${d.playData.statistics.count_miss}`
                            ];
                        }
                    }
                }
            }
        }
    });
}

function groupDataForPie(details, grouperFn) {
    const stats = details.reduce((acc, detail) => {
        const playMods = detail.playData.mods;
        const sortedMods = [...playMods].sort().join('');
        const key = grouperFn(detail, sortedMods);
        if (!acc[key]) acc[key] = { count: 0, totalWeightedPp: 0 };
        acc[key].count++;
        acc[key].totalWeightedPp += (parseFloat(detail.playData.pp) || 0) * (0.95 ** detail.originalIndex);
        return acc;
    }, {});

    const sorted = Object.entries(stats).sort(([,a], [,b]) => b.count - a.count);
    return {
        labels: sorted.map(([label]) => label),
        values: sorted.map(([, stats]) => stats.count),
        ppValues: sorted.map(([, stats]) => stats.totalWeightedPp)
    };
}

function renderAllEmbeddedCharts(playDetails) { 
    if (!playDetails?.length) return;
    const colors = getChartColors();
    const ppValues = playDetails.map(d => parseFloat(d.playData.pp));
    const avgPP = calculateAverage(ppValues);
    const stdDevPP = Math.sqrt(calculateVariance(ppValues, avgPP));
    dom.ppChartStats.innerHTML = `平均PP: <span class="stat-value">${avgPP.toFixed(1)}</span> | PP标准差: <span class="stat-value">${stdDevPP.toFixed(1)}</span>`;

    createScatterPlot('pp', 'PP 分布', playDetails, {
        yValueExtractor: d => parseFloat(d.playData.pp), yAxisLabel: 'PP 值', xAxisLabel: 'BP 排名',
        yAxisConfig: { beginAtZero: false }, colorConfig: { type: 'fcMiss' }, showLegend: true
    });
    createScatterPlot('mapperScatter', '谱面作者 统计', playDetails, {
        yValueExtractor: d => parseFloat(d.playData.pp), yAxisLabel: 'PP 值', xAxisLabel: 'BP 排名',
        yAxisConfig: { beginAtZero: false }, colorConfig: { type: 'mapper' }, showLegend: true
    });
    
    createPieChart('rankPie', groupDataForPie(playDetails, d => d.playData.rank.toUpperCase()));
    createPieChart('modsPie', groupDataForPie(playDetails, (d, sortedMods) => sortedMods || 'NM'));
    
    const lenRanges = [ [0,60,'0-1:00'], [61,120,'1-2:00'], [121,180,'2-3:00'], [181,240,'3-4:00'], [241,300,'4-5:00'], [301,Infinity,'5:00+'] ];
    createPieChart('lengthPie', groupDataForPie(playDetails, d => {
        const len = parseInt(d.beatmapData.total_length);
        return lenRanges.find(r => len >= r[0] && len <= r[1])[2];
    }));
    
    const bpmRanges = [ [0,120,'<120'], [120,150,'120-150'], [150.01,180,'151-180'], [180.01,210,'181-210'], [210.01,240,'211-240'], [240.01,Infinity,'>240'] ];
    createPieChart('bpmPie', groupDataForPie(playDetails, d => {
        const bpm = parseFloat(d.beatmapData.bpm);
        return bpmRanges.find(r => bpm >= r[0] && bpm <= r[1])[2];
    }));
}

// --- 其他 UI 功能 ---
function updateDownloadLinks() {
    const newBaseUrl = downloadSourceInfo[downloadSource].url;
    document.querySelectorAll('.beatmap-download-link').forEach(link => {
        const beatmapsetId = link.dataset.beatmapsetId;
        if (beatmapsetId) {
            link.href = `${newBaseUrl}${beatmapsetId}`;
        }
    });
}

function showToast(message) {
    clearTimeout(toastTimeout);
    dom.toast.textContent = message;
    dom.toast.classList.add('visible');
    toastTimeout = setTimeout(() => {
        dom.toast.classList.remove('visible');
    }, 2500);
}

function setupBackgroundAnimation() {
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

// --- 密钥管理 UI ---
function showKeySetupUI(isFirstTime) {
    dom.credentialsContainer.classList.remove('hidden');
    dom.keyManagementContainer.classList.add('hidden');
    dom.userSearchArea.classList.add('hidden');
    if (isFirstTime) {
        dom.keySetupInstructions.classList.remove('hidden');
    }
}

function showKeyManagementUI() {
    dom.credentialsContainer.classList.add('hidden');
    dom.keyManagementContainer.classList.remove('hidden');
    dom.keySetupInstructions.classList.add('hidden');
    dom.userSearchArea.classList.remove('hidden');
}

function setupCredentials() {
    const savedId = localStorage.getItem('osuClientId');
    const savedSecret = localStorage.getItem('osuClientSecret');

    if (savedId && savedSecret) {
        dom.clientIdInput.value = savedId;
        dom.clientSecretInput.value = savedSecret;
        showKeyManagementUI();
    } else {
        showKeySetupUI(true);
    }
}

// --- 音频播放器 ---
function setupAudioPlayerListeners() {
    const p = dom.player;
    document.body.addEventListener('click', e => {
        const cover = e.target.closest('.beatmap-cover-container');
        if (cover?.dataset.beatmapsetId) {
            playAudio(cover.dataset.beatmapsetId, cover.dataset.songTitle);
        } else if (e.target.closest('.main-content')) {
            e.target.closest('.glass-card')?.classList.toggle('selected');
        }
    });

    p.playPauseBtn.addEventListener('click', togglePlay);
    p.audio.addEventListener('play', () => updatePlayPauseIcon(true));
    p.audio.addEventListener('pause', () => updatePlayPauseIcon(false));
    p.audio.addEventListener('ended', closePlayer);
    p.audio.addEventListener('timeupdate', updateProgress);
    p.audio.addEventListener('loadedmetadata', updateDuration);
    p.progressBar.addEventListener('input', e => { if(p.audio.duration) p.audio.currentTime = (e.target.value/100) * p.audio.duration; });
    p.volumeSlider.addEventListener('input', e => p.audio.volume = e.target.value);
    p.closeBtn.addEventListener('click', closePlayer);
}

function playAudio(beatmapsetId, songTitle) {
    const p = dom.player;
    const url = `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;
    if (p.audio.src !== url) p.audio.src = url;
    p.infoText.textContent = songTitle;
    p.info.title = songTitle;
    
    setTimeout(() => {
        const isOverflow = p.infoText.scrollWidth > p.info.clientWidth;
        p.info.classList.toggle('is-overflowing', isOverflow);
        if(isOverflow) p.info.style.setProperty('--marquee-parent-width', `${p.info.clientWidth}px`);
    }, 0);

    p.container.style.setProperty('--player-bg-image-url', `url('https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card.jpg')`);
    p.audio.play();
    p.container.classList.add('visible');
}

function togglePlay() { if (dom.player.audio.src) dom.player.audio.paused ? dom.player.audio.play() : dom.player.audio.pause(); }
function updatePlayPauseIcon(isPlaying) {
    dom.player.playIcon.classList.toggle('hidden', isPlaying);
    dom.player.pauseIcon.classList.toggle('hidden', !isPlaying);
}
function updateProgress() {
    if (dom.player.audio.duration) {
        dom.player.progressBar.value = (dom.player.audio.currentTime / dom.player.audio.duration) * 100;
        dom.player.currentTime.textContent = formatDuration(dom.player.audio.currentTime);
    }
}
function updateDuration() { if (dom.player.audio.duration) dom.player.duration.textContent = formatDuration(dom.player.audio.duration); }
function closePlayer() {
    const p = dom.player;
    p.audio.pause();
    p.audio.src = "";
    p.container.classList.remove('visible');
    updatePlayPauseIcon(false);
}

// --- 事件监听器设置 ---
function setupEventListeners() {
    dom.usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });
    dom.searchButton.addEventListener('click', handleSearch);

    dom.toggleSearchBtn.addEventListener('click', () => {
        const isHidden = dom.searchCard.classList.toggle('hidden');
        if (!isHidden) window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    dom.sourceToggleBtn.addEventListener('click', () => {
        downloadSource = downloadSource === 'nerinyan' ? 'osudirect' : 'nerinyan';
        updateDownloadLinks();
        showToast(`已切换下载源至: ${downloadSourceInfo[downloadSource].name}`);
    });

    dom.changeKeyBtn.addEventListener('click', () => {
        accessToken = null;
        tokenExpiry = 0;
        localStorage.removeItem('osuClientId');
        localStorage.removeItem('osuClientSecret');
        dom.clientIdInput.value = '';
        dom.clientSecretInput.value = '';
        showKeySetupUI(true);
    });
    
    dom.saveKeysBtn.addEventListener('click', async () => {
        dom.errorMessageDiv.classList.add('hidden');
        const id = dom.clientIdInput.value.trim();
        const secret = dom.clientSecretInput.value.trim();
        if (!id || !secret) {
            displayError("请输入客户端ID和密钥。");
            return;
        }
        setLoading(true, "正在验证密钥...");
        try {
            const token = await getAccessToken(id, secret, true);
            if (token) {
                localStorage.setItem('osuClientId', id);
                localStorage.setItem('osuClientSecret', secret);
                showToast("密钥验证成功并已保存！");
                showKeyManagementUI(); 
            } else {
                displayError("密钥验证失败。请检查您的客户端ID和密钥是否正确。");
            }
        } catch (error) {
             displayError(error.message || "发生未知错误。");
        } finally {
            setLoading(false);
        }
    });

    dom.navLinksContainer.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            showPage(link.dataset.page);
        });
    });
    
    document.querySelectorAll('.sort-header[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (state.sortCriteria === sortKey) {
                state.sortOrder = state.sortOrder === 'desc' ? 'asc' : 'desc';
            } else {
                state.sortCriteria = sortKey;
                state.sortOrder = 'desc';
            }
            updateSortHeadersUI();
            renderFilteredAndSortedTopPlays();
        });
    });

    dom.modMatchToggle.addEventListener('click', () => {
        state.modMatchMode = state.modMatchMode === 'contains' ? 'exact' : 'contains';
        dom.modMatchToggle.textContent = state.modMatchMode === 'contains' ? '包含' : '完全一致';
        renderFilteredAndSortedTopPlays();
    });

    document.querySelectorAll('input[name="modFilter"]').forEach(checkbox => {
        checkbox.addEventListener('change', () => {
            const modCheckboxes = document.querySelectorAll('input[name="modFilter"]');
            if (checkbox.value === 'NM' && checkbox.checked) {
                modCheckboxes.forEach(cb => { if (cb.value !== 'NM') cb.checked = false; });
            } else if (checkbox.checked) {
                document.querySelector('input[name="modFilter"][value="NM"]').checked = false;
                if (checkbox.value !== 'TD') {
                    const opposite = { EZ: 'HR', HR: 'EZ', HT: 'DT', DT: 'HT' };
                    if (opposite[checkbox.value]) {
                        const oppositeCb = document.querySelector(`input[name="modFilter"][value="${opposite[checkbox.value]}"]`);
                        if (oppositeCb) oppositeCb.checked = false;
                    }
                }
            }
            state.activeModFilters = Array.from(document.querySelectorAll('input[name="modFilter"]:checked')).map(cb => cb.value);
            renderFilteredAndSortedTopPlays();
        });
    });

    dom.fcFilter.addEventListener('change', (e) => {
        state.fcFilterStatus = e.target.value;
        renderFilteredAndSortedTopPlays();
    });
    
    dom.selectAllCheckbox.addEventListener('change', (e) => {
        dom.topPlaysDiv.querySelectorAll('.glass-card').forEach(card => card.classList.toggle('selected', e.target.checked));
    });
    
    dom.downloadSelectedBtn.addEventListener('click', () => {
        const baseUrl = downloadSourceInfo[downloadSource].url;
        const ids = [...new Set(Array.from(dom.topPlaysDiv.querySelectorAll('.glass-card.selected')).map(c => c.dataset.beatmapsetId).filter(Boolean))];
        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        ids.forEach(id => window.open(`${baseUrl}${id}`, '_blank'));
    });

    setupAudioPlayerListeners();
}

// --- 应用初始化 ---
document.addEventListener('DOMContentLoaded', () => {
    setupCredentials();
    setupEventListeners();
    setupBackgroundAnimation();
});
