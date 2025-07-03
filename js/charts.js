/*
 * js/charts.js
 *
 * 包含所有 Chart.js 相关的图表渲染逻辑，用于可视化玩家数据。
 */

import { chartCanvases, dom } from './dom.js';
import { activeCharts, appState } from './state.js';
import { formatNumber, calculateAverage, calculateVariance } from './utils.js';
import { renderFilteredAndSortedTopPlays, showPage } from './ui.js';

function getChartColors() {
    const palette = [
        'rgba(255, 105, 180, 0.8)', 'rgba(78, 186, 255, 0.8)', 'rgba(255, 206, 86, 0.8)', 
        'rgba(119, 221, 119, 0.8)', 'rgba(204, 150, 255, 0.8)', 'rgba(75, 192, 192, 0.8)',
        'rgba(255, 138, 101, 0.8)'
    ];
    return {
        gridColor: 'rgba(224, 224, 224, 0.2)', tickColor: '#e0e0e0', titleColor: '#ff85c1',
        legendLabelColor: '#e0e0e0', tooltipBgColor: '#1a1a2e', tooltipBorderColor: '#ff69b4',
        fcColor: 'rgba(34, 197, 94, 0.7)', missColor: 'rgba(239, 68, 68, 0.7)',
        pieChartColors: palette, mapperColors: palette,
        primaryColor: 'rgba(255, 105, 180, 0.7)', otherMapperColor: 'rgba(156, 163, 175, 0.7)'
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
                appState.modMatchMode = 'exact';
                dom.modMatchToggle.textContent = '完全一致';
                document.querySelectorAll('input[name="modFilter"]').forEach(cb => cb.checked = false);
                
                const modsToTick = (modString === 'NM') ? ['NM'] : (modString.match(/.{1,2}/g) || []);
                modsToTick.forEach(mod => {
                    const cb = document.querySelector(`input[name="modFilter"][value="${mod === 'NC' ? 'DT' : mod}"]`);
                    if (cb) cb.checked = true;
                });

                appState.activeModFilters = Array.from(document.querySelectorAll('input[name="modFilter"]:checked')).map(cb => cb.value);
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

function groupDataForPie(details, grouperFn, sorterFn) {
    const stats = details.reduce((acc, detail) => {
        const playMods = detail.playData.mods;
        const sortedMods = [...playMods].sort().join('');
        const key = grouperFn(detail, sortedMods);
        if (!acc[key]) acc[key] = { count: 0, totalWeightedPp: 0 };
        acc[key].count++;
        acc[key].totalWeightedPp += (parseFloat(detail.playData.pp) || 0) * (0.95 ** detail.originalIndex);
        return acc;
    }, {});

    let sorted = Object.entries(stats);

    if (sorterFn) {
        sorted.sort(sorterFn);
    } else {
        sorted.sort(([,a], [,b]) => b.count - a.count);
    }

    return {
        labels: sorted.map(([label]) => label),
        values: sorted.map(([, stats]) => stats.count),
        ppValues: sorted.map(([, stats]) => stats.totalWeightedPp)
    };
}

export function renderAllEmbeddedCharts(playDetails) { 
    if (!playDetails?.length) return;
    
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

    const rankOrder = ['X', 'XH', 'S', 'SH', 'A', 'B', 'C', 'D', 'F'];
    const rankSorter = (a, b) => {
        const indexA = rankOrder.indexOf(a[0]);
        const indexB = rankOrder.indexOf(b[0]);
        return indexA - indexB;
    };

    createPieChart('rankPie', groupDataForPie(playDetails, d => d.playData.rank.toUpperCase(), rankSorter));
    createPieChart('modsPie', groupDataForPie(playDetails, (d, sortedMods) => sortedMods || 'NM'));
    
    const lenRanges = [ [0,60,'0-1:00'], [61,120,'1-2:00'], [121,180,'2-3:00'], [181,240,'3-4:00'], [241,300,'4-5:00'], [301,Infinity,'5:00+'] ];
    const lenOrder = lenRanges.map(r => r[2]);
    const lenSorter = (a, b) => lenOrder.indexOf(a[0]) - lenOrder.indexOf(b[0]);
    
    createPieChart('lengthPie', groupDataForPie(playDetails, d => {
        const len = parseInt(d.beatmapData.total_length);
        return lenRanges.find(r => len >= r[0] && len <= r[1])[2];
    }, lenSorter));
    
    const bpmRanges = [ [0,120,'<120'], [120,150,'120-150'], [150.01,180,'151-180'], [180.01,210,'181-210'], [210.01,240,'211-240'], [240.01,Infinity,'>240'] ];
    const bpmOrder = bpmRanges.map(r => r[2]);
    const bpmSorter = (a, b) => bpmOrder.indexOf(a[0]) - bpmOrder.indexOf(b[0]);
    
    createPieChart('bpmPie', groupDataForPie(playDetails, d => {
        let bpm = parseFloat(d.beatmapData.bpm);
        const mods = d.playData.mods;

        if (mods.includes('DT') || mods.includes('NC')) {
            bpm *= 1.5;
        } else if (mods.includes('HT')) {
            bpm *= 0.75;
        }

        return bpmRanges.find(r => bpm >= r[0] && bpm <= r[1])[2];
    }, bpmSorter));
}
