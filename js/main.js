/*
 * js/main.js
 *
 * 应用主入口文件。负责导入所有模块，初始化应用，并编排核心业务逻辑和事件监听。
 */

import init from '../rosu_pp_js/rosu_pp_js.js';
import { dom } from './dom.js';
import { 
    appState, downloadSource, currentPlayer, recentPlaysLoaded, originalTopPlaysDetails, recentPlaysDetails,
    setAccessToken, setDownloadSource, setCurrentPlayer, setRecentPlaysLoaded, 
    setOriginalTopPlays, setRecentPlays, setProcessedPlaysForChart, resetPlayerData
} from './state.js';
import { DOWNLOAD_SOURCE_INFO } from './config.js';
import { getAccessToken, fetchV2Api, searchBeatmapsets } from './api.js';
import { setupDragToSelect, setupBackgroundAnimation, showToast, setLoading, displayError } from './ui-helpers.js';
import { renderAllEmbeddedCharts } from './charts.js';
import { setupAudioPlayerListeners } from './audio-player.js';
import { createPpCalculatorControls, initializePpCalculatorMods, setupPpCalculatorListeners, openPpCalculatorForBeatmap } from './pp-calculator.js';
import { renderPlayerInfo, renderFilteredAndSortedTopPlays, renderFilteredRecentPlays, showPage, updateSortHeadersUI, updateDownloadLinks, showKeySetupUI, showKeyManagementUI, createPlayCardHTML, createBeatmapsetCardHTML, hideAllContentSections } from './ui.js';

async function loadMoreRecentPlays() {
    if (appState.isFetchingRecentPlays || appState.allRecentPlaysLoaded || !currentPlayer) return;

    appState.isFetchingRecentPlays = true;
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
            
            const newCardsHTML = newPlayDetails.map(d => {
                 if (d.isBp) {
                    return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'top', d.bpDetails.originalIndex, true);
                } else {
                    return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'recent', d.recentIndex);
                }
            }).join('');
            dom.recentPlaysDiv.insertAdjacentHTML('beforeend', newCardsHTML);

            setRecentPlays([...recentPlaysDetails, ...newPlayDetails]);
            appState.recentPlaysOffset += playsPage.length;

            if (playsPage.length < limit || appState.recentPlaysOffset >= 500) {
                appState.allRecentPlaysLoaded = true;
                const message = appState.recentPlaysOffset >= 500 ? '已达到 API 查询上限 (500条记录)。' : '没有更多成绩了。';
                dom.recentPlaysLoader.innerHTML = `<p class="opacity-70">${message}</p>`;
            } else {
                 dom.recentPlaysLoader.innerHTML = `<button id="loadMoreBtn" class="btn-primary">加载更多</button>`;
            }
        } else {
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
        appState.allRecentPlaysLoaded = true;
    } finally {
        appState.isFetchingRecentPlays = false;
    }
}

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
    dom.searchHistoryContainer.classList.remove('hidden');
}

function removeFromSearchHistory(playerId) {
    appState.searchHistory = appState.searchHistory.filter(p => p.id.toString() !== playerId.toString());
    localStorage.setItem('osuSearchHistory', JSON.stringify(appState.searchHistory));
    renderSearchHistory();
    if(appState.searchHistory.length === 0) {
        dom.searchHistoryContainer.classList.add('hidden');
    }
}

function addToSearchHistory(player) {
    appState.searchHistory = appState.searchHistory.filter(p => p.id !== player.id);
    appState.searchHistory.unshift({
        id: player.id,
        username: player.username,
        avatar_url: player.avatar_url
    });

    if (appState.searchHistory.length > 10) {
        appState.searchHistory = appState.searchHistory.slice(0, 10);
    }
    
    localStorage.setItem('osuSearchHistory', JSON.stringify(appState.searchHistory));
    renderSearchHistory();
}

function loadSearchHistory() {
    const history = localStorage.getItem('osuSearchHistory');
    if (history) {
        appState.searchHistory = JSON.parse(history);
        renderSearchHistory();
    }
}

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
        addToSearchHistory(player);
        dom.searchHistoryContainer.classList.add('hidden');
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

        while (!foundExisting && offset < 500) {
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
            combinedPlays.forEach((d, i) => d.recentIndex = i);
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

async function handleBeatmapSearch(isLoadMore = false) {
    if (isLoadMore && (appState.isFetchingBeatmaps || !appState.beatmapSearchCursor)) {
        return;
    }

    appState.isFetchingBeatmaps = true;
    const bdom = dom.beatmapSearchPage;
    const query = bdom.queryInput.value.trim();
    const resultsContainer = bdom.resultsContainer;

    if (isLoadMore) {
        const loader = document.createElement('div');
        loader.className = 'beatmap-loader text-center p-4';
        loader.style.gridColumn = '1 / -1';
        loader.innerHTML = `<div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style="border-color: var(--primary-color); border-top-color: transparent;"></div>`;
        resultsContainer.appendChild(loader);
    } else {
        appState.beatmapSearchCursor = null;
        resultsContainer.className = 'beatmap-grid-container';
        resultsContainer.innerHTML = `<div class="text-center p-4" style="grid-column: 1 / -1;"><div class="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2" style="border-color: var(--primary-color); border-top-color: transparent;"></div><p class="mt-2">正在搜索...</p></div>`;
    }

    try {
        const result = await searchBeatmapsets(query, 'last_updated_desc', appState.beatmapSearchCursor);
        
        const loader = resultsContainer.querySelector('.beatmap-loader');
        if (loader) loader.remove();
        
        if (!isLoadMore) {
            resultsContainer.innerHTML = '';
        }

        if (result && result.beatmapsets && result.beatmapsets.length > 0) {
            const cardsHTML = result.beatmapsets.map(createBeatmapsetCardHTML).join('');
            resultsContainer.insertAdjacentHTML('beforeend', cardsHTML);
            
            appState.beatmapSearchCursor = result.cursor_string;
        } else {
            appState.beatmapSearchCursor = null;
            if (!isLoadMore) {
                resultsContainer.innerHTML = '<p class="opacity-70 text-center p-4" style="grid-column: 1 / -1;">没有找到相关的谱面。</p>';
            }
        }
    } catch (error) {
        console.error("谱面搜索失败:", error);
        resultsContainer.innerHTML = `<p class="text-red-400 text-center p-4" style="grid-column: 1 / -1;">搜索失败: ${error.message}</p>`;
    } finally {
        appState.isFetchingBeatmaps = false;
    }
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

function setupEventListeners() {
    dom.usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

    let historyHideTimeout;

    dom.usernameInput.addEventListener('focus', () => {
        clearTimeout(historyHideTimeout);
        if (appState.searchHistory.length > 0) {
            dom.searchHistoryContainer.classList.remove('hidden');
        }
    });

    dom.usernameInput.addEventListener('blur', () => {
        historyHideTimeout = setTimeout(() => {
            dom.searchHistoryContainer.classList.add('hidden');
        }, 150);
    });

    dom.searchHistoryContainer.addEventListener('click', (e) => {
        const deleteButton = e.target.closest('.history-item-delete');
        const mainContent = e.target.closest('.history-item-main');

        if (deleteButton) {
            const playerId = deleteButton.dataset.id;
            removeFromSearchHistory(playerId);
            e.stopPropagation(); 
        } else if (mainContent) {
            dom.searchHistoryContainer.classList.add('hidden');
            const username = mainContent.dataset.username;
            dom.usernameInput.value = username;
            handleSearch();
        }
    });

    dom.searchButton.addEventListener('click', handleSearch);

    dom.toggleSearchBtn.addEventListener('click', () => {
        // 在切换前，先检查搜索框当前是否可见
        const wasSearchCardVisible = !dom.searchCard.classList.contains('hidden');

        hideAllContentSections(); // 统一隐藏所有主要内容区域，确保只显示一个

        if (wasSearchCardVisible) {
            // 如果搜索框之前是可见的，说明用户想隐藏它。
            // 隐藏所有后，决定默认显示哪个页面。
            // 如果有已加载的玩家数据，则显示玩家信息页面。
            if (currentPlayer) {
                showPage('playerInfoSection'); // 这会显示玩家信息页面并激活其导航链接
            }
            // 如果没有 currentPlayer，所有区域将保持隐藏状态（由 hideAllContentSections 处理），这对于初始状态是合适的。
        } else {
            // 如果搜索框之前是隐藏的，说明用户想显示它。
            dom.searchCard.classList.remove('hidden'); // 显示搜索框
            window.scrollTo({ top: 0, behavior: 'smooth' }); // 滚动到顶部
            dom.usernameInput.focus(); // 聚焦输入框
            // 激活“搜索”按钮图标本身
            dom.toggleSearchBtn.classList.add('active');
            // 其他导航链接的非激活状态已由 hideAllContentSections 处理
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

            if (pageId === 'beatmapSearchPage') {
                // 对于谱面搜索页，直接调用 showPage
                showPage(pageId);
                // 仅在首次进入谱面搜索页或需要刷新时触发搜索
                if (dom.beatmapSearchPage.resultsContainer.innerHTML === '' || appState.beatmapSearchCursor === null) {
                    handleBeatmapSearch();
                }
                return;
            }

            if (currentPlayer) {
                // 如果已加载玩家数据，则正常显示对应页面
                showPage(pageId);

                if (pageId === 'recentPlaysSection' && !recentPlaysLoaded) {
                    setRecentPlaysLoaded(true);
                    dom.recentPlaysControls.classList.remove('hidden');
                    dom.recentPlaysLoader.innerHTML = `<button id="loadMoreBtn" class="btn-primary">加载更多</button>`;
                    dom.recentPlaysLoader.classList.remove('hidden');
                    dom.refreshRecentPlaysBtn.classList.remove('hidden');
                    loadMoreRecentPlays();
                }
            } else {
                // 如果没有玩家数据，提示用户先搜索，并显示搜索框
                showToast("请先搜索一位玩家");
                hideAllContentSections(); // 隐藏所有内容
                dom.searchCard.classList.remove('hidden'); // 显示搜索框
                window.scrollTo({ top: 0, behavior: 'smooth' });
                dom.usernameInput.focus();
                dom.toggleSearchBtn.classList.add('active'); // 激活搜索按钮
            }
        });
    });


    dom.recentPlaysLoader.addEventListener('click', (e) => {
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

    dom.beatmapSearchPage.searchBtn.addEventListener('click', handleBeatmapSearch);
    dom.beatmapSearchPage.queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleBeatmapSearch();
        }
    });

    window.addEventListener('scroll', () => {
        if (appState.activePage !== 'beatmapSearchPage' || appState.isFetchingBeatmaps) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
        
        if (scrollTop + clientHeight >= scrollHeight - 300) {
            handleBeatmapSearch(true);
        }
    });

    document.body.addEventListener('wheel', e => {
        const bar = e.target.closest('.beatmap-card__difficulty-bar');
        if (!bar) return;

        e.preventDefault();

        const indicators = Array.from(bar.querySelectorAll('.difficulty-indicator'));
        if (indicators.length <= 1) return;

        const currentIndex = indicators.findIndex(ind => ind.classList.contains('is-selected'));
        indicators[currentIndex].classList.remove('is-selected');

        let nextIndex;
        if (e.deltaY < 0) {
            nextIndex = (currentIndex - 1 + indicators.length) % indicators.length;
        } else {
            nextIndex = (currentIndex + 1) % indicators.length;
        }

        indicators[nextIndex].classList.add('is-selected');

    }, { passive: false });

    document.body.addEventListener('click', e => {
        const calcTrigger = e.target.closest('.card-pp-calc-trigger');
        if (!calcTrigger) return;

        const actionsContainer = calcTrigger.closest('.beatmap-card__actions');
        const card = actionsContainer.closest('.beatmap-card');
        const selectedIndicator = card.querySelector('.difficulty-indicator.is-selected');

        if (actionsContainer && selectedIndicator) {
            try {
                const beatmapsetData = JSON.parse(actionsContainer.dataset.beatmapset);
                const beatmapData = JSON.parse(selectedIndicator.dataset.beatmap);
                
                openPpCalculatorForBeatmap(beatmapData, beatmapsetData);

            } catch (error) {
                console.error("打开PP计算器失败:", error);
            }
        }
    });
}

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
