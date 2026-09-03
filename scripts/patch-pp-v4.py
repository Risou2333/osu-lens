#!/usr/bin/env python3
from pathlib import Path

path = Path('js/pp-calculator.js')
text = path.read_text(encoding='utf-8')
original = text

# rosu-pp-js v4 removed HitResultPriority.Fastest.
text = text.replace(
    'perfConfig.hitresultPriority = rosu.HitResultPriority.Fastest;',
    'perfConfig.hitresultPriority = rosu.HitResultPriority.BestCase;'
)

# Validate the upstream response before handing anything to Rust/WASM. This prevents
# an HTML/SVG/error response from being parsed as a beatmap and producing opaque
# wasm-bindgen pointer errors.
needle = '''            osuFileContent = await response.text();\n            calculatorState.osuFileCache.set(beatmapData.id, osuFileContent);'''
replacement = '''            osuFileContent = await response.text();\n            const looksLikeOsuFile = /^osu file format v\\d+/m.test(osuFileContent) && osuFileContent.includes('[HitObjects]');\n            if (!looksLikeOsuFile) {\n                const preview = osuFileContent.trim().slice(0, 80).replace(/\\s+/g, ' ');\n                throw new Error(`谱面文件响应异常${preview ? `: ${preview}` : ''}`);\n            }\n            calculatorState.osuFileCache.set(beatmapData.id, osuFileContent);'''
if needle in text and 'const looksLikeOsuFile' not in text:
    text = text.replace(needle, replacement, 1)

# Passing bytes is the most predictable path through wasm-bindgen across browsers.
text = text.replace(
    '        calculatorState.currentMap = new rosu.Beatmap(osuFileContent);',
    '        calculatorState.currentMap = new rosu.Beatmap(new TextEncoder().encode(osuFileContent));'
)

# Guard suspicious maps before any expensive calculations.
needle = '        calculatorState.currentMap = new rosu.Beatmap(new TextEncoder().encode(osuFileContent));\n        calculatorState.currentBeatmapData = beatmapData;'
replacement = '''        calculatorState.currentMap = new rosu.Beatmap(new TextEncoder().encode(osuFileContent));\n        if (typeof calculatorState.currentMap.isSuspicious === 'function' && calculatorState.currentMap.isSuspicious()) {\n            const suspiciousMap = calculatorState.currentMap;\n            calculatorState.currentMap = null;\n            suspiciousMap.free();\n            throw new Error('谱面结构异常，已停止 PP 计算。');\n        }\n        calculatorState.currentBeatmapData = beatmapData;'''
if needle in text and "throw new Error('谱面结构异常，已停止 PP 计算。');" not in text:
    text = text.replace(needle, replacement, 1)

# Keep difficulty attributes for UI display, but do not reuse their wasm wrapper for
# Performance calculations. v4 accepts Beatmap directly and recalculates difficulty
# internally; this avoids stale/freed wrapper pointers on repeated calculations.
text = text.replace(
    '        perfAttrs = perf.calculate(diffAttrs);',
    '        perfAttrs = perf.calculate(calculatorState.currentMap);'
)
text = text.replace(
    '        const pfcPerfAttrs = pfcPerf.calculate(diffAttrs);',
    '        const pfcPerfAttrs = pfcPerf.calculate(calculatorState.currentMap);'
)
text = text.replace(
    '        pfcPerfAttrs = pfcPerf.calculate(diffAttrs);',
    '        pfcPerfAttrs = pfcPerf.calculate(calculatorState.currentMap);'
)

# The v4 constructor already defaults to the Fast hitresult generator. Avoid an
# unnecessary post-construction wasm setter call that adds another pointer boundary.
generator_block = '''        if (typeof perf.setHitresultGenerator === 'function' && rosu.HitResultGenerator) {\n            perf.setHitresultGenerator(rosu.HitResultGenerator.Fast, rosu.GameMode.Osu);\n        }\n'''
text = text.replace(generator_block, '')

# Track and release v4 wrapper objects created during each recalculation.
text = text.replace(
    '    let difficulty, perf, diffAttrs, perfAttrs, mapAttrs;',
    '    let difficulty, perf, diffAttrs, perfAttrs, mapAttrs, attrBuilder, pfcPerfAttrs;'
)
text = text.replace(
    '        const attrBuilder = new rosu.BeatmapAttributesBuilder({ map: calculatorState.currentMap, mods, lazer });',
    '        attrBuilder = new rosu.BeatmapAttributesBuilder({ map: calculatorState.currentMap, mods, lazer });'
)
text = text.replace(
    '        const pfcPerfAttrs = pfcPerf.calculate(calculatorState.currentMap);',
    '        pfcPerfAttrs = pfcPerf.calculate(calculatorState.currentMap);'
)

needle = '''        if (difficulty) difficulty.free();\n        if (perf) perf.free();\n        if (mapAttrs) mapAttrs.free();'''
replacement = '''        if (difficulty) difficulty.free();\n        if (perf) perf.free();\n        if (perfAttrs) perfAttrs.free();\n        if (pfcPerfAttrs) pfcPerfAttrs.free();\n        if (mapAttrs) mapAttrs.free();\n        if (attrBuilder) attrBuilder.free();'''
if needle in text:
    text = text.replace(needle, replacement, 1)

if text == original:
    print('pp-calculator.js already patched or source layout did not require changes.')
else:
    path.write_text(text, encoding='utf-8')
    print('pp-calculator.js patched for rosu-pp-js v4.0.1 (safe beatmap path).')
