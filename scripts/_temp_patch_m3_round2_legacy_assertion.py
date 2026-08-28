from pathlib import Path

p = Path("tests/productionOrchestrator.test.ts")
text = p.read_text()
old = '''    assert.match(prompts[0]!, /Layout composition requirements:/);\n    assert.match(prompts[0]!, /upper-left/);\n    assert.match(prompts[1]!, /message zone is visually cluttered/);\n'''
new = '''    assert.match(prompts[0]!, /Layout composition requirements:/);\n    assert.match(prompts[0]!, /large uninterrupted area for minimal headline treatment/);\n    assert.doesNotMatch(prompts[0]!, /main food subject/);\n    assert.match(prompts[1]!, /message zone is visually cluttered/);\n'''
if text.count(old) != 1:
    raise SystemExit(f"expected one old DINE_IN composition assertion, found {text.count(old)}")
p.write_text(text.replace(old, new, 1))
print("legacy DINE_IN renderer assertion updated")
