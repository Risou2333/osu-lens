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
import { openDownloadLink } from './utils.js';

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
    
    dom.usernameInput.classList.remove('input-error');

    if (!query) {
        showToast("请输入玩家名称或ID。");
        dom.usernameInput.classList.add('input-error');
        return;
    }
    if (!dom.clientIdInput.value || !dom.clientSecretInput.value) {
        showToast("请输入您的客户端ID和客户端密钥。");
        showKeySetupUI(true);
        return;
    }

    const initialActivePage = appState.activePage;
    
    // 【核心修改】无条件调用 setLoading，并设置全局状态
    setLoading(true, `正在加载 ${query} 的数据...`, true);
    appState.isPlayerSearchActive = true;
    resetPlayerData();

    try {
        const player = await fetchV2Api(`users/${query}/osu`);

        if (player === null) {
            setLoading(false); // 在 finally 前手动关闭，因为会提前 return
            appState.isPlayerSearchActive = false;
            showToast(`未找到玩家 "${query}"`);
            dom.usernameInput.classList.add('input-error');
            dom.usernameInput.value = '';
            return;
        }
        
        setCurrentPlayer(player);
        addToSearchHistory(player);
        dom.searchHistoryContainer.classList.add('hidden');
        // ... (函数其余的成功逻辑保持不变)

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
        
        showPage('playerInfoSection');

    } catch (error) {
        console.error("处理玩家数据时出错:", error);
        showToast(`处理玩家数据时出错: ${error.message}`);
        dom.usernameInput.classList.add('input-error');
        dom.usernameInput.value = '';
    } finally {
        // 【核心修改】使用 finally 块确保状态总是被重置
        setLoading(false); 
        appState.isPlayerSearchActive = false;
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
            // 【修改】调用正确的函数来加载最近成绩
            await loadMoreRecentPlays();
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

    const bdom = dom.beatmapSearchPage;
    const query = String(bdom.queryInput.value).trim();
    const resultsContainer = bdom.resultsContainer;

    appState.isFetchingBeatmaps = true;

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
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    try {
        // --- 核心修改：在这里构建包含状态参数的请求 ---
        const searchParams = {
            keywords: query,
            mode: 0,
        };

        // 仅当筛选状态不是默认的"拥有排行榜"（空字符串）时，才添加categories参数
        if (appState.beatmapStatusFilter) {
            searchParams.categories = appState.beatmapStatusFilter;
        }

        if (isLoadMore && appState.beatmapSearchCursor) {
            searchParams.cursor_string = appState.beatmapSearchCursor;
        }
        
        const result = await searchBeatmapsets(searchParams);

        const loader = resultsContainer.querySelector('.beatmap-loader');
        if (loader) loader.remove();

        if (!isLoadMore) {
            resultsContainer.innerHTML = '';
        }

        if (result && result.beatmapsets && result.beatmapsets.length > 0) {
            const cardsHTML = result.beatmapsets.map(createBeatmapsetCardHTML).join('');
            resultsContainer.insertAdjacentHTML('beforeend', cardsHTML);
            appState.beatmapSearchCursor = result.cursor_string;

            // --- 如果返回的谱面数少于预期，说明是最后一页 ---
            if (result.beatmapsets.length < 50) { // osu! api v2 默认每页返回 50 个
                 appState.beatmapSearchCursor = null;
                 const noMoreResults = document.createElement('p');
                 noMoreResults.className = 'opacity-70 text-center p-4';
                 noMoreResults.style.gridColumn = '1 / -1';
                 noMoreResults.textContent = '没有更多了';
                 resultsContainer.appendChild(noMoreResults);
            }
        } else {
            appState.beatmapSearchCursor = null;
            if (!isLoadMore) {
                resultsContainer.innerHTML = '<p class="opacity-70 text-center p-4" style="grid-column: 1 / -1;">没有找到相关的谱面。</p>';
            } else {
                // --- 新增代码：在加载更多时，如果没有结果，则显示提示 ---
                const noMoreResults = document.createElement('p');
                noMoreResults.className = 'opacity-70 text-center p-4';
                noMoreResults.style.gridColumn = '1 / -1';
                noMoreResults.textContent = '没有更多了';
                resultsContainer.appendChild(noMoreResults);
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
    
    dom.usernameInput.addEventListener('focus', () => {
        if (appState.searchHistory.length > 0) {
            dom.searchHistoryContainer.classList.remove('hidden');
        }
    });

    dom.usernameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            dom.searchHistoryContainer.classList.add('hidden');

            const button = dom.searchButton;
            button.classList.add('animate-flash');
            button.addEventListener('animationend', () => {
                button.classList.remove('animate-flash');
            }, { once: true });
            
            handleSearch();
        }
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

    dom.searchButton.addEventListener('click', () => {
        dom.searchHistoryContainer.classList.add('hidden');

        dom.searchButton.classList.add('animate-flash');
        dom.searchButton.addEventListener('animationend', () => {
            dom.searchButton.classList.remove('animate-flash');
        }, { once: true });
        
        handleSearch();
    });

    dom.toggleSearchBtn.addEventListener('click', () => {
        const wasSearchCardVisible = !dom.searchCard.classList.contains('hidden');
        hideAllContentSections(); 

        if (wasSearchCardVisible) {
            if (currentPlayer) {
                showPage('playerInfoSection'); 
            }
        } else {
            dom.searchCard.classList.remove('hidden'); 
            window.scrollTo({ top: 0, behavior: 'smooth' }); 
            dom.usernameInput.focus(); 
            dom.toggleSearchBtn.classList.add('active');
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

            // 【核心代码】如果正在加载玩家数据，则阻止所有导航链接的点击
            if (appState.isPlayerSearchActive) {
                showToast("请等待当前玩家数据加载完成");
                return; // 中断后续所有操作
            }

            // --- 加载状态结束后的正常逻辑 ---

            // 如果是谱面搜索页，则直接显示
            if (pageId === 'beatmapSearchPage') {
                showPage(pageId);
                if (dom.beatmapSearchPage.resultsContainer.innerHTML === '' || appState.beatmapSearchCursor === null) {
                    handleBeatmapSearch();
                }
                return;
            }

            // 对于其他玩家相关的页面，检查是否已加载玩家数据
            if (currentPlayer) {
                showPage(pageId);

                // 如果是首次点击"最近游玩"，则开始加载数据
                if (pageId === 'recentPlaysSection' && !recentPlaysLoaded) {
                    setRecentPlaysLoaded(true);
                    dom.recentPlaysControls.classList.remove('hidden');
                    dom.recentPlaysLoader.innerHTML = `<button id="loadMoreBtn" class="btn-primary">加载更多</button>`;
                    dom.recentPlaysLoader.classList.remove('hidden');
                    dom.refreshRecentPlaysBtn.classList.remove('hidden');
                    loadMoreRecentPlays();
                }
            } else {
                // 如果没有玩家数据，提示用户先搜索
                showToast("请先搜索一位玩家");
                hideAllContentSections();
                dom.searchCard.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
                dom.usernameInput.focus();
                dom.toggleSearchBtn.classList.add('active');
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
        // 添加动画类
        dom.downloadSelectedBtn.classList.add('animate-flash');
        // 监听动画结束事件
        dom.downloadSelectedBtn.addEventListener('animationend', () => {
            dom.downloadSelectedBtn.classList.remove('animate-flash');
        }, { once: true });

        const baseUrl = DOWNLOAD_SOURCE_INFO[appState.downloadSource].url;
        const ids = [...new Set(Array.from(dom.topPlaysDiv.querySelectorAll('.glass-card.selected')).map(c => c.dataset.beatmapsetId).filter(Boolean))];
        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        // 使用openDownloadLink函数代替window.open
        ids.forEach(id => openDownloadLink(`${baseUrl}${id}`));
        showToast(`正在下载${ids.length}个谱面...`);
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
        // 添加动画类
        dom.recentDownloadSelectedBtn.classList.add('animate-flash');
        // 监听动画结束事件
        dom.recentDownloadSelectedBtn.addEventListener('animationend', () => {
            dom.recentDownloadSelectedBtn.classList.remove('animate-flash');
        }, { once: true });

        const baseUrl = DOWNLOAD_SOURCE_INFO[appState.downloadSource].url;
        const ids = [...new Set(Array.from(dom.recentPlaysDiv.querySelectorAll('.glass-card.selected')).map(c => c.dataset.beatmapsetId).filter(Boolean))];
        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        // 使用openDownloadLink函数代替window.open
        ids.forEach(id => openDownloadLink(`${baseUrl}${id}`));
        showToast(`正在下载${ids.length}个谱面...`);
    });

    dom.refreshRecentPlaysBtn.addEventListener('click', () => {
        // 添加动画类
        dom.refreshRecentPlaysBtn.classList.add('animate-flash');
        // 监听动画结束事件
        dom.refreshRecentPlaysBtn.addEventListener('animationend', () => {
            dom.refreshRecentPlaysBtn.classList.remove('animate-flash');
        }, { once: true });

        handleRecentPlaysRefresh();
    });

    setupAudioPlayerListeners();
    setupPpCalculatorListeners();

    dom.beatmapSearchPage.searchBtn.addEventListener('click', () => {
        // 添加动画类
        dom.beatmapSearchPage.searchBtn.classList.add('animate-flash');
        // 监听动画结束事件
        dom.beatmapSearchPage.searchBtn.addEventListener('animationend', () => {
            dom.beatmapSearchPage.searchBtn.classList.remove('animate-flash');
        }, { once: true });

        handleBeatmapSearch();
    });
    dom.beatmapSearchPage.queryInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            // --- 新增代码：触发"搜索"按钮的动画 ---
            const button = dom.beatmapSearchPage.searchBtn;
            button.classList.add('animate-flash');
            button.addEventListener('animationend', () => {
                button.classList.remove('animate-flash');
            }, { once: true });
            // --- 新增代码结束 ---
            
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

        // 【修改】如果正在拖拽选择，则禁用滚轮切换难度的功能
        if (document.body.classList.contains('is-drag-selecting')) {
            return;
        }

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
        // 为所有卡片上的按钮添加点击动画效果
        const button = e.target.closest('.download-btn, .pp-calc-btn');
        if (button) {
            button.classList.add('animate-flash');
            button.addEventListener('animationend', () => {
                button.classList.remove('animate-flash');
            }, { once: true });
        }

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

        const statusFiltersContainer = document.getElementById('beatmapStatusFilters');

    // 辅助函数：更新筛选按钮的激活状态
    const updateStatusFiltersUI = () => {
        statusFiltersContainer.querySelectorAll('.sort-header').forEach(header => {
            header.classList.toggle('active', header.dataset.status === appState.beatmapStatusFilter);
        });
    };

    // 为筛选栏绑定点击事件
    statusFiltersContainer.addEventListener('click', (e) => {
        const targetHeader = e.target.closest('.sort-header');
        if (targetHeader && !targetHeader.classList.contains('active')) {
            appState.beatmapStatusFilter = targetHeader.dataset.status;
            updateStatusFiltersUI();
            handleBeatmapSearch(); // 点击后立即执行搜索
        }
    });

    // 为"全选"复选框添加事件监听
    document.getElementById('beatmapSelectAllCheckbox').addEventListener('change', (e) => {
        dom.beatmapSearchPage.resultsContainer.querySelectorAll('.beatmap-card').forEach(card => {
            card.classList.toggle('selected', e.target.checked);
        });
    });

    // 为"下载选中"按钮添加事件监听
    document.getElementById('beatmapDownloadSelectedBtn').addEventListener('click', () => {
        // 添加动画类
        document.getElementById('beatmapDownloadSelectedBtn').classList.add('animate-flash');
        // 监听动画结束事件
        document.getElementById('beatmapDownloadSelectedBtn').addEventListener('animationend', () => {
            document.getElementById('beatmapDownloadSelectedBtn').classList.remove('animate-flash');
        }, { once: true });

        const baseUrl = DOWNLOAD_SOURCE_INFO[appState.downloadSource].url;
        
        // 从选中的卡片中提取 beatmapset ID
        const ids = [...new Set(
            Array.from(dom.beatmapSearchPage.resultsContainer.querySelectorAll('.beatmap-card.selected'))
                 .map(card => card.querySelector('.beatmap-card__actions')?.dataset.beatmapset)
                 .filter(Boolean) // 过滤掉无效数据
                 .map(json => JSON.parse(json).id)
        )];

        if (ids.length === 0) {
            showToast('请先选择要下载的谱面');
            return;
        }
        
        // 使用openDownloadLink函数代替window.open
        ids.forEach(id => openDownloadLink(`${baseUrl}${id}`));
        showToast(`正在下载${ids.length}个谱面...`);
    });

    // --- 新增代码：当用户在玩家输入框中输入时，移除错误状态 ---
    dom.usernameInput.addEventListener('input', () => {
        dom.usernameInput.classList.remove('input-error');
    });    

    // 为📎图标添加点击事件监听器，显示toast提示
    document.querySelectorAll('.custom-tooltip-container .cursor-pointer').forEach(icon => {
        icon.addEventListener('click', () => {
            showToast('请允许浏览器同时打开多个窗口！');
        });
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
    setupDragToSelect({
        container: dom.beatmapSearchPage.resultsContainer,
        selectAllCheckbox: document.getElementById('beatmapSelectAllCheckbox'),
        cardSelector: '.beatmap-card' // 指定要选择的卡片类名
    });
});
