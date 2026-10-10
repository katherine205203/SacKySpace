import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const sourcePath = "/Users/katherinebui/Downloads/The Vietnam Chapter of ICF - Chapter Talk Aug 2026.pptx";
const buildDir = "/Users/katherinebui/Documents/SacKySpace/.codex-build/rebrand-v1";
const candidatePath = path.join(buildDir, "candidate.pptx");
const HOSS = "Hoss Round";
const BODY = "Plus Jakarta Sans";
const DEEP = "#212251";
const BLUE = "#2b379b";
const LIGHT = "#5778fa";
const YELLOW = "#efcb30";
const BONE = "#f8f0e4";
const WHITE = "#ffffff";

await fs.mkdir(buildDir, { recursive: true });

const presentation = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const slides = presentation.slides.items ?? [];

// Small copy cleanup for obvious template leftovers and typos. The supplied facts and numbers stay unchanged.
safeText(slides[31].shapes.items[3], "The Chapter serves as your vital bridge");
safeText(slides[29].shapes.items[7], "PRO-BONO AND CSR PROJECTS");

const darkSlides = new Set([1, 2, 24, 25, 31, 36, 50]);
const imageOnlySlides = new Set([17, 18, 19, 20, 21, 22, 23, 35, 38, 40, 41, 42, 43, 45, 46, 47, 48, 49]);
const titleSlides = new Set([3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 26, 30, 32, 33, 34, 37, 39, 44]);
const titleExact = new Set([
  "What ICF Does",
  "The ICF Ecosystem",
  "The Vietnam Chapter of ICF",
  "The Vietnam Chapter of ICF - Strategy",
  "The Vietnam Chapter of ICF – Board Team",
  "Events Photos",
  "October internal activity",
  "ANNUAL SPONSOR PACKAGES",
  "RECIPROCAL",
  "IN-KIND PARTNERSHIP",
  "A LA CARTE",
  "The Chapter serve as your vital bridge",
  "Credentialing Accelerator",
  "Exclusive Privileges",
  "New Accreditation Standards",
  "New Qualification for Coaches",
  "New Accreditation for Organizations",
]);

function getText(shape) {
  try { return String(shape.text ?? "").replace(/\u000b/g, " ").trim(); } catch { return ""; }
}

function safeStyle(shape, style) {
  try { shape.text.style = style; } catch (error) { console.warn("style warning", error.message); }
}

function safeText(shape, value) {
  try { shape.text = value; } catch (error) { console.warn("text warning", error.message); }
}

function safeFill(shape, fill) {
  try { shape.fill = fill; } catch (error) { console.warn("fill warning", error.message); }
}

function safePosition(shape, position) {
  try { shape.position = position; } catch (error) { console.warn("position warning", error.message); }
}

function safeTable(slide) {
  const table = slide.tables?.items?.[0];
  if (!table) return;
  try {
    table.getCell(0, 0).fill = DEEP;
    table.getCell(0, 1).fill = DEEP;
    table.getCell(0, 2).fill = DEEP;
    table.getCell(0, 3).fill = DEEP;
    for (let c = 0; c < 4; c++) {
      table.getCell(0, c).text.style = { typeface: BODY, fontSize: 13, bold: true, color: WHITE, autoFit: "shrinkText" };
    }
    for (let r = 1; r < 6; r++) {
      for (let c = 0; c < 4; c++) {
        const cell = table.getCell(r, c);
        cell.fill = r % 2 ? WHITE : BONE;
        cell.text.style = { typeface: BODY, fontSize: 12.5, color: DEEP, autoFit: "shrinkText" };
      }
    }
    table.borders.assign({ style: "solid", fill: "#ded5c9", width: 1 });
  } catch (error) {
    console.warn("table styling warning", error.message);
  }
}

function addRule(slide, slideNumber, y) {
  try {
    slide.shapes.add({
      geometry: "line",
      name: `brand-title-rule-${slideNumber}`,
      position: { left: 54, top: y, width: 76, height: 0 },
      fill: "none",
      line: { style: "solid", fill: YELLOW, width: 3 },
    });
  } catch (error) {
    console.warn("rule warning", error.message);
  }
}

for (let index = 0; index < slides.length; index++) {
  const slideNumber = index + 1;
  const slide = slides[index];
  slide.background.fill = darkSlides.has(slideNumber) ? DEEP : BONE;

  const shapes = slide.shapes?.items ?? [];
  for (const shape of shapes) {
    const txt = getText(shape);
    if (!txt) continue;
    safeStyle(shape, { typeface: BODY, autoFit: "shrinkText", wrap: "square" });
  }

  if (slideNumber === 1) {
    const title = shapes[0];
    safeStyle(title, { typeface: HOSS, fontSize: 46, bold: false, color: YELLOW, autoFit: "shrinkText", wrap: "square", lineSpacing: 0.95 });
    safePosition(title, { left: 72, top: 190, width: 790, height: 150 });
    continue;
  }

  if ([2, 24, 36].includes(slideNumber)) {
    const number = shapes[0];
    const sectionTitle = shapes[1];
    safeStyle(number, { typeface: HOSS, fontSize: 118, bold: false, color: LIGHT, autoFit: "shrinkText" });
    safeStyle(sectionTitle, { typeface: HOSS, fontSize: 34, bold: false, color: YELLOW, autoFit: "shrinkText", wrap: "square", lineSpacing: 0.95 });
    safePosition(sectionTitle, { left: 72, top: 170, width: 900, height: 150 });
    continue;
  }

  if (slideNumber === 25 || slideNumber === 31) {
    safeStyle(shapes[0], { typeface: HOSS, fontSize: 42, bold: false, color: WHITE, autoFit: "shrinkText" });
    safePosition(shapes[0], { left: 72, top: 220, width: 940, height: 120 });
    continue;
  }

  if (slideNumber === 50) {
    safeStyle(shapes[0], { typeface: HOSS, fontSize: 46, bold: false, color: LIGHT, autoFit: "shrinkText" });
    safeStyle(shapes[1], { typeface: BODY, fontSize: 18, color: WHITE, autoFit: "shrinkText", wrap: "square" });
    safeStyle(shapes[2], { typeface: BODY, fontSize: 14, color: YELLOW, autoFit: "shrinkText" });
    continue;
  }

  if (slideNumber === 7) {
    safeStyle(shapes[0], { typeface: HOSS, fontSize: 27, bold: false, color: DEEP, autoFit: "shrinkText", wrap: "square", lineSpacing: 1.05 });
    for (const stat of shapes.slice(1, 5)) safeStyle(stat, { typeface: HOSS, fontSize: 32, bold: false, color: YELLOW, autoFit: "shrinkText" });
    safeStyle(shapes[5], { typeface: BODY, fontSize: 12, color: BLUE, autoFit: "shrinkText" });
    continue;
  }

  if (slideNumber === 8) {
    safeStyle(shapes[0], { typeface: BODY, fontSize: 11, color: BLUE, autoFit: "shrinkText" });
    safeStyle(shapes[1], { typeface: HOSS, fontSize: 30, bold: false, color: DEEP, autoFit: "shrinkText" });
    safeTable(slide);
    addRule(slide, slideNumber, 105);
    continue;
  }

  if (slideNumber === 9) {
    safeStyle(shapes[0], { typeface: HOSS, fontSize: 27, bold: false, color: WHITE, autoFit: "shrinkText", wrap: "square", lineSpacing: 0.95 });
    continue;
  }

  if (slideNumber >= 10 && slideNumber <= 16) {
    for (const shape of shapes) {
      const txt = getText(shape);
      if (txt === "Events Photos") {
        safeStyle(shape, { typeface: HOSS, fontSize: 31, bold: false, color: DEEP, autoFit: "shrinkText" });
      } else {
        safeStyle(shape, { typeface: BODY, fontSize: 14, color: BLUE, autoFit: "shrinkText", wrap: "square" });
      }
    }
    if (slideNumber === 16) {
      safeStyle(shapes[0], { typeface: HOSS, fontSize: 30, bold: false, color: DEEP, autoFit: "shrinkText" });
      safePosition(shapes[0], { left: 54, top: 54, width: 760, height: 70 });
    }
    addRule(slide, slideNumber, slideNumber === 16 ? 150 : 132);
    continue;
  }

  if (slideNumber === 20 || slideNumber === 21) {
    for (const shape of shapes) safeStyle(shape, { typeface: BODY, fontSize: 13, bold: true, color: WHITE, autoFit: "shrinkText", wrap: "square" });
    continue;
  }

  if (slideNumber === 22) {
    for (const shape of shapes) safeText(shape, "");
    continue;
  }

  if (slideNumber === 23) {
    safeStyle(shapes[0], { typeface: BODY, fontSize: 12, bold: true, color: DEEP, autoFit: "shrinkText" });
    continue;
  }

  if (slideNumber === 26) {
    safeStyle(shapes[0], { typeface: HOSS, fontSize: 30, bold: false, color: DEEP, autoFit: "shrinkText" });
    addRule(slide, slideNumber, 132);
    continue;
  }

  if (slideNumber >= 27 && slideNumber <= 29) {
    safeText(shapes[0], "");
    if (shapes[1]) safeFill(shapes[1], DEEP);
    for (const shape of shapes.slice(2)) safeStyle(shape, { typeface: BODY, autoFit: "shrinkText", wrap: "square" });
    continue;
  }

  if (slideNumber === 30) {
    for (const shape of shapes) {
      const txt = getText(shape);
      if (txt === "RECIPROCAL" || txt === "A LA CARTE" || txt === "IN-KIND PARTNERSHIP") {
        safeStyle(shape, { typeface: HOSS, fontSize: 26, bold: false, color: DEEP, autoFit: "shrinkText" });
      } else if (txt) {
        safeStyle(shape, { typeface: BODY, fontSize: 13, color: DEEP, autoFit: "shrinkText", wrap: "square" });
      }
    }
    addRule(slide, slideNumber, 126);
    continue;
  }

  if (slideNumber >= 32 && slideNumber <= 34) {
    for (const shape of shapes) {
      const txt = getText(shape);
      if (titleExact.has(txt)) {
        safeStyle(shape, { typeface: HOSS, fontSize: 28, bold: false, color: DEEP, autoFit: "shrinkText", wrap: "square" });
      } else if (txt) {
        safeStyle(shape, { typeface: BODY, fontSize: 15, color: DEEP, autoFit: "shrinkText", wrap: "square" });
      }
    }
    addRule(slide, slideNumber, 135);
    continue;
  }

  if (slideNumber === 37 || slideNumber === 39 || slideNumber === 44) {
    for (const shape of shapes) {
      const txt = getText(shape);
      if (txt) safeStyle(shape, { typeface: HOSS, fontSize: 28, bold: false, color: DEEP, autoFit: "shrinkText", wrap: "square" });
    }
    addRule(slide, slideNumber, slideNumber === 44 ? 210 : slideNumber === 39 ? 210 : 145);
    continue;
  }

  if (titleSlides.has(slideNumber)) {
    for (const shape of shapes) {
      const txt = getText(shape);
      if (titleExact.has(txt)) safeStyle(shape, { typeface: HOSS, fontSize: 30, bold: false, color: DEEP, autoFit: "shrinkText", wrap: "square" });
    }
  }
}

const montage = await presentation.export({ format: "webp", montage: true, scale: 1, quality: 88 });
await fs.writeFile(path.join(buildDir, "candidate-montage.webp"), new Uint8Array(await montage.arrayBuffer()));

for (const slideNumber of [1, 2, 3, 5, 7, 8, 10, 16, 24, 26, 27, 30, 32, 36, 37, 39, 44, 50]) {
  const slide = slides[slideNumber - 1];
  const png = await slide.export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(buildDir, `slide-${String(slideNumber).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
console.log(`draft written: ${candidatePath}`);
