// js/main.js

/**
 * 应用主入口文件
 * 负责：
 * 1. 导入所有其他模块
 * 2. 初始化应用（Wasm, 事件监听等）
 * 3. 编排核心业务逻辑
 */

// --- 模块导入 ---
import init from '../rosu_pp_js/rosu_pp_js.js';
import { dom } from './dom.js';
import { 
    appState, currentPlayer, recentPlaysLoaded, originalTopPlaysDetails, recentPlaysDetails,
    setAccessToken, setDownloadSource, setCurrentPlayer, setRecentPlaysLoaded, 
    setOriginalTopPlays, setRecentPlays, setProcessedPlaysForChart, resetPlayerData
} from './state.js';
import { formatNumber } from './utils.js';
import { DOWNLOAD_SOURCE_INFO } from './config.js';
import { getAccessToken, fetchV2Api } from './api.js';
import { renderPlayerInfo, renderFilteredAndSortedTopPlays, renderFilteredRecentPlays, showPage, updateSortHeadersUI, updateDownloadLinks, showKeySetupUI, showKeyManagementUI, createPlayCardHTML } from './ui.js';
import { setupDragToSelect, setupBackgroundAnimation, showToast, setLoading, displayError } from './ui-helpers.js';
import { renderAllEmbeddedCharts } from './charts.js';
import { setupAudioPlayerListeners } from './audio-player.js';
import { createPpCalculatorControls, initializePpCalculatorMods, setupPpCalculatorListeners } from './pp-calculator.js';

// --- 核心业务逻辑 ---

/**
 * 通过点击按钮加载更多最近的 plays
 */
async function loadMoreRecentPlays() {
    // 检查状态，防止重复加载
    if (appState.isFetchingRecentPlays || appState.allRecentPlaysLoaded || !currentPlayer) return;

    appState.isFetchingRecentPlays = true;
    // 显示加载动画
    dom.recentPlaysLoader.innerHTML = `<div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style="border-color: var(--primary-color); border-top-color: transparent;"></div>`;
    dom.recentPlaysLoader.classList.remove('hidden');

    try {
        const limit = 50;
        const playsPage = await fetchV2Api(`users/${currentPlayer.id}/scores/recent?include_fails=1&limit=${limit}&offset=${appState.recentPlaysOffset}&mode=osu`);

        if (playsPage && playsPage.length > 0) {
            let beatmapMap = new Map();
            const recentIds = playsPage.map(p => p.beatmap.id);
            const idsQuery = recentIds.map(id => `ids[]=${id}`).join('&');
            const fullBeatmapsData = await fetchV2Api(`beatmaps?${idsQuery}`);
            if (fullBeatmapsData?.beatmaps) {
                beatmapMap = new Map(fullBeatmapsData.beatmaps.map(b => [b.id, b]));
            }

            const topPlaysMap = new Map(originalTopPlaysDetails.map(p => [p.playData.id, p]));

            const newPlayDetails = playsPage.map((play, index) => {
                const isBp = play.best_id && topPlaysMap.has(play.best_id);
                const bpDetails = isBp ? topPlaysMap.get(play.best_id) : null;
                return {
                    playData: bpDetails ? bpDetails.playData : play,
                    beatmapData: beatmapMap.get(play.beatmap.id) || play.beatmap,
                    beatmapsetData: play.beatmapset,
                    isBp: isBp,
                    bpDetails: bpDetails,
                    recentIndex: appState.recentPlaysOffset + index,
                };
            }).filter(detail => detail.beatmapData && detail.beatmapsetData);
            
            // 将新卡片追加到现有列表，而不是重新渲染整个列表
            const newCardsHTML = newPlayDetails.map(d => {
                 if (d.isBp) {
                    return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'top', d.bpDetails.originalIndex, true);
                } else {
                    return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'recent', d.recentIndex);
                }
            }).join('');
            dom.recentPlaysDiv.insertAdjacentHTML('beforeend', newCardsHTML);

            // 更新状态
            setRecentPlays([...recentPlaysDetails, ...newPlayDetails]);
            appState.recentPlaysOffset += playsPage.length;

            // 检查是否已加载完所有数据
            if (playsPage.length < limit || appState.recentPlaysOffset >= 500) {
                appState.allRecentPlaysLoaded = true;
                const message = appState.recentPlaysOffset >= 500 ? '已达到 API 查询上限 (500条记录)。' : '没有更多成绩了。';
                dom.recentPlaysLoader.innerHTML = `<p class="opacity-70">${message}</p>`;
            } else {
                 // 恢复“加载更多”按钮
                 dom.recentPlaysLoader.innerHTML = `<button id="loadMoreBtn" class="btn-primary">加载更多</button>`;
            }
        } else {
            // 首次加载就没有数据
            appState.allRecentPlaysLoaded = true;
            if (appState.recentPlaysOffset === 0) {
                dom.recentPlaysDiv.innerHTML = '<p class="opacity-70 text-center p-4">该玩家暂无最近游玩记录。</p>';
                dom.recentPlaysLoader.classList.add('hidden');
            } else {
                dom.recentPlaysLoader.innerHTML = `<p class="opacity-70">没有更多成绩了。</p>`;
            }
        }

    } catch (error) {
        console.error("加载更多最近成绩时出错:", error);
        dom.recentPlaysLoader.innerHTML = `<p class="text-red-400">加载失败: ${error.message}</p>`;
        appState.allRecentPlaysLoaded = true; // 出错时停止后续尝试
    } finally {
        appState.isFetchingRecentPlays = false;
    }
}

/**
 * 渲染搜索历史记录
 */
function renderSearchHistory() {
    dom.searchHistoryContainer.innerHTML = '';
    if (appState.searchHistory.length === 0) {
        dom.searchHistoryContainer.classList.add('hidden');
        return;
    }

    const historyHTML = appState.searchHistory.map(player => `
        <div class="history-item">
            <div class="history-item-main" data-username="${player.username}">
                <img src="${player.avatar_url}" alt="${player.username} avatar">
                <span>${player.username}</span>
            </div>
            <button class="history-item-delete" data-id="${player.id}" title="删除记录">&times;</button>
        </div>
    `).join('');
    dom.searchHistoryContainer.innerHTML = historyHTML;
    dom.searchHistoryContainer.classList.remove('hidden'); // 确保有内容时显示
}

/**
 * 从搜索历史中移除一个玩家
 * @param {string} playerId - 要移除的玩家ID
 */
function removeFromSearchHistory(playerId) {
    // 根据 ID 过滤掉要删除的玩家
    appState.searchHistory = appState.searchHistory.filter(p => p.id.toString() !== playerId.toString());
    
    // 更新 localStorage 并重新渲染
    localStorage.setItem('osuSearchHistory', JSON.stringify(appState.searchHistory));
    renderSearchHistory();
    
    // 如果历史记录为空了，则隐藏容器
    if(appState.searchHistory.length === 0) {
        dom.searchHistoryContainer.classList.add('hidden');
    }
}

/**
 * 将玩家添加到搜索历史并保存到 localStorage
 * @param {object} player - 玩家对象
 */
function addToSearchHistory(player) {
    // 移除已存在的同名记录，以确保新记录在最前
    appState.searchHistory = appState.searchHistory.filter(p => p.id !== player.id);
    
    // 将新玩家添加到历史记录的开头
    appState.searchHistory.unshift({
        id: player.id,
        username: player.username,
        avatar_url: player.avatar_url
    });

    // 限制历史记录最多10条
    if (appState.searchHistory.length > 10) {
        appState.searchHistory = appState.searchHistory.slice(0, 10);
    }
    
    // 保存到 localStorage 并重新渲染
    localStorage.setItem('osuSearchHistory', JSON.stringify(appState.searchHistory));
    renderSearchHistory();
}

/**
 * 从 localStorage 加载搜索历史
 */
function loadSearchHistory() {
    const history = localStorage.getItem('osuSearchHistory');
    if (history) {
        appState.searchHistory = JSON.parse(history);
        renderSearchHistory();
    }
}

/**
 * 处理用户搜索
 */
async function handleSearch() {
    const query = dom.usernameInput.value.trim();
    if (!query) { 
        displayError("请输入玩家名称或ID。"); 
        return; 
    }
    if (!dom.clientIdInput.value || !dom.clientSecretInput.value) {
        displayError("请输入您的客户端ID和客户端密钥。");
        showKeySetupUI(true);
        return;
    }
    
    setLoading(true, `正在加载玩家信息...`, true);
    resetPlayerData();
    
    try {
        const player = await fetchV2Api(`users/${query}/osu`);
        if (player === null) { 
            setLoading(false); 
            displayError(`未找到玩家 "${query}"。请检查拼写或ID是否正确。`);
            return; 
        }
        
        setCurrentPlayer(player);
        addToSearchHistory(player); // 添加到历史记录
        dom.searchHistoryContainer.classList.add('hidden'); // 搜索后隐藏历史列表
        setRecentPlaysLoaded(false);
        dom.recentPlaysDiv.innerHTML = '';
        [dom.recentPlaysControls, dom.recentPpGainDisplay].forEach(el => el.classList.add('hidden'));

        dom.refreshRecentPlaysBtn.classList.add('hidden');

        setLoading(true, `正在加载 ${player.username} 的 Top Plays...`);
        
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
            const plays = topPlaysData
                .map((play, index) => ({
                    playData: play,
                    beatmapData: beatmapMap.get(play.beatmap.id) || play.beatmap,
                    beatmapsetData: play.beatmapset,
                    originalIndex: index
                }))
                .filter(detail => detail.beatmapData && detail.beatmapsetData);
            
            setOriginalTopPlays(plays);
            setProcessedPlaysForChart([...plays]);
            
            updateSortHeadersUI();
            renderFilteredAndSortedTopPlays();
            dom.topPlaysSortAndFilterControls.classList.remove('hidden');
            dom.filteredPpDisplay.classList.remove('hidden');
        } else {
            dom.topPlaysDiv.innerHTML = '<p class="opacity-70 text-center p-4">该玩家暂无最佳表现记录。</p>';
            [dom.topPlaysSortAndFilterControls, dom.filteredPpDisplay].forEach(el => el.classList.add('hidden'));
        }
        
        dom.topPlaysAnalysisSection.classList.toggle('hidden', !originalTopPlaysDetails.length);
        if (originalTopPlaysDetails.length) {
            renderAllEmbeddedCharts(originalTopPlaysDetails); 
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


/**
 * 刷新最近的 plays
 */
async function handleRecentPlaysRefresh() {
    if (!currentPlayer) return;

    const btn = dom.refreshRecentPlaysBtn;
    btn.disabled = true;
    btn.innerHTML = '🔄 刷新中...';

    try {
        const existingPlayIds = new Set(recentPlaysDetails.map(d => d.playData.id));
        if (existingPlayIds.size === 0) {
            await fetchAndRenderRecentPlays();
            showToast("已加载最新成绩。");
            return;
        }

        let newPlays = [];
        let foundExisting = false;
        let offset = 0;
        const limit = 50;

        while (!foundExisting && offset < 500) { // Safety break after 10 pages
            const recentData = await fetchV2Api(`users/${currentPlayer.id}/scores/recent?include_fails=1&limit=${limit}&offset=${offset}&mode=osu`);
            if (!recentData || recentData.length === 0) break; 

            for (const play of recentData) {
                if (existingPlayIds.has(play.id)) {
                    foundExisting = true;
                    break;
                }
                newPlays.push(play);
            }
            if (recentData.length < limit) break;
            offset += limit;
        }

        if (newPlays.length > 0) {
            const newPlayIds = newPlays.map(p => p.beatmap.id);
            let beatmapMap = new Map();
            if (newPlayIds.length > 0) {
                 const idsQuery = newPlayIds.map(id => `ids[]=${id}`).join('&');
                 const fullBeatmapsData = await fetchV2Api(`beatmaps?${idsQuery}`);
                 if (fullBeatmapsData?.beatmaps) {
                     beatmapMap = new Map(fullBeatmapsData.beatmaps.map(b => [b.id, b]));
                 }
            }

            const topPlaysMap = new Map(originalTopPlaysDetails.map(p => [p.playData.id, p]));

            const newPlaysDetails = newPlays.map(play => {
                const isBp = play.best_id && topPlaysMap.has(play.best_id);
                const bpDetails = isBp ? topPlaysMap.get(play.best_id) : null;
                return {
                    playData: bpDetails ? bpDetails.playData : play,
                    beatmapData: beatmapMap.get(play.beatmap.id) || play.beatmap,
                    beatmapsetData: play.beatmapset,
                    isBp: isBp,
                    bpDetails: bpDetails,
                };
            }).filter(detail => detail.beatmapData && detail.beatmapsetData);

            const combinedPlays = [...newPlaysDetails, ...recentPlaysDetails];
            combinedPlays.forEach((d, i) => d.recentIndex = i); // Re-index all
            setRecentPlays(combinedPlays);

            renderFilteredRecentPlays();
            showToast(`找到了 ${newPlays.length} 个新成绩！`);

            setTimeout(() => {
                const allCards = dom.recentPlaysDiv.querySelectorAll('.glass-card');
                for (let i = 0; i < newPlays.length; i++) {
                    if (allCards[i]) {
                        allCards[i].classList.add('flash-bg-animation', 'flash-glow-animation');
                    }
                }
            }, 100);

        } else {
            showToast("没有新的成绩。");
        }

    } catch (error) {
        console.error("刷新最近成绩时出错:", error);
        showToast(`刷新失败: ${error.message}`);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '🔄 刷新';
    }
}

// --- 密钥管理 ---
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

// --- 事件监听器设置 ---
function setupEventListeners() {
    dom.usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

    dom.usernameInput.addEventListener('focus', () => {
        if (appState.searchHistory.length > 0) {
            dom.searchHistoryContainer.classList.remove('hidden');
        }
    });

    dom.usernameInput.addEventListener('blur', () => {
        // 延迟隐藏，以便能成功触发历史项的点击事件
        setTimeout(() => {
            dom.searchHistoryContainer.classList.add('hidden');
        }, 150);
    });

    // 对历史容器的点击监听
    dom.searchHistoryContainer.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.history-item-delete');
        const mainContent = e.target.closest('.history-item-main');

        if (deleteButton) {
            // 如果点击的是删除按钮
            const playerId = deleteButton.dataset.id;
            removeFromSearchHistory(playerId);
            // 阻止事件冒泡，防止触发 mainContent 的点击
            e.stopPropagation(); 
        } else if (mainContent) {
            // 如果点击的是玩家信息区域
            dom.searchHistoryContainer.classList.add('hidden');
            const username = mainContent.dataset.username;
            dom.usernameInput.value = username;
            handleSearch();
        }
    });

    dom.searchButton.addEventListener('click', handleSearch);

    dom.toggleSearchBtn.addEventListener('click', () => {
        const isHidden = dom.searchCard.classList.toggle('hidden');
        if (!isHidden) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            dom.usernameInput.focus();
        }
    });

    dom.sourceToggleBtn.addEventListener('click', () => {
        const newSource = downloadSource === 'nerinyan' ? 'osudirect' : 'nerinyan';
        setDownloadSource(newSource);
        updateDownloadLinks();
        showToast(`已切换下载源至: ${DOWNLOAD_SOURCE_INFO[newSource].name}`);
    });

    dom.changeKeyBtn.addEventListener('click', () => {
        setAccessToken(null, 0);
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
            const pageId = link.dataset.page;
            
            if (pageId === 'recentPlaysSection' && !recentPlaysLoaded) {
                setRecentPlaysLoaded(true); // 标记为已开始加载
                dom.recentPlaysControls.classList.remove('hidden');
                dom.recentPlaysLoader.innerHTML = `<button id="loadMoreBtn" class="btn-primary">加载更多</button>`;
                dom.recentPlaysLoader.classList.remove('hidden');
                dom.refreshRecentPlaysBtn.classList.remove('hidden');
                loadMoreRecentPlays(); // 首次加载第一页数据
            }
            showPage(pageId);
        });
    });

    dom.recentPlaysLoader.addEventListener('click', (e) => {
        // 确保只有在点击按钮时才触发
        if (e.target && e.target.id === 'loadMoreBtn') {
            loadMoreRecentPlays();
        }
    });    

    document.querySelectorAll('.sort-header[data-sort]').forEach(header => {
        header.addEventListener('click', () => {
            const sortKey = header.dataset.sort;
            if (appState.sortCriteria === sortKey) {
                appState.sortOrder = appState.sortOrder === 'desc' ? 'asc' : 'desc';
            } else {
                appState.sortCriteria = sortKey;
                appState.sortOrder = 'desc';
            }
            updateSortHeadersUI();
            renderFilteredAndSortedTopPlays();
        });
    });

    dom.modMatchToggle.addEventListener('click', () => {
        appState.modMatchMode = appState.modMatchMode === 'contains' ? 'exact' : 'contains';
        dom.modMatchToggle.textContent = appState.modMatchMode === 'contains' ? '包含' : '完全一致';
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
            appState.activeModFilters = Array.from(document.querySelectorAll('input[name="modFilter"]:checked')).map(cb => cb.value);
            renderFilteredAndSortedTopPlays();
        });
    });

    dom.fcFilter.addEventListener('change', (e) => {
        appState.fcFilterStatus = e.target.value;
        renderFilteredAndSortedTopPlays();
    });
    
    dom.selectAllCheckbox.addEventListener('change', (e) => {
        dom.topPlaysDiv.querySelectorAll('.glass-card').forEach(card => card.classList.toggle('selected', e.target.checked));
    });
    
    dom.downloadSelectedBtn.addEventListener('click', () => {
        const baseUrl = DOWNLOAD_SOURCE_INFO[appState.downloadSource].url;
        const ids = [...new Set(Array.from(dom.topPlaysDiv.querySelectorAll('.glass-card.selected')).map(c => c.dataset.beatmapsetId).filter(Boolean))];
        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        ids.forEach(id => window.open(`${baseUrl}${id}`, '_blank'));
    });

    // Recent Plays Controls
    dom.recentPassOnlyCheckbox.addEventListener('change', (e) => {
        appState.recentPassOnly = e.target.checked;
        renderFilteredRecentPlays();
    });
    
    dom.recentBpOnlyCheckbox.addEventListener('change', (e) => {
        appState.recentBpOnly = e.target.checked;
        renderFilteredRecentPlays();
    });
    
    dom.recentSelectAllCheckbox.addEventListener('change', (e) => {
        dom.recentPlaysDiv.querySelectorAll('.glass-card').forEach(card => card.classList.toggle('selected', e.target.checked));
    });

    dom.recentDownloadSelectedBtn.addEventListener('click', () => {
        const baseUrl = DOWNLOAD_SOURCE_INFO[appState.downloadSource].url;
        const ids = [...new Set(Array.from(dom.recentPlaysDiv.querySelectorAll('.glass-card.selected')).map(c => c.dataset.beatmapsetId).filter(Boolean))];
        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        ids.forEach(id => window.open(`${baseUrl}${id}`, '_blank'));
    });

    dom.refreshRecentPlaysBtn.addEventListener('click', handleRecentPlaysRefresh);

    setupAudioPlayerListeners();
    setupPpCalculatorListeners();
}

// --- 应用初始化 ---
document.addEventListener('DOMContentLoaded', async () => {
    try {
        await init('./rosu_pp_js/rosu_pp_js_bg.wasm');
        console.log("rosu-pp-js Wasm 模块已加载");
    } catch (error) {
        console.error("加载 rosu-pp-js Wasm 模块失败:", error);
        displayError("错误: 无法加载 PP 计算模块。请刷新页面重试。");
        return;
    }
    
    setupCredentials();
    createPpCalculatorControls();
    initializePpCalculatorMods();
    setupEventListeners();
    setupBackgroundAnimation();

    loadSearchHistory();
    
    setupDragToSelect({ container: dom.topPlaysDiv, selectAllCheckbox: dom.selectAllCheckbox });
    setupDragToSelect({ container: dom.recentPlaysDiv, selectAllCheckbox: dom.recentSelectAllCheckbox });
});
