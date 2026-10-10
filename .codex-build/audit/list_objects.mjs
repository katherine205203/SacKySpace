import { FileBlob, PresentationFile } from "@oai/artifact-tool";
const p = await PresentationFile.importPptx(await FileBlob.load("/Users/katherinebui/Downloads/The Vietnam Chapter of ICF - Chapter Talk Aug 2026.pptx"));
for (let i = 0; i < p.slides.items.length; i++) {
  const slide = p.slides.items[i];
  console.log(`SLIDE ${i + 1} frame=${JSON.stringify(slide.frame)}`);
  for (let j = 0; j < (slide.shapes.items ?? []).length; j++) {
    const sh = slide.shapes.items[j];
    let txt = "";
    try { txt = String(sh.text ?? "").replace(/\n/g, " | ").slice(0, 200); } catch {}
    console.log(`  SH ${j + 1} type=${sh.type} frame=${JSON.stringify(sh.frame)} text=${JSON.stringify(txt)}`);
  }
  for (let j = 0; j < (slide.images.items ?? []).length; j++) {
    const im = slide.images.items[j];
    console.log(`  IM ${j + 1} frame=${JSON.stringify(im.frame)} alt=${JSON.stringify(im.alt)}`);
  }
}
