import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, Presentation, PresentationFile } from "@oai/artifact-tool";

process.on("uncaughtException", (error) => { console.error("CAUGHT_UNCAUGHT", error?.name, error?.message); console.error(error?.stack); process.exit(1); });
process.on("unhandledRejection", (error) => { console.error("CAUGHT_REJECTION", error?.name, error?.message); console.error(error?.stack); process.exit(1); });

const sourcePath = "/Users/katherinebui/Downloads/The Vietnam Chapter of ICF - Chapter Talk Aug 2026.pptx";
const buildDir = "/Users/katherinebui/Documents/SacKySpace/.codex-build/rebrand-v2";
const mediaDir = path.join(buildDir, "source-media", "ppt", "media");
const candidatePath = path.join(buildDir, "candidate.pptx");
const W = 1280;
const H = 720;
const M = 64;

const HOSS = "Hoss Round";
const BODY = "Plus Jakarta Sans";
const DEEP = "#212251";
const BLUE = "#2b379b";
const LIGHT = "#5778fa";
const YELLOW = "#efcb30";
const BONE = "#f8f0e4";
const WHITE = "#ffffff";
const SOFT = "#e8dfd3";
const MUTED = "#6a6b86";

await fs.mkdir(buildDir, { recursive: true });

const sourcePres = await PresentationFile.importPptx(await FileBlob.load(sourcePath));
const sourceSlides = sourcePres.slides.items ?? [];
const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function mediaPath(id) {
  return path.join(mediaDir, path.basename(id));
}

async function asset(slideNo, index = 0) {
  const images = sourceSlides[slideNo - 1]?.images?.items ?? [];
  const image = images[index];
  if (!image?.data?.imageReference?.id) return null;
  const id = image.data.imageReference.id;
  const bytes = await fs.readFile(mediaPath(id));
  const ext = path.extname(id).toLowerCase();
  return { blob: bytes, contentType: ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png" };
}

function box(slide, x, y, w, h, fill = "none", radius = 0, lineFill = "none", lineWidth = 0) {
  return slide.shapes.add({
    geometry: radius ? "roundRect" : "rect",
    position: { left: x, top: y, width: w, height: h },
    fill,
    line: { fill: lineFill, width: lineWidth },
    ...(radius ? { borderRadius: radius } : {}),
  });
}

function text(slide, value, x, y, w, h, opts = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    position: { left: x, top: y, width: w, height: h },
    fill: opts.fill ?? "none",
    line: { fill: opts.lineFill ?? "none", width: opts.lineWidth ?? 0 },
  });
  shape.text = value;
  shape.text.style = {
    typeface: opts.typeface ?? BODY,
    fontSize: opts.fontSize ?? 16,
    color: opts.color ?? DEEP,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    autoFit: "shrinkText",
    wrap: "square",
    align: opts.align ?? "left",
    verticalAlign: opts.verticalAlign ?? "top",
    lineSpacing: opts.lineSpacing ?? 1.05,
    marginLeft: opts.marginLeft ?? 0,
    marginRight: opts.marginRight ?? 0,
    marginTop: opts.marginTop ?? 0,
    marginBottom: opts.marginBottom ?? 0,
  };
  return shape;
}

function line(slide, x, y, w, color = YELLOW, width = 3) {
  return slide.shapes.add({
    geometry: "line",
    position: { left: Math.min(x, x + w), top: y, width: Math.abs(w), height: 0 },
    fill: "none",
    line: { style: "solid", fill: color, width },
  });
}

function tag(slide, value, x, y, w, fill = YELLOW, color = DEEP, h = 30) {
  box(slide, x, y, w, h, fill, h / 2);
  text(slide, value, x + 12, y + 5, w - 24, h - 10, {
    fontSize: 12,
    color,
    bold: true,
    align: "center",
    verticalAlign: "middle",
  });
}

function footer(slide, n, dark = false) {
  text(slide, String(n).padStart(2, "0"), W - 106, H - 45, 42, 18, {
    fontSize: 11,
    color: dark ? LIGHT : MUTED,
    bold: true,
    align: "right",
  });
}

function title(slide, value, opts = {}) {
  const x = opts.x ?? M;
  const y = opts.y ?? 58;
  const w = opts.w ?? 760;
  tag(slide, opts.label ?? "ICF VIETNAM CHAPTER", x, y, opts.tagWidth ?? 178, opts.tagFill ?? YELLOW, opts.tagColor ?? DEEP, 28);
  text(slide, value, x, y + 47, w, opts.h ?? 70, {
    typeface: HOSS,
    fontSize: opts.fontSize ?? 31,
    color: opts.color ?? DEEP,
    lineSpacing: 0.95,
  });
  if (opts.rule !== false) line(slide, x, y + 128, opts.ruleWidth ?? 74, opts.ruleColor ?? YELLOW, 4);
}

function sectionSlide(n, heading, subheading = "") {
  const slide = presentation.slides.add();
  slide.background.fill = DEEP;
  tag(slide, `SECTION ${String(n).padStart(2, "0")}`, M, 66, 138);
  text(slide, String(n).padStart(2, "0"), M - 8, 158, 260, 150, { typeface: HOSS, fontSize: 126, color: LIGHT, lineSpacing: 0.8 });
  text(slide, heading, M, 306, 920, 118, { typeface: HOSS, fontSize: 42, color: WHITE, lineSpacing: 0.92 });
  if (subheading) text(slide, subheading, M, 442, 760, 50, { fontSize: 18, color: YELLOW, bold: true });
  line(slide, M, 530, 106, YELLOW, 5);
  footer(slide, presentation.slides.items.length, true);
  return slide;
}

async function addImage(slide, item, x, y, w, h, opts = {}) {
  if (!item) return null;
  return slide.images.add({
    blob: item.blob,
    contentType: item.contentType,
    fit: opts.fit ?? "cover",
    position: { left: x, top: y, width: w, height: h },
    geometry: opts.geometry ?? "roundRect",
    ...(opts.radius === 0 ? {} : { borderRadius: opts.radius ?? "rounded-xl" }),
  });
}

async function imageFrame(slide, item, x, y, w, h, opts = {}) {
  box(slide, x, y, w, h, opts.cardFill ?? WHITE, opts.cardRadius ?? 18);
  await addImage(slide, item, x + (opts.inset ?? 8), y + (opts.inset ?? 8), w - 2 * (opts.inset ?? 8), h - 2 * (opts.inset ?? 8), {
    fit: opts.fit ?? "cover",
    radius: opts.imageRadius ?? 12,
  });
}

function bullets(slide, items, x, y, w, h, opts = {}) {
  const value = items.map((item) => `•  ${item}`).join("\n");
  return text(slide, value, x, y, w, h, {
    fontSize: opts.fontSize ?? 16,
    color: opts.color ?? DEEP,
    lineSpacing: opts.lineSpacing ?? 1.22,
    marginLeft: opts.marginLeft ?? 4,
  });
}

function card(slide, x, y, w, h, fill = WHITE, radius = 18) {
  return box(slide, x, y, w, h, fill, radius, optsLine(fill), fill === WHITE ? 1 : 0);
}

function optsLine(fill) {
  return fill === WHITE ? SOFT : "none";
}

function labeledCard(slide, label, heading, body, x, y, w, h, opts = {}) {
  card(slide, x, y, w, h, opts.fill ?? WHITE, 18);
  if (opts.compact) {
    tag(slide, label, x + 20, y + 12, opts.labelWidth ?? 88, opts.tagFill ?? YELLOW, opts.tagColor ?? DEEP, 22);
    text(slide, heading, x + 20, y + 42, w - 40, 24, { typeface: HOSS, fontSize: opts.headingSize ?? 15, color: opts.headingColor ?? DEEP });
    text(slide, body, x + 20, y + 70, w - 40, Math.max(12, h - 80), { fontSize: opts.bodySize ?? 11.5, color: opts.bodyColor ?? DEEP, lineSpacing: 1.08 });
  } else {
    tag(slide, label, x + 20, y + 18, opts.labelWidth ?? 88, opts.tagFill ?? YELLOW, opts.tagColor ?? DEEP, 25);
    text(slide, heading, x + 20, y + 61, w - 40, 42, { typeface: HOSS, fontSize: opts.headingSize ?? 21, color: opts.headingColor ?? DEEP });
    text(slide, body, x + 20, y + 108, w - 40, Math.max(12, h - 126), { fontSize: opts.bodySize ?? 14, color: opts.bodyColor ?? DEEP, lineSpacing: 1.16 });
  }
}

function sponsorSlide(tier, tierName, price, items, limit, slideNo) {
  const slide = presentation.slides.add();
  slide.background.fill = BONE;
  box(slide, 0, 0, 350, H, DEEP);
  tag(slide, "FOR SPONSORS", M, 58, 138, YELLOW, DEEP, 28);
  text(slide, tier, M, 145, 276, 74, { typeface: HOSS, fontSize: 44, color: WHITE });
  text(slide, tierName, M, 228, 276, 55, { typeface: HOSS, fontSize: 25, color: LIGHT });
  text(slide, price, M, 310, 252, 54, { typeface: HOSS, fontSize: 30, color: YELLOW });
  line(slide, M, 394, 82, YELLOW, 4);
  tag(slide, limit, M, 426, 242, YELLOW, DEEP, 42);
  text(slide, "Partnership with the ICF Vietnam Chapter", M, 594, 238, 50, { fontSize: 13, color: WHITE, lineSpacing: 1.15 });

  tag(slide, "2026 PARTNERSHIP PROGRAM", 402, 58, 208, BLUE, WHITE, 28);
  text(slide, `${tierName} / ${tier}`, 402, 105, 680, 52, { typeface: HOSS, fontSize: 32, color: DEEP });
  line(slide, 402, 170, 74, YELLOW, 4);
  const coords = [
    [402, 196, 360, 128], [786, 196, 360, 128],
    [402, 338, 360, 128], [786, 338, 360, 128],
    [402, 480, 360, 128], [786, 480, 360, 128],
  ];
  items.forEach((it, i) => labeledCard(slide, it[0], it[0], it[1], ...coords[i], { compact: true, headingSize: 15, bodySize: 11.5 }));
  footer(slide, slideNo);
  return slide;
}

// 1 — cover
{
  const slide = presentation.slides.add();
  slide.background.fill = DEEP;
  tag(slide, "THE VIETNAM CHAPTER OF ICF", M, 62, 224, YELLOW, DEEP, 30);
  text(slide, "Chapter\nTalk", M, 154, 530, 190, { typeface: HOSS, fontSize: 76, color: WHITE, lineSpacing: 0.83 });
  text(slide, "August 2026", M, 370, 420, 42, { typeface: HOSS, fontSize: 30, color: YELLOW });
  text(slide, "Building a sustainable coaching ecosystem together.", M, 446, 440, 56, { fontSize: 17, color: WHITE, lineSpacing: 1.15 });
  const a = await asset(10, 0);
  const b = await asset(16, 0);
  await imageFrame(slide, a, 760, 82, 392, 244, { cardFill: LIGHT, inset: 8, fit: "cover" });
  await imageFrame(slide, b, 856, 350, 304, 218, { cardFill: YELLOW, inset: 8, fit: "cover" });
  text(slide, "The Vietnam Chapter of ICF", 760, 604, 430, 28, { fontSize: 13, color: LIGHT, bold: true });
  footer(slide, 1, true);
}

// 2, 24, 36 — section covers
sectionSlide(1, "The Vietnam Chapter of ICF", "Introduction");

// 3 — What ICF Does
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "What ICF Does", { label: "ABOUT ICF", tagWidth: 108 });
  bullets(slide, [
    "Pioneers in development of global standards for professional coaching, core competencies, ethics, and industry research.",
    "Independent credentialing and training program accreditation body.",
    "Professional development and network-building opportunities for coaches.",
    "Provide organizations access to credentialed coaches around the world.",
  ], M, 214, 678, 312, { fontSize: 17, lineSpacing: 1.30 });
  card(slide, 850, 176, 350, 354, DEEP, 24);
  tag(slide, "GLOBAL STANDARD", 884, 208, 148, YELLOW, DEEP, 28);
  text(slide, "Professional\ncoaching\nwith purpose.", 884, 274, 260, 150, { typeface: HOSS, fontSize: 38, color: WHITE, lineSpacing: 0.90 });
  text(slide, "Competence · ethics · research", 884, 454, 260, 25, { fontSize: 13, color: LIGHT, bold: true });
  footer(slide, 3);
}

// 4 — ecosystem
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "The ICF Ecosystem", { label: "ABOUT ICF", tagWidth: 108 });
  text(slide, "One global community.\nMany ways to grow.", M, 214, 368, 110, { typeface: HOSS, fontSize: 33, color: DEEP, lineSpacing: 0.92 });
  text(slide, "Credentials, education, research and community come together to raise the standard of coaching.", M, 350, 360, 96, { fontSize: 16, color: BLUE, lineSpacing: 1.18 });
  // Rebuilt as editable nodes so the ecosystem visual is usable, not a blank image placeholder.
  const cx = 864, cy = 365;
  const orbit = [[548, 198, 182, 74, "Credentialing"], [1004, 198, 164, 74, "Education"], [520, 490, 182, 74, "Research"], [1014, 490, 154, 74, "Community"]];
  for (const [x, y, w, h, label] of orbit) {
    line(slide, x + w / 2, y + h / 2, cx - (x + w / 2), LIGHT, 2);
    card(slide, x, y, w, h, WHITE, 16);
    text(slide, label, x + 14, y + 25, w - 28, 26, { typeface: HOSS, fontSize: 19, color: DEEP, align: "center" });
  }
  slide.shapes.add({ geometry: "ellipse", position: { left: 738, top: 274, width: 252, height: 182 }, fill: DEEP, line: { fill: "none", width: 0 } });
  text(slide, "ICF", 788, 306, 152, 54, { typeface: HOSS, fontSize: 42, color: YELLOW, align: "center" });
  text(slide, "Professional\ncoaching", 788, 366, 152, 52, { fontSize: 15, color: WHITE, bold: true, align: "center", lineSpacing: 1.02 });
  tag(slide, "GLOBAL STANDARD", 790, 436, 148, BLUE, WHITE, 26);
  footer(slide, 4);
}

// 5 — chapter vision / mission / culture
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "The Vietnam Chapter of ICF", { label: "OUR CHAPTER", tagWidth: 130, w: 740 });
  labeledCard(slide, "VISION", "A trusted chapter", "Become a trusted professional coaching chapter in Vietnam.", M, 190, 330, 148, { labelWidth: 74, headingSize: 20, bodySize: 14 });
  labeledCard(slide, "MISSION", "Empower coaches", "Empower professional coaches to deliver exceptional service through unwavering commitment to competence and ethical practice.", 414, 190, 372, 148, { labelWidth: 80, headingSize: 20, bodySize: 13.2 });
  card(slide, 814, 190, 372, 334, DEEP, 18);
  tag(slide, "CORE CULTURE", 840, 214, 118, YELLOW, DEEP, 26);
  text(slide, "Ready to…", 840, 260, 280, 44, { typeface: HOSS, fontSize: 28, color: WHITE });
  bullets(slide, [
    "take care of your well-being",
    "continuously develop coaching competencies",
    "support other people’s well-being",
    "develop the coaching industry in Vietnam",
  ], 840, 315, 310, 170, { fontSize: 14, color: WHITE, lineSpacing: 1.30 });
  footer(slide, 5);
}

// 6 — strategy
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "The Vietnam Chapter of ICF – Strategy", { label: "OUR CHAPTER", tagWidth: 130, w: 840, fontSize: 29 });
  text(slide, "Our strategy connects member well-being, coaching competence and industry development.", M, 190, 620, 38, { fontSize: 16, color: BLUE });
  const pillars = [
    ["01", "Member well-being", "A chapter that is ready to take care of its people."],
    ["02", "Competence", "Continuous development of coaching capability and ethics."],
    ["03", "Community", "Ready to support other people’s well-being."],
    ["04", "Industry", "Grow the coaching profession in Vietnam."],
  ];
  pillars.forEach((p, i) => {
    const x = M + i * 286;
    box(slide, x, 286, 250, 224, i === 1 ? DEEP : WHITE, 20, i === 1 ? "none" : SOFT, i === 1 ? 0 : 1);
    text(slide, p[0], x + 20, 310, 48, 44, { typeface: HOSS, fontSize: 28, color: i === 1 ? YELLOW : LIGHT });
    text(slide, p[1], x + 20, 364, 208, 40, { typeface: HOSS, fontSize: 22, color: i === 1 ? WHITE : DEEP });
    text(slide, p[2], x + 20, 420, 208, 56, { fontSize: 13, color: i === 1 ? WHITE : BLUE, lineSpacing: 1.13 });
  });
  line(slide, M, 550, 940, YELLOW, 4);
  text(slide, "Ready to grow together", M, 570, 420, 32, { typeface: HOSS, fontSize: 22, color: DEEP });
  footer(slide, 6);
}

// 7 — membership snapshot
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Our community at a glance", { label: "OUR CHAPTER", tagWidth: 130, w: 660 });
  text(slide, "Updated by Dec 2025", 970, 75, 218, 28, { fontSize: 12, color: BLUE, bold: true, align: "right" });
  const stats = [
    ["78", "members located\nin Vietnam"],
    ["61", "members of the\nVietnam Chapter"],
    ["171", "ICF credentialed\ncoaches"],
  ];
  stats.forEach((s, i) => {
    const x = M + i * 240;
    card(slide, x, 185, 212, 160, i === 2 ? YELLOW : WHITE, 18);
    text(slide, s[0], x + 22, 211, 168, 50, { typeface: HOSS, fontSize: 42, color: i === 2 ? DEEP : BLUE });
    text(slide, s[1], x + 22, 272, 170, 48, { fontSize: 13, color: DEEP, lineSpacing: 1.10 });
  });
  text(slide, "ICF credential distribution", M, 414, 350, 34, { typeface: HOSS, fontSize: 22, color: DEEP });
  const creds = [["ACC", "85"], ["PCC", "81"], ["MCC", "3"], ["ACTC", "2"]];
  creds.forEach((c, i) => {
    const x = M + i * 170;
    box(slide, x, 470, 142, 76, i === 1 ? DEEP : WHITE, 18, i === 1 ? "none" : SOFT, i === 1 ? 0 : 1);
    text(slide, c[0], x + 14, 483, 114, 22, { fontSize: 12, bold: true, color: i === 1 ? YELLOW : BLUE, align: "center" });
    text(slide, c[1], x + 14, 507, 114, 30, { typeface: HOSS, fontSize: 24, color: i === 1 ? WHITE : DEEP, align: "center" });
  });
  footer(slide, 7);
}

// 8 — board team native table
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "The Vietnam Chapter of ICF – Board Team", { label: "OUR CHAPTER", tagWidth: 130, w: 890, fontSize: 28 });
  const values = [
    ["ROLE", "NAME", "ROLE", "NAME"],
    ["President", "Ms. Doan Huynh Van Anh", "Director of DEIB", "Mr. Nguyen Trong Khuong"],
    ["Director of Partnerships", "Ms. Nguyen Thanh Tuyen", "Director of Credentialing Support", "Ms. Pham Diep Linh"],
    ["Director of Marketing & Communication", "Ms. Nguyen Thi Anh Thu", "Secretary", "Ms. Hoang Tuyet Mai"],
    ["Director of Event", "Mr. Nguyen Anh Tuan", "Treasury", "Ms. Vu Thi Tuyet"],
    ["Member of Marketing & Communication", "Ms. Bui Ngoc Phuong Linh", "Member of Marketing & Communication", "Ms. Doan Thi Cam Tu"],
  ];
  const table = slide.tables.add({ rows: 6, columns: 4, left: M, top: 190, width: W - M * 2, height: 400, values, columnWidths: [220, 230, 240, 230] });
  table.borders.assign({ style: "solid", fill: SOFT, width: 1 });
  for (let c = 0; c < 4; c++) { const cell = table.getCell(0, c); cell.fill = DEEP; cell.text.style = { typeface: BODY, fontSize: 11, bold: true, color: WHITE, autoFit: "shrinkText" }; }
  for (let r = 1; r < 6; r++) for (let c = 0; c < 4; c++) { const cell = table.getCell(r, c); cell.fill = r % 2 ? WHITE : "#f2eadf"; cell.text.style = { typeface: BODY, fontSize: 11.2, color: DEEP, autoFit: "shrinkText", wrap: "square" }; }
  footer(slide, 8);
}

// 9 — engagement statement
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "COMMUNITY IN ACTION", M, 70, 170);
  text(slide, "700+ participants\nengaged.", M, 142, 530, 150, { typeface: HOSS, fontSize: 52, color: WHITE, lineSpacing: 0.86 });
  text(slide, "Through both online and offline events from Feb 2025 – Mar 2026.", M, 332, 430, 82, { fontSize: 18, color: YELLOW, lineSpacing: 1.16 });
  const img = await asset(9, 0);
  await imageFrame(slide, img, 660, 70, 520, 502, { cardFill: LIGHT, inset: 10, fit: "cover" });
  footer(slide, 9, true);
}

// 10 — three-photo gallery
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Events Photos", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 500 });
  const imgs = await Promise.all([0, 1, 2, 3].map((i) => asset(10, i)));
  const captions = ["Feb 2025", "Mar 2025", "Apr 2025"];
  [0, 1, 2].forEach(async () => {});
  await imageFrame(slide, imgs[1], 64, 190, 350, 322, { cardFill: WHITE, inset: 9 }); tag(slide, captions[0], 84, 532, 92, YELLOW, DEEP, 27);
  await imageFrame(slide, imgs[2], 464, 190, 350, 322, { cardFill: WHITE, inset: 9 }); tag(slide, captions[1], 484, 532, 92, YELLOW, DEEP, 27);
  await imageFrame(slide, imgs[3], 864, 190, 350, 322, { cardFill: WHITE, inset: 9 }); tag(slide, captions[2], 884, 532, 92, YELLOW, DEEP, 27);
  footer(slide, 10);
}

// 11–13 — two-photo galleries
for (const [slideNo, captions] of [[11, ["May 2025 · Online", "May 2025 · Online"]], [12, ["May 2025 · Offline · Ho Chi Minh City", "May 2025 · Offline · Ho Chi Minh City"]], [13, ["May 2025 · Offline · Hanoi City", "May 2025 · Offline · Hanoi City"]]]) {
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Events Photos", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 500 });
  const imgs = await Promise.all([0, 1].map((i) => asset(slideNo, i)));
  await imageFrame(slide, imgs[0], 64, 186, 548, 350, { cardFill: WHITE, inset: 10 });
  await imageFrame(slide, imgs[1], 668, 186, 548, 350, { cardFill: WHITE, inset: 10 });
  tag(slide, captions[0], 88, 552, Math.min(260, captions[0].length * 7 + 28), YELLOW, DEEP, 28);
  tag(slide, captions[1], 692, 552, Math.min(300, captions[1].length * 7 + 28), YELLOW, DEEP, 28);
  footer(slide, slideNo);
}

// 14 — five-photo mosaic
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Events Photos", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 500 });
  const imgs = await Promise.all([0, 1, 2, 3, 4].map((i) => asset(14, i)));
  await imageFrame(slide, imgs[0], 64, 186, 410, 244, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[1], 494, 186, 332, 244, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[2], 846, 186, 370, 244, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[3], 64, 448, 568, 112, { cardFill: WHITE, inset: 7 });
  await imageFrame(slide, imgs[4], 652, 448, 564, 112, { cardFill: WHITE, inset: 7 });
  tag(slide, "July 2025 · Online", 84, 588, 146, YELLOW, DEEP, 28);
  tag(slide, "Aug 2025 · Hanoi", 250, 588, 146, YELLOW, DEEP, 28);
  footer(slide, 14);
}

// 15 — five-photo mosaic
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Events Photos", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 500 });
  const imgs = await Promise.all([0, 1, 2, 3, 4].map((i) => asset(15, i)));
  await imageFrame(slide, imgs[0], 64, 186, 350, 360, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[1], 434, 186, 350, 168, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[2], 804, 186, 412, 168, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[3], 434, 368, 350, 178, { cardFill: WHITE, inset: 8 });
  await imageFrame(slide, imgs[4], 804, 368, 412, 178, { cardFill: WHITE, inset: 8 });
  tag(slide, "Sep 2025 · Online", 84, 566, 150, YELLOW, DEEP, 28);
  tag(slide, "Chapter Talk Series", 244, 566, 170, BLUE, WHITE, 28);
  footer(slide, 15);
}

// 16 — internal / APAC forum
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "October internal activity", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 760, fontSize: 30 });
  text(slide, "ICF Asia Pacific in-person forum", M, 196, 430, 42, { typeface: HOSS, fontSize: 25, color: DEEP });
  text(slide, "13–15 October 2025", M, 245, 360, 28, { fontSize: 15, color: BLUE, bold: true });
  const imgs = await Promise.all([0, 1].map((i) => asset(16, i)));
  await imageFrame(slide, imgs[0], 510, 180, 320, 366, { cardFill: WHITE, inset: 9 });
  await imageFrame(slide, imgs[1], 854, 180, 362, 366, { cardFill: WHITE, inset: 9 });
  footer(slide, 16);
}

// 17 — event collage
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "A growing chapter community", { label: "COMMUNITY IN ACTION", tagWidth: 192, w: 700, fontSize: 30 });
  const imgs = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => asset(17, i)));
  const slots = [[64, 186, 300, 170], [384, 186, 392, 170], [796, 186, 420, 170], [64, 374, 420, 190], [504, 374, 280, 190], [804, 374, 412, 190]];
  for (let i = 0; i < slots.length; i++) await imageFrame(slide, imgs[i], ...slots[i], { cardFill: WHITE, inset: 8 });
  footer(slide, 17);
}

// 18–19 — poster windows
for (const slideNo of [18, 19]) {
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "COMMUNITY IN ACTION", M, 58, 192, YELLOW, DEEP, 28);
  text(slide, slideNo === 18 ? "Chapter event highlight" : "Event highlight", M, 112, 430, 50, { typeface: HOSS, fontSize: 32, color: WHITE });
  const img = await asset(slideNo, 0);
  await imageFrame(slide, img, 540, 48, 630, 610, { cardFill: LIGHT, inset: 12, fit: "contain" });
  footer(slide, slideNo, true);
}

// 20 — Power of Voice, Hanoi
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "International Coaching Week 2026", { label: "ICW 2026", tagWidth: 86, w: 820, fontSize: 29 });
  tag(slide, "THE POWER OF VOICE", M, 204, 174, YELLOW, DEEP, 30);
  text(slide, "Hà Nội · 10 May 2026", M, 252, 360, 38, { typeface: HOSS, fontSize: 26, color: DEEP });
  text(slide, "A conversation about the voice we choose to bring into the world.", M, 314, 360, 72, { fontSize: 16, color: BLUE, lineSpacing: 1.16 });
  const img = await asset(20, 0);
  await imageFrame(slide, img, 520, 164, 660, 414, { cardFill: WHITE, inset: 10, fit: "cover" });
  footer(slide, 20);
}

// 21 — Power of Voice collage
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "International Coaching Week 2026", { label: "ICW 2026", tagWidth: 86, w: 820, fontSize: 29 });
  tag(slide, "THE POWER OF VOICE", M, 194, 174, YELLOW, DEEP, 30);
  text(slide, "Hà Nội · 10 May 2026", M, 242, 300, 28, { fontSize: 14, color: BLUE, bold: true });
  text(slide, "TPHCM · 17 May 2026", M, 274, 300, 28, { fontSize: 14, color: BLUE, bold: true });
  const imgs = await Promise.all([0, 1, 2, 3, 4, 5].map((i) => asset(21, i)));
  const slots = [[420, 182, 240, 166], [676, 182, 240, 166], [932, 182, 284, 166], [420, 364, 240, 192], [676, 364, 240, 192], [932, 364, 284, 192]];
  for (let i = 0; i < slots.length; i++) await imageFrame(slide, imgs[i], ...slots[i], { cardFill: WHITE, inset: 7 });
  footer(slide, 21);
}

// 22 — rebuild the designed poster with editable headline and supplied images
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "THE POWER OF VOICE", M, 62, 174, YELLOW, DEEP, 30);
  text(slide, "International\nCoaching Week 2026", M, 132, 510, 112, { typeface: HOSS, fontSize: 39, color: WHITE, lineSpacing: 0.9 });
  text(slide, "Weaving voices, shaping futures", M, 286, 430, 38, { fontSize: 16, color: LIGHT, bold: true });
  text(slide, "HÀ NỘI · 10 MAY 2026", M, 352, 310, 24, { fontSize: 12, color: YELLOW, bold: true });
  text(slide, "TPHCM · 17 MAY 2026", M, 382, 310, 24, { fontSize: 12, color: YELLOW, bold: true });
  const speaker = await asset(22, 0);
  const collage = await asset(22, 1);
  await imageFrame(slide, collage, 590, 90, 570, 400, { cardFill: LIGHT, inset: 10, fit: "cover" });
  await imageFrame(slide, speaker, 1014, 508, 164, 130, { cardFill: YELLOW, inset: 7, fit: "contain" });
  footer(slide, 22, true);
}

// 23 — poster with date
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  tag(slide, "COMMUNITY IN ACTION", M, 60, 192, YELLOW, DEEP, 28);
  text(slide, "Coming together in July", M, 112, 460, 54, { typeface: HOSS, fontSize: 33, color: DEEP });
  const img = await asset(23, 0);
  await imageFrame(slide, img, 500, 44, 650, 612, { cardFill: WHITE, inset: 12, fit: "contain" });
  tag(slide, "JULY 26, 2026", M, 220, 138, BLUE, WHITE, 30);
  footer(slide, 23);
}

// 24 — section cover
sectionSlide(2, "Strategic Partnership Programs 2026", "For sponsors · educators · partners");

// 25 — sponsor divider
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "SECTION 02", M, 66, 120);
  text(slide, "For Sponsors", M, 192, 600, 90, { typeface: HOSS, fontSize: 58, color: WHITE });
  text(slide, "Build visibility, capability and impact with the ICF Vietnam Chapter.", M, 310, 570, 60, { fontSize: 18, color: LIGHT, lineSpacing: 1.15 });
  line(slide, M, 430, 94, YELLOW, 5);
  footer(slide, 25, true);
}

// 26 — annual sponsor packages
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "Annual Sponsor Packages", { label: "FOR SPONSORS", tagWidth: 138, w: 620, fontSize: 33 });
  labeledCard(slide, "PLATINUM", "Strategic Partner", "100M VND / Year\nMaximum visibility, flagship presence and co-created impact.", 64, 192, 350, 308, { labelWidth: 98, headingSize: 25, bodySize: 15, tagFill: DEEP, tagColor: WHITE });
  labeledCard(slide, "GOLD", "Development Partner", "42M VND / Year\nA strong platform for development, education and community presence.", 464, 192, 350, 308, { labelWidth: 68, headingSize: 25, bodySize: 15, tagFill: BLUE, tagColor: WHITE });
  labeledCard(slide, "SILVER", "Collaborative Partner", "26M VND / Year\nFocused visibility and participation across chapter events.", 864, 192, 350, 308, { labelWidth: 76, headingSize: 25, bodySize: 15, tagFill: YELLOW, tagColor: DEEP });
  footer(slide, 26);
}

// 27 — platinum
sponsorSlide("PLATINUM", "STRATEGIC PARTNER", "100M VND / YEAR", [
  ["SPEECH & PRESENCE", "10-minute keynote at International Coaching Week; recognition in the annual sponsor list."],
  ["EXCLUSIVE COMMUNICATION", "06 dedicated social media posts."],
  ["BRANDING PRIVILEGES", "Top header logo placement; research / white-paper collaboration; demo or display booth at all events."],
  ["EDUCATIONAL PRIVILEGES", "02 private internal workshops on coaching culture and leadership capability."],
  ["VIP ACCESS", "05 invitations per event and 02 VIP tickets for special ICW content."],
  ["PRO-BONO & CSR", "Lead Partner role: co-design, implement, enhance and evaluate project impact."],
], "01 SELECTED SPONSOR / INDUSTRY", 27);

// 28 — gold
sponsorSlide("GOLD", "DEVELOPMENT PARTNER", "42M VND / YEAR", [
  ["SPEECH & PRESENCE", "5-minute introduction at 02 webinars; recognition in the annual sponsor list."],
  ["EXCLUSIVE COMMUNICATION", "03 dedicated social media posts."],
  ["BRANDING PRIVILEGES", "Mid-tier logo placement; demo or display booth at all events."],
  ["EDUCATIONAL PRIVILEGES", "01 private internal workshop."],
  ["VIP ACCESS", "02 invitations per event and 01 VIP ticket for special ICW content."],
  ["PRO-BONO & CSR", "Flexible collaboration scope as defined per project."],
], "03 SELECTED SPONSORS / INDUSTRY", 28);

// 29 — silver
sponsorSlide("SILVER", "COLLABORATIVE PARTNER", "26M VND / YEAR", [
  ["SPEECH & PRESENCE", "Unlimited participation; recognition in the annual sponsor list."],
  ["EXCLUSIVE COMMUNICATION", "01 dedicated social media post."],
  ["BRANDING PRIVILEGES", "Footer logo placement; demo or display booth at all events."],
  ["EDUCATIONAL PRIVILEGES", "N/A"],
  ["VIP ACCESS", "02 invitations per event."],
  ["PRO-BONO & CSR", "N/A"],
], "OPEN PARTNERSHIP", 29);

// 30 — reciprocal / a la carte
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "In-kind Partnership", { label: "FOR SPONSORS", tagWidth: 138, w: 610, fontSize: 34 });
  text(slide, "Flexible ways to contribute beyond annual packages.", M, 182, 520, 34, { fontSize: 16, color: BLUE });
  const cards = [
    ["RECIPROCAL", "Exchange value through agreed visibility, expertise, resources or access."],
    ["A LA CARTE", "Choose only the presence, branding or education elements that fit your goals."],
    ["PRESENCE AT EVENTS", "Participation, speaking opportunities, booths and special content."],
    ["BRANDING", "Logo placement, co-branded assets and event visibility."],
    ["EDUCATION", "Workshops, coaching culture and leadership capability development."],
    ["SOCIAL POST", "Dedicated chapter communications and community reach."],
  ];
  cards.forEach((c, i) => labeledCard(slide, c[0], c[0], c[1], 64 + (i % 3) * 384, 244 + Math.floor(i / 3) * 166, 350, 138, { labelWidth: Math.min(172, c[0].length * 8 + 22), headingSize: 18, bodySize: 13 }));
  footer(slide, 30);
}

// 31 — educator divider
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "SECTION 02", M, 66, 120);
  text(slide, "For Educators", M, 192, 680, 90, { typeface: HOSS, fontSize: 58, color: WHITE });
  text(slide, "Stay ahead of standards. Grow the next generation of coaches.", M, 310, 590, 60, { fontSize: 18, color: LIGHT, lineSpacing: 1.15 });
  line(slide, M, 430, 94, YELLOW, 5);
  footer(slide, 31, true);
}

// 32–34 — educator value proposition
const educatorSlides = [
  [32, "The Chapter serves as your vital bridge", "EARLIEST UPDATES", "Provide the earliest updates on Accreditation standard changes.", "PROACTIVE READINESS", "Enable your organization to proactively enhance faculty capacity and refine your training curricula.", "LONG-TERM GROWTH", "This partnership supports the long-term growth of your Organization and the coaching industry in Vietnam.", "Navigating Global Standards"],
  [33, "Credentialing Accelerator", "APPLICATION READINESS", "Stay informed on qualification updates and credentialing pathways.", "CAPACITY BUILDING", "Equip faculty and learners with a clear, practical route to credentialing excellence.", "PARTNER VALUE", "Turn global standards into confident, locally relevant education experiences.", "Credentialing Excellence"],
  [34, "Exclusive Privileges", "MEMBERSHIP", "10% membership discount for your organization.", "LEARNING CREDITS", "CCE accumulation opportunities through chapter activities.", "PRACTICUM HUB", "Pro-bono practicum hub connecting learning with meaningful community impact.", "Synergizing Value & Continuous Development"],
];
for (const [slideNo, heading, l1, b1, l2, b2, l3, b3, panelTitle] of educatorSlides) {
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, heading, { label: "FOR EDUCATORS", tagWidth: 138, w: 720, fontSize: 31 });
  const rows = [[l1, b1], [l2, b2], [l3, b3]];
  rows.forEach((r, i) => {
    const y = 200 + i * 106;
    tag(slide, r[0], M, y, Math.min(196, r[0].length * 7.2 + 24), i === 1 ? BLUE : YELLOW, i === 1 ? WHITE : DEEP, 28);
    text(slide, r[1], M, y + 38, 630, 55, { fontSize: 15, color: DEEP, lineSpacing: 1.16 });
  });
  box(slide, 790, 160, 426, 414, YELLOW, 24);
  tag(slide, "PARTNER VALUE", 828, 198, 126, DEEP, WHITE, 27);
  text(slide, panelTitle, 828, 252, 320, 96, { typeface: HOSS, fontSize: 30, color: DEEP, lineSpacing: 0.92 });
  line(slide, 828, 380, 76, DEEP, 4);
  const brush = await asset(slideNo, 0);
  if (brush) await addImage(slide, brush, 880, 412, 244, 126, { fit: "contain", radius: 0 });
  footer(slide, slideNo);
}

// 35 — milestone poster
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "FOR EDUCATORS", M, 58, 138, YELLOW, DEEP, 28);
  text(slide, "A clear path to\nwhat comes next", M, 122, 440, 118, { typeface: HOSS, fontSize: 46, color: WHITE, lineSpacing: 0.9 });
  const img = await asset(35, 0);
  await imageFrame(slide, img, 540, 46, 620, 616, { cardFill: LIGHT, inset: 10, fit: "contain" });
  footer(slide, 35, true);
}

// 36 — section cover
sectionSlide(3, "ICF recent updates", "Accreditation · qualifications · pathways");

// 37 — new accreditation standards, reconstructed
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "New Accreditation Standards", { label: "RECENT UPDATES", tagWidth: 144, w: 760, fontSize: 32 });
  text(slide, "Standards Review Summary", M, 190, 420, 34, { typeface: HOSS, fontSize: 23, color: DEEP });
  const rows = [
    ["STANDARD 1", "No updates required"], ["STANDARD 2", "Updates required"], ["STANDARD 3", "Updates required"], ["STANDARD 4", "Updates required"],
    ["STANDARD 5", "Updates required"], ["STANDARD 6", "No updates required"], ["STANDARD 7", "No updates required"],
  ];
  rows.forEach((r, i) => {
    const y = 240 + i * 44;
    box(slide, M, y, 530, 34, i % 2 ? WHITE : "#f2eadf", 8);
    text(slide, r[0], M + 14, y + 8, 126, 18, { fontSize: 11, bold: true, color: BLUE });
    text(slide, r[1], M + 168, y + 7, 330, 20, { fontSize: 12, color: r[1].startsWith("No") ? BLUE : DEEP, bold: true });
  });
  box(slide, 690, 220, 480, 258, DEEP, 22);
  tag(slide, "COMPLIANCE DEADLINE", 728, 252, 174, YELLOW, DEEP, 28);
  text(slide, "April 1st,\n2027", 728, 306, 340, 92, { typeface: HOSS, fontSize: 44, color: WHITE, lineSpacing: 0.88 });
  text(slide, "Prepare your programs early for the updated global standard.", 728, 420, 350, 48, { fontSize: 14, color: LIGHT, lineSpacing: 1.15 });
  footer(slide, 37);
}

// 38 — coach educator program screenshot in a clean window
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "ICF Coach Educator Competency Learning Program", { label: "RECENT UPDATES", tagWidth: 144, w: 900, fontSize: 27 });
  const img = await asset(38, 0);
  await imageFrame(slide, img, 80, 174, 1120, 438, { cardFill: WHITE, inset: 10, fit: "contain" });
  footer(slide, 38);
}

// 39 — new qualification for coaches
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "New Qualification for Coaches", { label: "RECENT UPDATES", tagWidth: 144, w: 760, fontSize: 31 });
  text(slide, "Mentor Coaching Specialization (MCS)", M, 190, 520, 34, { typeface: HOSS, fontSize: 23, color: DEEP });
  text(slide, "A new pathway supporting high-quality mentor coaching practice.", M, 236, 520, 48, { fontSize: 15, color: BLUE });
  const imgs = await Promise.all([0, 1, 2].map((i) => asset(39, i)));
  await imageFrame(slide, imgs[0], 650, 170, 152, 152, { cardFill: WHITE, inset: 10, fit: "contain" });
  await imageFrame(slide, imgs[1], 836, 170, 152, 152, { cardFill: WHITE, inset: 10, fit: "contain" });
  await imageFrame(slide, imgs[2], 1022, 170, 152, 152, { cardFill: WHITE, inset: 10, fit: "contain" });
  labeledCard(slide, "WHAT IT ENABLES", "More confidence in the mentor-coaching role", "Clearer recognition, stronger standards and continued professional development for coaches.", M, 330, 510, 166, { labelWidth: 142, headingSize: 20, bodySize: 14 });
  footer(slide, 39);
}

// 40–43 — supplied update visuals, framed and titled
const updateFrames = [
  [40, "Mentor Coaching Specialization Applications"],
  [41, "Early access to applications for Coach Education Providers"],
  [42, "Mentor Coaching Specialization: what changes"],
  [43, "Building capability across the coaching ecosystem"],
];
for (const [slideNo, heading] of updateFrames) {
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "RECENT UPDATES", M, 54, 144, YELLOW, DEEP, 28);
  text(slide, heading, M, 104, 690, 54, { typeface: HOSS, fontSize: 30, color: WHITE });
  const img = await asset(slideNo, 0);
  await imageFrame(slide, img, 80, 178, 1120, 438, { cardFill: LIGHT, inset: 10, fit: "contain" });
  footer(slide, slideNo, true);
}

// 44 — advanced accreditation options, native layout
{
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  title(slide, "New Accreditation for Organizations", { label: "RECENT UPDATES", tagWidth: 144, w: 850, fontSize: 30 });
  text(slide, "Two advanced pathways for organizations building specialist capability.", M, 188, 620, 36, { fontSize: 16, color: BLUE });
  labeledCard(slide, "AAMC", "Advanced Accreditation in Mentor Coaching", "A focused pathway for organizations delivering mentor-coaching education and developing qualified mentor coaches.", M, 278, 510, 230, { labelWidth: 60, headingSize: 23, bodySize: 15, tagFill: DEEP, tagColor: WHITE });
  labeledCard(slide, "AASC", "Advanced Accreditation in Coaching Supervision", "A focused pathway for organizations building coaching-supervision capability and high-quality learning experiences.", 690, 278, 510, 230, { labelWidth: 60, headingSize: 23, bodySize: 15, tagFill: BLUE, tagColor: WHITE });
  footer(slide, 44);
}

// 45–49 — keep supplied posters, but place them as deliberate windows
const posters = [
  [45, "Advanced accreditation: mentor coaching"],
  [46, "Advanced accreditation: coaching supervision"],
  [47, "Pathways for individual coaches"],
  [48, "Qualification pathway overview"],
  [49, "Join the conversation"],
];
for (const [slideNo, heading] of posters) {
  const slide = presentation.slides.add(); slide.background.fill = BONE;
  tag(slide, "RECENT UPDATES", M, 54, 144, YELLOW, DEEP, 28);
  text(slide, heading, M, 106, 620, 54, { typeface: HOSS, fontSize: 30, color: DEEP });
  const img = await asset(slideNo, 0);
  await imageFrame(slide, img, 260, 172, 760, 468, { cardFill: WHITE, inset: 12, fit: "contain" });
  footer(slide, slideNo);
}

// 50 — closing slide with editable text and supplied social icons
{
  const slide = presentation.slides.add(); slide.background.fill = DEEP;
  tag(slide, "THE VIETNAM CHAPTER OF ICF", M, 66, 224, YELLOW, DEEP, 30);
  text(slide, "Thank you!", M, 164, 520, 88, { typeface: HOSS, fontSize: 66, color: WHITE });
  text(slide, "Partner with the ICF Vietnam Chapter to build a sustainable coaching ecosystem together.", M, 286, 520, 82, { fontSize: 18, color: LIGHT, lineSpacing: 1.15 });
  text(slide, "Follow us on:", M, 430, 300, 28, { fontSize: 15, color: YELLOW, bold: true });
  const imgs = await Promise.all([0, 1, 2].map((i) => asset(50, i)));
  await addImage(slide, imgs[0], M, 482, 46, 46, { fit: "contain", radius: 0 });
  await addImage(slide, imgs[1], M + 66, 482, 46, 46, { fit: "contain", radius: 0 });
  await addImage(slide, imgs[2], M + 132, 482, 46, 46, { fit: "contain", radius: 0 });
  line(slide, M, 590, 92, YELLOW, 5);
  footer(slide, 50, true);
}

const montage = await presentation.export({ format: "webp", montage: true, scale: 1, quality: 88 });
await fs.writeFile(path.join(buildDir, "candidate-montage.webp"), new Uint8Array(await montage.arrayBuffer()));
for (const slideNo of [1, 2, 3, 5, 6, 7, 8, 9, 10, 14, 20, 22, 24, 26, 27, 30, 32, 37, 39, 44, 50]) {
  const slide = presentation.slides.items[slideNo - 1];
  const png = await slide.export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(buildDir, `slide-${String(slideNo).padStart(2, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
}

await (await PresentationFile.exportPptx(presentation)).save(candidatePath);
console.log(`draft written: ${candidatePath}; slides=${presentation.slides.items.length}`);
