import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "@oai/artifact-tool";

const outDir = "/Users/katherinebui/Documents/SacKySpace/.codex-build/audit";
const sources = [
  { name: "chapter", path: "/Users/katherinebui/Downloads/The Vietnam Chapter of ICF - Chapter Talk Aug 2026.pptx" },
  { name: "reference", path: "/Users/katherinebui/Downloads/ICF New Accreditation & Credential Standards.pptx" },
];

await fs.mkdir(outDir, { recursive: true });

for (const source of sources) {
  const pres = await PresentationFile.importPptx(await FileBlob.load(source.path));
  const slideItems = pres.slides.items ?? [];
  const inspect = await pres.inspect({
    kind: "slide,textbox,shape,image,table,chart,notes,layout",
    maxChars: 120000,
  });
  await fs.writeFile(path.join(outDir, `${source.name}.inspect.ndjson`), inspect.ndjson ?? String(inspect));
  const summary = {
    name: source.name,
    slideCount: slideItems.length,
    slideSize: pres.slideSize ?? pres.size ?? null,
    slides: slideItems.map((slide, index) => ({
      index: index + 1,
      id: slide.id ?? null,
      layout: slide.layout?.name ?? slide.layout?.id ?? null,
      shapeCount: slide.shapes?.items?.length ?? null,
      chartCount: slide.charts?.items?.length ?? null,
      tableCount: slide.tables?.items?.length ?? null,
    })),
  };
  await fs.writeFile(path.join(outDir, `${source.name}.summary.json`), JSON.stringify(summary, null, 2));
  for (let i = 0; i < slideItems.length; i++) {
    const png = await slideItems[i].export({ format: "png", scale: 0.6 });
    await fs.writeFile(path.join(outDir, `${source.name}-${String(i + 1).padStart(3, "0")}.png`), new Uint8Array(await png.arrayBuffer()));
  }
}

console.log("audit complete");
