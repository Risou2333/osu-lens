#!/usr/bin/env python3
from pathlib import Path

path = Path('js/pp-calculator.js')
text = path.read_text(encoding='utf-8')
original = text

text = text.replace(
    'perfConfig.hitresultPriority = rosu.HitResultPriority.Fastest;',
    'perfConfig.hitresultPriority = rosu.HitResultPriority.BestCase;'
)

needle = '        perf = new rosu.Performance(perfConfig);\n        perfAttrs = perf.calculate(diffAttrs);'
replacement = '''        perf = new rosu.Performance(perfConfig);\n        if (typeof perf.setHitresultGenerator === 'function' && rosu.HitResultGenerator) {\n            perf.setHitresultGenerator(rosu.HitResultGenerator.Fast, rosu.GameMode.Osu);\n        }\n        perfAttrs = perf.calculate(diffAttrs);'''
if needle in text:
    text = text.replace(needle, replacement, 1)

needle = '        calculatorState.currentMap = new rosu.Beatmap(osuFileContent);\n        calculatorState.currentBeatmapData = beatmapData;'
replacement = '''        calculatorState.currentMap = new rosu.Beatmap(osuFileContent);\n        if (typeof calculatorState.currentMap.isSuspicious === 'function' && calculatorState.currentMap.isSuspicious()) {\n            const suspiciousMap = calculatorState.currentMap;\n            calculatorState.currentMap = null;\n            suspiciousMap.free();\n            throw new Error('谱面结构异常，已停止 PP 计算。');\n        }\n        calculatorState.currentBeatmapData = beatmapData;'''
if needle in text:
    text = text.replace(needle, replacement, 1)

text = text.replace(
    '    let difficulty, perf, diffAttrs, perfAttrs, mapAttrs;',
    '    let difficulty, perf, diffAttrs, perfAttrs, mapAttrs, attrBuilder, pfcPerfAttrs;'
)
text = text.replace(
    '        const attrBuilder = new rosu.BeatmapAttributesBuilder({ map: calculatorState.currentMap, mods, lazer });',
    '        attrBuilder = new rosu.BeatmapAttributesBuilder({ map: calculatorState.currentMap, mods, lazer });'
)
text = text.replace(
    '        const pfcPerfAttrs = pfcPerf.calculate(diffAttrs);',
    '        pfcPerfAttrs = pfcPerf.calculate(diffAttrs);'
)

needle = '''        if (difficulty) difficulty.free();\n        if (perf) perf.free();\n        if (mapAttrs) mapAttrs.free();'''
replacement = '''        if (difficulty) difficulty.free();\n        if (perf) perf.free();\n        if (perfAttrs) perfAttrs.free();\n        if (pfcPerfAttrs) pfcPerfAttrs.free();\n        if (mapAttrs) mapAttrs.free();\n        if (attrBuilder) attrBuilder.free();'''
if needle in text:
    text = text.replace(needle, replacement, 1)

if text == original:
    print('pp-calculator.js already patched or source layout did not require changes.')
else:
    path.write_text(text, encoding='utf-8')
    print('pp-calculator.js patched for rosu-pp-js v4.0.1.')
