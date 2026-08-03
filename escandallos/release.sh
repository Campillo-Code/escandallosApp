#!/bin/bash

set -e

if [ -z "$1" ]; then
  echo "Uso: ./release.sh <versión>"
  echo "Ejemplo: ./release.sh 0.3.0"
  exit 1
fi

VERSION="$1"
REPO="Campillo-Code/escandallosApp"
EXE="con-sazon-gestion_${VERSION}_x64-setup.exe"
SIG="${EXE}.sig"
BUNDLE_DIR="src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis"

echo "=== Publicando v${VERSION} ==="

# 1. Actualizar versión en tauri.conf.json
echo "1. Actualizando versión..."
sed -i "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" src-tauri/tauri.conf.json

# 2. Build
echo "2. Construyendo..."
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/con-sazon-gestion.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build -- --target x86_64-pc-windows-gnu

# 3. Tag y push
echo "3. Creando tag..."
git add -A
git commit -m "v${VERSION}" || true
git tag -a "v${VERSION}" -m "v${VERSION}"
git push origin "v${VERSION}"

# 4. Crear release con gh
echo "4. Creando release en GitHub..."
gh release create "v${VERSION}" \
  "${BUNDLE_DIR}/${EXE}" \
  "${BUNDLE_DIR}/${SIG}" \
  --title "v${VERSION}" \
  --generate-notes

# 5. Actualizar latest.json
echo "5. Actualizando latest.json..."
SIG_CONTENT=$(cat "${BUNDLE_DIR}/${SIG}")
cat > latest.json << EOF
{
  "version": "${VERSION}",
  "notes": "Actualización a v${VERSION}",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "windows-x86_64": {
      "signature": "${SIG_CONTENT}",
      "url": "https://github.com/${REPO}/releases/download/v${VERSION}/${EXE}"
    }
  }
}
EOF

# 6. Subir latest.json a la release
echo "6. Subiendo latest.json..."
gh release upload "v${VERSION}" latest.json --clobber

echo ""
echo "=== ¡Listo! v${VERSION} publicada ==="
echo "https://github.com/${REPO}/releases/tag/v${VERSION}"
