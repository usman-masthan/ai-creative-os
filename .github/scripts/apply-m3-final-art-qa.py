from pathlib import Path

p = Path('src/commands/producePlannedCampaign.ts')
t = p.read_text()

old = '''  baseImagePath?: string;\n  visualQaContext?: PlannedVisualQaContext | undefined;\n'''
new = '''  baseImagePath?: string;\n  visualQaContext?: PlannedVisualQaContext | undefined;\n  finalArtQa?: ProducePosterRequest["finalArtQa"];\n'''
assert old in t
t = t.replace(old, new, 1)

old = '''    baseImagePath: current.path,\n    ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),\n    ...(featureFlags.useNewRenderer && lastQa?.compositionEvidence\n'''
new = '''    baseImagePath: current.path,\n    finalArtQaRequired: true,\n    ...(request.finalArtQa ? { finalArtQa: request.finalArtQa } : {}),\n    ...(featureFlags.useNewRenderer ? { rendererMode: "M3_V2" as const } : {}),\n    ...(featureFlags.useNewRenderer && lastQa?.compositionEvidence\n'''
assert old in t
t = t.replace(old, new, 1)

p.write_text(t)
