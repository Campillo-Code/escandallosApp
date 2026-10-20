import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const TERRACOTTA = { r: 122, g: 45, b: 24 }; // #7A2D18 (color exacto del logo)
const CREAM = { r: 247, g: 239, b: 225 }; // #F7EFE1

// Bbox de la nube dentro de public/images/logo.png (4500x4501), sin el texto
const CLOUD_CROP = { left: 1394, top: 1422, width: 1711, height: 1079 };
const LOGO = path.join(root, "public", "images", "logo.png");

async function cloudBuffer(color, padding = 0.06) {
  // Recorta la nube y la recolorea conservando la transparencia
  const { data, info } = await sharp(LOGO)
    .extract(CLOUD_CROP)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += info.channels) {
    out[i] = color.r;
    out[i + 1] = color.g;
    out[i + 2] = color.b;
    out[i + 3] = data[i + 3];
  }
  // Añade aire alrededor del contenido para centrarlo mejor
  const w = info.width;
  const h = info.height;
  const padX = Math.round(w * padding);
  const padY = Math.round(h * padding);
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .extend({
      top: padY,
      bottom: padY,
      left: padX,
      right: padX,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
}

async function roundedSquare(size, radius, background) {
  const svg = `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="rgb(${background.r},${background.g},${background.b})"/></svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function compose(size, radius, background, cloud, cloudWidthPct) {
  const cw = Math.round(size * cloudWidthPct);
  const cloudImg = await sharp(cloud)
    .resize({ width: cw })
    .png()
    .toBuffer();
  const bg = await roundedSquare(size, radius, background);
  return sharp(bg)
    .composite([{ input: cloudImg, gravity: "center" }])
    .png()
    .toBuffer();
}

// Maestro 1024: fondo terracota + nube crema (icono de app / taskbar / título)
const creamCloud = await cloudBuffer(CREAM);
const master = await compose(1024, 190, TERRACOTTA, creamCloud, 0.66);
await sharp(master).toFile(path.join(root, "assets", "app-icon-1024.png"));

// Favicon
await sharp(master).resize(64, 64).toFile(path.join(root, "public", "images", "favicon-64.png"));

// Sidebar: nube terracota sobre cuadrado crema redondeado
const terracottaCloud = await cloudBuffer(TERRACOTTA);
const sidebar = await compose(256, 56, CREAM, terracottaCloud, 0.78);
await sharp(sidebar).toFile(path.join(root, "public", "images", "logo-sidebar.png"));

console.log("OK: assets/app-icon-1024.png, public/images/favicon-64.png, public/images/logo-sidebar.png");
