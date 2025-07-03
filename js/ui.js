// js/ui.js

/**
 * 包含所有核心的 UI 渲染和更新函数
 */

import { dom } from './dom.js';
import { appState, downloadSource, originalTopPlaysDetails, recentPlaysDetails } from './state.js';
import { formatNumber, formatPlaytime, formatDuration } from './utils.js';
import { DOWNLOAD_SOURCE_INFO } from './config.js';

/**
 * 渲染玩家信息
 * @param {object} player - 玩家数据对象
 */
export function renderPlayerInfo(player) {
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

/**
 * 创建单个 play 记录的 HTML 卡片
 * @param {object} play - play 数据
 * @param {object} beatmap - beatmap 数据
 * @param {object} beatmapset - beatmapset 数据
 * @param {string} type - 'top' 或 'recent'
 * @param {number} index - 索引
 * @param {boolean} isBpInRecent - 是否是在最近列表中显示 BP
 * @returns {string} HTML 字符串
 */
export function createPlayCardHTML(play, beatmap, beatmapset, type, index, isBpInRecent = false) {
    if (!play || !beatmap || !beatmapset) return '';
    const rank = play.rank.toUpperCase();
    const songTitle = `${beatmapset.artist} - ${beatmapset.title}`;
    const isFc = play.perfect && play.statistics.count_miss === 0;

    const ppValue = parseFloat(play.pp) || 0;
    const isTopPlay = type === 'top' || isBpInRecent;
    const weightedPp = isTopPlay ? (ppValue * (0.95 ** index)) : 0;
    const extraClasses = isBpInRecent ? 'bp-highlight' : '';
    
    const playDate = new Date(play.created_at);
    const dateString = playDate.toLocaleDateString('sv-SE'); // 格式: YYYY-MM-DD
    const timeString = playDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }); // 格式: HH:mm
    const fullDateTimeString = `${dateString} ${timeString}`;
    
    const ppAndDateHTML = isTopPlay
        ? `<div class="text-center">
                <span class="text-xs opacity-60">${fullDateTimeString}</span>
                <div class="mt-1">
                    <p class="text-xl sm:text-2xl pp-display leading-tight">${ppValue.toFixed(0)}</p>
                    <p class="text-xs opacity-80 leading-tight">(${(weightedPp).toFixed(1)})</p>
                    <p class="pp-label leading-tight">PP</p>
                </div>
           </div>`
        : `<div class="text-center">
                <span class="text-xs opacity-60">${fullDateTimeString}</span>
                <p class="text-xl sm:text-2xl pp-display mt-1">${play.pp ? play.pp.toFixed(0) : '?'}</p>
                <p class="pp-label">PP</p>
           </div>`;

    const downloadUrl = `${DOWNLOAD_SOURCE_INFO[downloadSource].url}${beatmap.beatmapset_id || beatmapset.id}`;
    const cardId = isBpInRecent ? `recent-bp-play-${index}` : `${type}-play-${index}`;
    
    const playJson = JSON.stringify(play).replace(/'/g, "&apos;");
    const beatmapJson = JSON.stringify(beatmap).replace(/'/g, "&apos;");
    const beatmapsetJson = JSON.stringify(beatmapset).replace(/'/g, "&apos;");
    
    return `
        <div id="${cardId}" class="glass-card p-2 flex items-stretch space-x-3 ${extraClasses}" style="--bg-image-url: url('${beatmapset.covers.card}')" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}">
            <div class="beatmap-cover-container" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}" data-song-title="${songTitle}">
                <img src="${beatmapset.covers.cover}" alt="谱面封面" class="beatmap-cover" onerror="this.onerror=null;this.src='https://placehold.co/100x70/2a2a4e/e0e0e0?text=无封面';">
                ${isTopPlay ? `<div class="bp-indicator">BP ${index + 1}</div>` : ''}
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
            <div class="flex-shrink-0 ml-auto flex flex-col justify-between items-center p-1">
                ${ppAndDateHTML}
                <div class="flex items-center gap-2">
                     <button class="pp-calc-btn download-btn" data-play='${playJson}' data-beatmap='${beatmapJson}' data-beatmapset='${beatmapsetJson}' title="分析此成绩">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M12 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h8zM4 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H4z"/><path d="M4 2.5a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 .5.5v2a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-2zm0 4a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm3-6a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1zm0 3a.5.5 0 0 1 .5-.5h1a.5.5 0 0 1 .5.5v4a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-4z"/></svg>
                     </button>
                     <a href="osu://b/${beatmap.id}" title="在游戏中打开" class="download-btn"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM6.79 5.093A.5.5 0 0 0 6 5.5v5a.5.5 0 0 0 .79.407l3.5-2.5a.5.5 0 0 0 0-.814l-3.5-2.5z"/></svg></a>
                     <a href="${downloadUrl}" data-beatmapset-id="${beatmap.beatmapset_id || beatmapset.id}" target="_blank" rel="noopener noreferrer" title="下载铺面" class="download-btn beatmap-download-link"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16"><path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/><path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/></svg></a>
                </div>
            </div>
        </div>
    `;
}

/**
 * 渲染经过筛选的最近 plays
 */
export function renderFilteredRecentPlays() {
    if (!recentPlaysDetails?.length) return;

    let playsToDisplay = [...recentPlaysDetails];

    if (appState.recentPassOnly) {
        playsToDisplay = playsToDisplay.filter(d => d.playData.rank !== 'F');
    }
    if (appState.recentBpOnly) {
        playsToDisplay = playsToDisplay.filter(d => d.isBp);
    }
    
    dom.recentPlaysDiv.innerHTML = playsToDisplay.length
        ? playsToDisplay.map(d => {
            if (d.isBp) {
                return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'top', d.bpDetails.originalIndex, true);
            } else {
                return createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'recent', d.recentIndex);
            }
        }).join('')
        : '<p class="opacity-70 text-center p-4">没有符合筛选条件的最近游玩记录。</p>';
    
    dom.recentSelectAllCheckbox.checked = false;
}

/**
 * 切换和显示指定页面
 * @param {string} pageId - 要显示的页面元素的 ID
 */
export function showPage(pageId) {
    appState.activePage = pageId;
    document.querySelectorAll('.page-content').forEach(page => {
        page.classList.toggle('hidden', page.id !== pageId);
    });
    document.querySelectorAll('#navLinksContainer .nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.page === pageId);
    });
}

/**
 * 渲染经过筛选和排序的 Top Plays
 */
export function renderFilteredAndSortedTopPlays() {
    if (!originalTopPlaysDetails?.length) return;

    let playsToDisplay = [...originalTopPlaysDetails];
    
    if (appState.activeModFilters.length) {
        playsToDisplay = playsToDisplay.filter(detail => {
            const playMods = detail.playData.mods.length ? detail.playData.mods : ['NM'];
            const filterMods = appState.activeModFilters;
            
            if (filterMods.includes('NM') && playMods.includes('NM')) return true;
            if (filterMods.includes('NM') && !playMods.includes('NM')) return false;

            const normalizedPlayMods = playMods.map(m => m === 'NC' ? 'DT' : m);

            if (appState.modMatchMode === 'exact') {
                 const normalizedFilterMods = filterMods.map(m => m === 'NC' ? 'DT' : m).sort();
                 return JSON.stringify(normalizedPlayMods.sort()) === JSON.stringify(normalizedFilterMods);
            }
            return filterMods.every(filterMod =>
                (filterMod === 'DT' && (normalizedPlayMods.includes('DT'))) ||
                (filterMod !== 'DT' && normalizedPlayMods.includes(filterMod))
            );
        });
    }

    if (appState.fcFilterStatus !== 'all') {
        playsToDisplay = playsToDisplay.filter(d => {
            const isFc = d.playData.perfect && d.playData.statistics.count_miss === 0;
            return appState.fcFilterStatus === 'fc' ? isFc : !isFc;
        });
    }
    
    const totalFilteredWeightedPp = playsToDisplay.reduce((sum, d) => sum + (parseFloat(d.playData.pp) || 0) * (0.95 ** d.originalIndex), 0);
    dom.filteredPpDisplay.querySelector('span').textContent = formatNumber(totalFilteredWeightedPp, {maximumFractionDigits: 0});

    const sortFns = {
        accuracy: (a, b) => (a.playData.accuracy || 0) - (b.playData.accuracy || 0),
        difficulty: (a, b) => (a.beatmapData.difficulty_rating || 0) - (b.beatmapData.difficulty_rating || 0),
        length: (a, b) => (a.beatmapData.total_length || 0) - (b.beatmapData.total_length || 0),
        date: (a, b) => new Date(a.playData.created_at) - new Date(b.playData.created_at),
        pp: (a, b) => (a.playData.pp || 0) - (b.playData.pp || 0),
    };
    playsToDisplay.sort((a, b) => {
        const order = appState.sortOrder === 'asc' ? 1 : -1;
        return (sortFns[appState.sortCriteria] || sortFns.pp)(a, b) * order;
    });

    dom.selectAllCheckbox.checked = false;
    dom.topPlaysDiv.innerHTML = playsToDisplay.length 
        ? playsToDisplay.map(d => createPlayCardHTML(d.playData, d.beatmapData, d.beatmapsetData, 'top', d.originalIndex)).join('')
        : '<p class="opacity-70 text-center p-4">没有符合筛选条件的 Top Plays。</p>';
}

/**
 * 更新排序表头的 UI（箭头和高亮）
 */
export function updateSortHeadersUI() {
    document.querySelectorAll('.sort-header[data-sort]').forEach(header => {
        const arrowSpan = header.querySelector('.sort-arrow');
        if (header.dataset.sort === appState.sortCriteria) {
            header.classList.add('active');
            if(arrowSpan) arrowSpan.textContent = appState.sortOrder === 'desc' ? '▼' : '▲';
        } else {
            header.classList.remove('active');
            if(arrowSpan) arrowSpan.textContent = '';
        }
    });
}

/**
 * 更新所有下载链接的下载源
 */
export function updateDownloadLinks() {
    const newBaseUrl = DOWNLOAD_SOURCE_INFO[downloadSource].url;
    document.querySelectorAll('.beatmap-download-link').forEach(link => {
        const beatmapsetId = link.dataset.beatmapsetId;
        if (beatmapsetId) {
            link.href = `${newBaseUrl}${beatmapsetId}`;
        }
    });
}

/**
 * 显示首次设置 API 密钥的 UI
 * @param {boolean} isFirstTime - 是否是首次设置
 */
export function showKeySetupUI(isFirstTime) {
    dom.credentialsContainer.classList.remove('hidden');
    dom.keyManagementContainer.classList.add('hidden');
    dom.userSearchArea.classList.add('hidden');
    if (isFirstTime) {
        dom.keySetupInstructions.classList.remove('hidden');
    }
}

/**
 * 显示已保存密钥的管理 UI
 */
export function showKeyManagementUI() {
    dom.credentialsContainer.classList.add('hidden');
    dom.keyManagementContainer.classList.remove('hidden');
    dom.keySetupInstructions.classList.add('hidden');
    dom.userSearchArea.classList.remove('hidden');
}
