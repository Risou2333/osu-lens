// js/pp-calculator.js

// PP 计算器核心逻辑
import init, * as rosu from '../../rosu_pp_js/rosu_pp_js.js';
import { dom } from './dom.js';
import { calculatorState } from './state.js';
import { MODS_ENUM, CORS_PROXY_URL } from './config.js';

// 创建 PP 计算器的所有控制滑块和输入框
export function createPpCalculatorControls() {
    const createSlider = (id, label, min, max, step, value, isHidden = false) => {
        const wrapper = document.createElement('div');
        wrapper.id = `pp-calc-${id}-wrapper`;
        wrapper.className = 'grid items-center';
        if (isHidden) wrapper.classList.add('hidden');
        const labelEl = document.createElement('label');
        labelEl.htmlFor = `pp-calc-${id}-slider`;
        labelEl.className = 'text-sm font-medium text-right opacity-80';
        labelEl.textContent = label;
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.id = `pp-calc-${id}-slider`;
        slider.min = min;
        slider.max = max;
        slider.step = step;
        slider.value = value;
        slider.className = 'pp-calc-input-slider';
        const inputWrapper = document.createElement('div');
        inputWrapper.className = 'flex items-center';
        const input = document.createElement('input');
        input.type = 'number';
        input.id = `pp-calc-${id}-input`;
        input.min = min;
        input.max = max;
        input.step = step;
        input.value = value;
        input.className = 'pp-calc-input-number w-full p-2 bg-gray-700 rounded-l-md text-center border border-gray-600 border-r-0 focus:outline-none focus:ring-0';
        const buttonContainer = document.createElement('div');
        buttonContainer.className = 'flex flex-col';
        const upButton = document.createElement('button');
        upButton.type = 'button';
        upButton.className = 'pp-calc-stepper-btn rounded-tr-md border-b-0';
        upButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 15l7-7 7 7" /></svg>`;
        const downButton = document.createElement('button');
        downButton.type = 'button';
        downButton.className = 'pp-calc-stepper-btn rounded-br-md';
        downButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M19 9l-7 7-7-7" /></svg>`;
        const performStep = (direction) => {
            if (slider.disabled) return;
            if (direction === 'up' && ['n100', 'n50', 'miss'].includes(id)) {
                const n300Input = document.getElementById('pp-calc-n300-input');
                if (n300Input && (parseInt(n300Input.value, 10) || 0) <= 0) return;
            }
            const currentValue = parseFloat(input.value) || 0;
            const stepValue = parseFloat(input.step);
            let newValue = direction === 'up' ? Math.min(parseFloat(input.max), currentValue + stepValue) : Math.max(parseFloat(input.min), currentValue - stepValue);
            const decimals = step.toString().includes('.') ? step.toString().split('.')[1].length : 0;
            const roundedNewValue = parseFloat(newValue.toFixed(decimals));
            input.value = roundedNewValue;
            slider.value = roundedNewValue;
            handlePpCalcScoreChange(id);
        };
        let stepperTimeout, stepperInterval;
        const startStepping = (dir) => { performStep(dir); stepperTimeout = setTimeout(() => { stepperInterval = setInterval(() => performStep(dir), 100); }, 120); };
        const stopStepping = () => { clearTimeout(stepperTimeout); clearInterval(stepperInterval); };
        upButton.addEventListener('mousedown', () => startStepping('up'));
        downButton.addEventListener('mousedown', () => startStepping('down'));
        document.addEventListener('mouseup', stopStepping, true);
        wrapper.addEventListener('wheel', e => { e.preventDefault(); performStep(e.deltaY < 0 ? 'up' : 'down'); });
        buttonContainer.appendChild(upButton);
        buttonContainer.appendChild(downButton);
        inputWrapper.appendChild(input);
        inputWrapper.appendChild(buttonContainer);
        wrapper.appendChild(labelEl);
        wrapper.appendChild(slider);
        wrapper.appendChild(inputWrapper);
        dom.ppCalculator.controls.scoreSimContainer.appendChild(wrapper);
    };
    createSlider('combo', '连击数', 0, 1, 1, 0);
    createSlider('n300', '300s', 0, 1, 1, 0);
    createSlider('acc', '准确率', 0, 100, 0.01, 100);
    createSlider('n100', '100s', 0, 1, 1, 0);
    createSlider('miss', 'Misses', 0, 1, 1, 0);
    createSlider('n50', '50s', 0, 1, 1, 0);
    createSlider('sliderTicks', 'Slider Ticks', 0, 1, 1, 0, true);
    createSlider('sliderEnds', 'Slider Ends', 0, 1, 1, 0, true);
}

// 初始化 PP 计算器的 Mods 按钮
export function initializePpCalculatorMods() {
    const container = dom.ppCalculator.controls.modsContainer;
    container.innerHTML = '';
    const modLayout = ['NM', 'NF', 'EZ', 'HD', 'HR', 'DT', 'HT', 'FL', 'SO'];
    modLayout.forEach(modName => {
        if (modName === 'NM') {
            const noneButton = document.createElement('button');
            noneButton.id = 'pp-calc-mod-none';
            noneButton.textContent = 'NM';
            noneButton.className = 'pp-calc-mod-label';
            container.appendChild(noneButton);
            return;
        }
        const value = MODS_ENUM[modName];
        if (value === undefined) return;
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `pp-calc-mod-${modName}`;
        checkbox.className = 'pp-calc-mod-checkbox';
        checkbox.dataset.value = value;
        checkbox.dataset.mod = modName;
        const label = document.createElement('label');
        label.htmlFor = `pp-calc-mod-${modName}`;
        label.className = 'pp-calc-mod-label';
        label.textContent = modName === 'DT' ? 'DT/NC' : modName;
        container.appendChild(checkbox);
        container.appendChild(label);
    });
}

function handlePpCalcModConflict(clickedCheckbox) {
    if (!clickedCheckbox.checked) return;
    const modName = clickedCheckbox.dataset.mod;
    const conflicts = { 'HR': 'EZ', 'EZ': 'HR', 'DT': 'HT', 'HT': 'DT' };
    if (conflicts[modName]) {
        const conflictCheckbox = document.getElementById(`pp-calc-mod-${conflicts[modName]}`);
        if (conflictCheckbox) conflictCheckbox.checked = false;
    }
}

function handlePpCalcScoreChange(sourceId) {
    if (calculatorState.isInternalUpdate) return;
    calculatorState.isInternalUpdate = true;
    const { totalObjects, isAdvancedMode } = calculatorState;
    const n100Input = document.getElementById('pp-calc-n100-input');
    const n50Input = document.getElementById('pp-calc-n50-input');
    const missInput = document.getElementById('pp-calc-miss-input');
    if (isAdvancedMode) {
        if (['n100', 'n50', 'miss'].includes(sourceId)) {
            const n100 = parseInt(n100Input.value) || 0;
            const n50 = parseInt(n50Input.value) || 0;
            const miss = parseInt(missInput.value) || 0;
            const n300 = totalObjects - n100 - n50 - miss;
            updatePpCalcSlider('n300', Math.max(0, n300));
            updatePpCalcAccFromHits();
        }
    } else {
        if (sourceId === 'acc') {
            const acc = parseFloat(document.getElementById('pp-calc-acc-input').value);
            if (acc === 100) {
                 updatePpCalcSlider('combo', calculatorState.currentDiffAttrs.maxCombo);
                 updatePpCalcSlider('miss', 0);
            }
        }
    }
    calculatorState.isInternalUpdate = false;
    updatePpPerformance();
}

function updatePpCalcAccFromHits() {
    const n300 = parseInt(document.getElementById('pp-calc-n300-input').value) || 0;
    const n100 = parseInt(document.getElementById('pp-calc-n100-input').value) || 0;
    const n50 = parseInt(document.getElementById('pp-calc-n50-input').value) || 0;
    const miss = parseInt(document.getElementById('pp-calc-miss-input').value) || 0;
    const totalHits = n300 + n100 + n50 + miss;
    if (calculatorState.totalObjects === 0 || totalHits === 0) return;
    const acc = (n300 * 300 + n100 * 100 + n50 * 50) / (totalHits * 300) * 100;
    if (!isNaN(acc)) updatePpCalcSlider('acc', acc.toFixed(2));
}

function updatePpCalcInputStates() {
    const { isAdvancedMode } = calculatorState;
    const isAcc100 = parseFloat(document.getElementById('pp-calc-acc-input').value) === 100;
    document.getElementById('pp-calc-n300-wrapper').classList.toggle('hidden', !isAdvancedMode);
    document.getElementById('pp-calc-n100-wrapper').classList.toggle('hidden', !isAdvancedMode);
    document.getElementById('pp-calc-n50-wrapper').classList.toggle('hidden', !isAdvancedMode);
    document.getElementById('pp-calc-acc-slider').disabled = isAdvancedMode;
    document.getElementById('pp-calc-acc-input').disabled = isAdvancedMode;
    document.getElementById('pp-calc-combo-slider').disabled = !isAdvancedMode && isAcc100;
    document.getElementById('pp-calc-combo-input').disabled = !isAdvancedMode && isAcc100;
    document.getElementById('pp-calc-n300-slider').disabled = isAdvancedMode;
    document.getElementById('pp-calc-n300-input').disabled = isAdvancedMode;
    document.getElementById('pp-calc-n100-slider').disabled = !isAdvancedMode;
    document.getElementById('pp-calc-n100-input').disabled = !isAdvancedMode;
    document.getElementById('pp-calc-n50-slider').disabled = !isAdvancedMode;
    document.getElementById('pp-calc-n50-input').disabled = !isAdvancedMode;
}

export async function openPpCalculatorForBeatmap(beatmapData, beatmapsetData) {
    const defaultPlayData = {
        mods: [], accuracy: 1, max_combo: beatmapData.max_combo || 0,
        statistics: { count_miss: 0, count_100: 0, count_50: 0, },
    };
    await openPpCalculator(defaultPlayData, beatmapData, beatmapsetData);
}

async function openPpCalculator(playData, beatmapData, beatmapsetData) {
    const { modal, status, content, title } = dom.ppCalculator;
    title.textContent = `${beatmapsetData.artist} - ${beatmapsetData.title} [${beatmapData.version}]`;
    modal.classList.remove('hidden');
    content.classList.add('hidden');
    status.innerHTML = `<div class="pp-calc-loader"></div><p class="ml-2">正在获取 .osu 文件...</p>`;
    try {
        let osuFileContent;
        if (calculatorState.osuFileCache.has(beatmapData.id)) {
            osuFileContent = calculatorState.osuFileCache.get(beatmapData.id);
        } else {
            const response = await fetch(`${CORS_PROXY_URL}${encodeURIComponent(`https://osu.ppy.sh/osu/${beatmapData.id}`)}`);
            if (!response.ok) throw new Error(`获取谱面失败 (status: ${response.status})`);
            osuFileContent = await response.text();
            calculatorState.osuFileCache.set(beatmapData.id, osuFileContent);
        }
        status.innerHTML = `<div class="pp-calc-loader"></div><p class="ml-2">解析谱面中...</p>`;
        if (calculatorState.currentMap) calculatorState.currentMap.free();
        calculatorState.currentMap = new rosu.Beatmap(osuFileContent);
        calculatorState.currentBeatmapData = beatmapData;
        calculatorState.totalObjects = calculatorState.currentMap.nObjects;
        prefillCalculator(playData);
        await updatePpPerformance();
        content.classList.remove('hidden');
        status.innerHTML = '';
    } catch (error) {
        console.error("Error opening PP calculator:", error);
        status.innerHTML = `<p class="text-red-400">错误: ${error.message}</p>`;
    }
}

function prefillCalculator(playData) {
    calculatorState.isInternalUpdate = true;
    const { controls } = dom.ppCalculator;
    controls.advancedModeCheckbox.checked = calculatorState.isAdvancedMode;
    controls.modsContainer.querySelectorAll('.pp-calc-mod-checkbox').forEach(cb => cb.checked = false);
    playData.mods.forEach(modAcronym => {
        const cb = controls.modsContainer.querySelector(`#pp-calc-mod-${modAcronym.replace('NC', 'DT')}`);
        if (cb) cb.checked = true;
    });
    updatePpCalcSlider('acc', (playData.accuracy * 100).toFixed(2));
    updatePpCalcSlider('combo', playData.max_combo);
    updatePpCalcSlider('miss', playData.statistics.count_miss);
    const { count_100, count_50, count_miss } = playData.statistics;
    const n300 = calculatorState.totalObjects - count_100 - count_50 - count_miss;
    updatePpCalcSlider('n300', n300);
    updatePpCalcSlider('n100', count_100);
    updatePpCalcSlider('n50', count_50);
    controls.lazerCheckbox.checked = false;
    calculatorState.isLazerMode = false;
    document.getElementById('pp-calc-sliderTicks-wrapper').classList.add('hidden');
    document.getElementById('pp-calc-sliderEnds-wrapper').classList.add('hidden');
    updatePpCalcSlider('sliderTicks', 0);
    updatePpCalcSlider('sliderEnds', 0);
    calculatorState.isInternalUpdate = false;
    updatePpCalcInputStates();
}

function updatePpCalcSlider(id, value, max) {
    const slider = document.getElementById(`pp-calc-${id}-slider`);
    const input = document.getElementById(`pp-calc-${id}-input`);
    if (max !== undefined) {
        slider.max = max;
        input.max = max;
    }
    slider.value = value;
    input.value = value;
}

async function updatePpPerformance() {
    if (!calculatorState.currentMap || calculatorState.isInternalUpdate) return;
    calculatorState.isInternalUpdate = true;
    let difficulty, perf, diffAttrs, perfAttrs, mapAttrs;
    try {
        const { controls } = dom.ppCalculator;
        const mods = Array.from(controls.modsContainer.querySelectorAll('input:checked')).reduce((acc, cb) => acc + parseInt(cb.dataset.value), 0);
        const lazer = controls.lazerCheckbox.checked;
        difficulty = new rosu.Difficulty({ mods, lazer });
        diffAttrs = difficulty.calculate(calculatorState.currentMap);
        if (calculatorState.currentDiffAttrs) calculatorState.currentDiffAttrs.free();
        calculatorState.currentDiffAttrs = diffAttrs;
        const attrBuilder = new rosu.BeatmapAttributesBuilder({ map: calculatorState.currentMap, mods, lazer });
        mapAttrs = attrBuilder.build();
        const perfConfig = { mods, lazer };
        perfConfig.combo = parseInt(document.getElementById('pp-calc-combo-input').value);
        perfConfig.misses = parseInt(document.getElementById('pp-calc-miss-input').value);
        if (calculatorState.isAdvancedMode) {
            perfConfig.n100 = parseInt(document.getElementById('pp-calc-n100-input').value);
            perfConfig.n50 = parseInt(document.getElementById('pp-calc-n50-input').value);
            perfConfig.n300 = calculatorState.totalObjects - perfConfig.n100 - perfConfig.n50 - perfConfig.misses;
        } else {
            perfConfig.accuracy = parseFloat(document.getElementById('pp-calc-acc-input').value);
            perfConfig.hitresultPriority = rosu.HitResultPriority.Fastest;
        }
        if(lazer) {
            perfConfig.largeTickHits = parseInt(document.getElementById('pp-calc-sliderTicks-input').value);
            perfConfig.sliderEndHits = parseInt(document.getElementById('pp-calc-sliderEnds-input').value);
        }
        perf = new rosu.Performance(perfConfig);
        perfAttrs = perf.calculate(diffAttrs);
        const isLazer = controls.lazerCheckbox.checked;
        const pfcPerfConfig = { ...perfConfig, misses: 0, combo: diffAttrs.maxCombo, accuracy: 100 };
        if (isLazer) {
            pfcPerfConfig.largeTickHits = diffAttrs.nLargeTicks ?? 0;
            pfcPerfConfig.sliderEndHits = diffAttrs.nSliders ?? 0;
        }
        const pfcPerf = new rosu.Performance(pfcPerfConfig);
        const pfcPerfAttrs = pfcPerf.calculate(diffAttrs);
        document.getElementById('pp-calc-fc-pp-value').textContent = pfcPerfAttrs.pp.toFixed(2);
        pfcPerf.free();
        updatePpCalcUIDisplay(diffAttrs, perfAttrs, mapAttrs);
        if (!calculatorState.isAdvancedMode && perfAttrs.state) {
            updatePpCalcSlider('n300', perfAttrs.state.n300 ?? 0);
            updatePpCalcSlider('n100', perfAttrs.state.n100 ?? 0);
            updatePpCalcSlider('n50', perfAttrs.state.n50 ?? 0);
        }
    } catch (error) {
        console.error("Error during PP calculation:", error);
        dom.ppCalculator.pp.display.textContent = "Error";
    } finally {
        if (difficulty) difficulty.free();
        if (perf) perf.free();
        if (mapAttrs) mapAttrs.free();
        calculatorState.isInternalUpdate = false;
    }
}

function applyAttributeColor(element, baseValue, moddedValue, higherIsHarder = true) {
    element.textContent = moddedValue.toFixed(2);
    element.classList.remove('stat-value', 'stat-increase', 'stat-decrease');
    if (moddedValue > baseValue) {
        element.classList.add(higherIsHarder ? 'stat-increase' : 'stat-decrease');
    } else if (moddedValue < baseValue) {
        element.classList.add(higherIsHarder ? 'stat-decrease' : 'stat-increase');
    } else {
        element.classList.add('stat-value');
    }
}

function updatePpCalcUIDisplay(diffAttrs, perfAttrs, mapAttrs) {
    const { info, pp } = dom.ppCalculator;
    const baseMap = calculatorState.currentMap;
    info.stars.textContent = diffAttrs.stars.toFixed(2);
    info.stars.className = 'stat-value';
    info.maxCombo.textContent = diffAttrs.maxCombo;
    info.maxCombo.className = 'stat-value';
    info.nObjects.textContent = calculatorState.totalObjects;
    info.nObjects.className = 'stat-value';
    applyAttributeColor(info.ar, baseMap.ar, mapAttrs.ar, true);
    applyAttributeColor(info.od, baseMap.od, mapAttrs.od, true);
    applyAttributeColor(info.cs, baseMap.cs, mapAttrs.cs, true);
    applyAttributeColor(info.hp, baseMap.hp, mapAttrs.hp, true);
    applyAttributeColor(info.bpm, baseMap.bpm, baseMap.bpm * mapAttrs.clockRate, true);
    const n300Count = parseInt(document.getElementById('pp-calc-n300-input').value, 10) || 0;
    const n100Count = parseInt(document.getElementById('pp-calc-n100-input').value, 10) || 0;
    const n50Count = parseInt(document.getElementById('pp-calc-n50-input').value, 10) || 0;
    const missCount = parseInt(document.getElementById('pp-calc-miss-input').value, 10) || 0;
    updatePpCalcSlider('combo', document.getElementById('pp-calc-combo-input').value, diffAttrs.maxCombo);
    updatePpCalcSlider('miss', missCount, n300Count + missCount);
    updatePpCalcSlider('n100', n100Count, n300Count + n100Count);
    updatePpCalcSlider('n50', n50Count, n300Count + n50Count);
    updatePpCalcSlider('n300', n300Count, calculatorState.totalObjects);
    updatePpCalcSlider('sliderTicks', document.getElementById('pp-calc-sliderTicks-input').value, diffAttrs.nLargeTicks ?? 0);
    updatePpCalcSlider('sliderEnds', document.getElementById('pp-calc-sliderEnds-input').value, diffAttrs.nSliders ?? 0);
    pp.display.textContent = perfAttrs.pp.toFixed(2);
    pp.aim.textContent = perfAttrs.ppAim?.toFixed(2) ?? '0';
    pp.speed.textContent = perfAttrs.ppSpeed?.toFixed(2) ?? '0';
    pp.acc.textContent = perfAttrs.ppAccuracy?.toFixed(2) ?? '0';
    pp.fl.textContent = perfAttrs.ppFlashlight?.toFixed(2) ?? '0';
}

// 设置 PP 计算器事件监听器
export function setupPpCalculatorListeners() {
    dom.ppCalculator.closeBtn.addEventListener('click', () => dom.ppCalculator.modal.classList.add('hidden'));
    document.body.addEventListener('click', e => {
        const playCalcBtn = e.target.closest('.pp-calc-btn');
        const beatmapCalcBtn = e.target.closest('.pp-calc-beatmap-btn');
        if (playCalcBtn) {
            try {
                const playData = JSON.parse(playCalcBtn.dataset.play);
                const beatmapData = JSON.parse(playCalcBtn.dataset.beatmap);
                const beatmapsetData = JSON.parse(playCalcBtn.dataset.beatmapset);
                openPpCalculator(playData, beatmapData, beatmapsetData);
            } catch (error) {
                console.error("Failed to parse play calculator data:", error);
            }
        } else if (beatmapCalcBtn) {
            try {
                const beatmapData = JSON.parse(beatmapCalcBtn.dataset.beatmap);
                const beatmapsetData = JSON.parse(beatmapCalcBtn.dataset.beatmapset);
                openPpCalculatorForBeatmap(beatmapData, beatmapsetData);
            } catch (error) {
                console.error("Failed to parse beatmap calculator data:", error);
            }
        }
    });
    const { controls } = dom.ppCalculator;
    controls.lazerCheckbox.addEventListener('change', async () => {
        calculatorState.isLazerMode = controls.lazerCheckbox.checked;
        const isLazer = calculatorState.isLazerMode;
        document.getElementById('pp-calc-sliderTicks-wrapper').classList.toggle('hidden', !isLazer);
        document.getElementById('pp-calc-sliderEnds-wrapper').classList.toggle('hidden', !isLazer);
        if (isLazer) {
            if (calculatorState.currentDiffAttrs) {
                const diffAttrs = calculatorState.currentDiffAttrs;
                updatePpCalcSlider('sliderTicks', diffAttrs.nLargeTicks ?? 0);
                updatePpCalcSlider('sliderEnds', diffAttrs.nSliders ?? 0);
            }
        }
        await updatePpPerformance();
    });
    controls.advancedModeCheckbox.addEventListener('change', () => {
        calculatorState.isAdvancedMode = controls.advancedModeCheckbox.checked;
        updatePpCalcInputStates();
        updatePpPerformance();
    });
    controls.modsContainer.addEventListener('change', (e) => {
        if (e.target.classList.contains('pp-calc-mod-checkbox')) {
            handlePpCalcModConflict(e.target);
            updatePpPerformance();
        }
    });
    document.getElementById('pp-calc-mod-none').addEventListener('click', () => {
        controls.modsContainer.querySelectorAll('.pp-calc-mod-checkbox').forEach(cb => cb.checked = false);
        updatePpPerformance();
    });
    ['combo', 'acc', 'n100', 'n50', 'miss', 'sliderTicks', 'sliderEnds'].forEach(id => {
        const slider = document.getElementById(`pp-calc-${id}-slider`);
        const input = document.getElementById(`pp-calc-${id}-input`);
        slider.addEventListener('input', () => { input.value = slider.value; handlePpCalcScoreChange(id); });
        input.addEventListener('change', () => { slider.value = input.value; handlePpCalcScoreChange(id); });
    });
    const flashButton = (btn) => {
        if (btn.classList.contains('animate-flash')) return;
        btn.classList.add('animate-flash');
        btn.addEventListener('animationend', () => { btn.classList.remove('animate-flash'); }, { once: true });
    };
    const pfcBtn = document.getElementById('pp-calc-pfc-btn');
    if (pfcBtn) {
        pfcBtn.addEventListener('click', (e) => {
            flashButton(e.currentTarget);
            if (!calculatorState.currentDiffAttrs) return;
            calculatorState.isInternalUpdate = true;
            const maxCombo = calculatorState.currentDiffAttrs.maxCombo;
            updatePpCalcSlider('combo', maxCombo);
            updatePpCalcSlider('miss', 0);
            if (calculatorState.isAdvancedMode) {
                const n100 = parseInt(document.getElementById('pp-calc-n100-input').value) || 0;
                const n50 = parseInt(document.getElementById('pp-calc-n50-input').value) || 0;
                const new_n300 = calculatorState.totalObjects - n100 - n50;
                updatePpCalcSlider('n300', new_n300);
            }
            if (calculatorState.isLazerMode) {
                updatePpCalcSlider('sliderTicks', calculatorState.currentDiffAttrs.nLargeTicks ?? 0);
                updatePpCalcSlider('sliderEnds', calculatorState.currentDiffAttrs.nSliders ?? 0);
            }
            calculatorState.isInternalUpdate = false;
            updatePpPerformance();
        });
    }
    const ssFcBtn = document.getElementById('pp-calc-ss-fc-btn');
    if (ssFcBtn) {
        ssFcBtn.addEventListener('click', (e) => {
            flashButton(e.currentTarget);
            if (!calculatorState.currentDiffAttrs) return;
            calculatorState.isInternalUpdate = true;
            const maxCombo = calculatorState.currentDiffAttrs.maxCombo;
            const totalObjects = calculatorState.totalObjects;
            updatePpCalcSlider('acc', 100);
            updatePpCalcSlider('combo', maxCombo);
            updatePpCalcSlider('miss', 0);
            updatePpCalcSlider('n50', 0);
            updatePpCalcSlider('n100', 0);
            updatePpCalcSlider('n300', totalObjects);
            if (calculatorState.isLazerMode) {
                updatePpCalcSlider('sliderTicks', calculatorState.currentDiffAttrs.nLargeTicks ?? 0);
                updatePpCalcSlider('sliderEnds', calculatorState.currentDiffAttrs.nSliders ?? 0);
            }
            calculatorState.isInternalUpdate = false;
            updatePpPerformance();
        });
    }
}
