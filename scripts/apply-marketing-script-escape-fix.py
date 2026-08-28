from pathlib import Path

ROOT = Path('.')


def replace_once(path: str, old: str, new: str) -> None:
    p = ROOT / path
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one match, found {count}: {old!r}')
    p.write_text(text.replace(old, new, 1))


# marketingManagerHtml() is itself a TypeScript template literal that emits browser JS.
# Browser-side \n escapes therefore need TWO backslashes in the TypeScript source.
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    "val.join('\\n')",
    "val.join('\\\\n')",
)
replace_once(
    'src/dashboard/marketingManagerHtml.ts',
    "raw.split(/[,;\\n]/)",
    "raw.split(/[,;\\\\n]/)",
)

# Add an actual syntax-parse regression for the generated browser script.
p = ROOT / 'tests/marketingManagerUploadState.test.ts'
text = p.read_text()
if 'node:vm' not in text:
    text = text.replace(
        'import assert from "node:assert/strict";\n',
        'import assert from "node:assert/strict";\nimport { Script } from "node:vm";\n',
        1,
    )

marker = 'test("generated Marketing Manager browser script is valid JavaScript"'
if marker not in text:
    text += '''\n\ntest("generated Marketing Manager browser script is valid JavaScript", () => {\n  const html = marketingManagerHtml();\n  const match = html.match(/<script>([\\s\\S]*?)<\\/script>/);\n  const browserScript = match?.[1];\n  if (!browserScript) assert.fail("expected inline Marketing Manager script");\n  assert.doesNotThrow(() => new Script(browserScript));\n});\n'''
p.write_text(text)

print('Marketing Manager browser-script escaping fixed and parse regression added.')
