#!/bin/bash

echo "=== Construyendo Con Sazón Gestión ==="
echo ""

# Build the app with updater signing
echo "1. Construyendo la aplicación..."
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/con-sazon-gestion.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" \
npm run tauri build -- --target x86_64-pc-windows-gnu

echo ""
echo "=== Build completado ==="
echo ""
echo "Archivos generados en: src-tauri/target/x86_64-pc-windows-gnu/release/bundle/nsis/"
echo ""
echo "Para publicar en GitHub Releases:"
echo ""
echo "1. Crea una nueva release en tu repositorio de GitHub (tag: v0.2.0)"
echo "2. Sube estos archivos:"
echo "   - con-sazon-gestion_0.2.0_x64-setup.exe (instalador)"
echo "   - con-sazon-gestion_0.2.0_x64-setup.exe.sig (firma)"
echo ""
echo "3. Crea un archivo latest.json con este formato:"
echo ""
echo '{'
echo '  "version": "0.2.0",'
echo '  "notes": "Nueva versión",'
echo '  "pub_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",'
echo '  "platforms": {'
echo '    "windows-x86_64": {'
echo '      "signature": "<contenido del .sig>",'
echo '      "url": "https://github.com/campillo/con-sazon-gestion/releases/download/v0.2.0/con-sazon-gestion_0.2.0_x64-setup.exe"'
echo '    }'
echo '  }'
echo '}'
echo ""
echo "4. Sube latest.json a la release"
echo ""
echo "¡Listo! La app se actualizará automáticamente cuando los usuarios la inicien."