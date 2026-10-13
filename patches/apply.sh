#!/bin/bash
# patches/apply.sh — run automatically by EAS
set -e

RNG="node_modules/onnxruntime-react-native"

# 1. Patch build.gradle
if [ -f "$RNG/android/build.gradle" ]; then
  python3 -c "
import pathlib, re
p = pathlib.Path('$RNG/android/build.gradle')
t = p.read_text()
t = re.sub(r'if \\(VersionNumber\\.parse.*?\\)\\s*\\{',
           'if (false) {', t)
p.write_text(t)
print('gradle patched')
"
fi

# 2. Remove unimodule.json
rm -f "$RNG/unimodule.json"

echo 'ORT patch applied'
