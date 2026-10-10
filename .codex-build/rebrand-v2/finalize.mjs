import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const SKILL_DIR = "/Users/katherinebui/.codex/plugins/cache/openai-primary-runtime/presentations/26.905.11957/skills/presentations";
const workspaceDir = "/Users/katherinebui/Documents/SacKySpace";
const candidatePath = "/Users/katherinebui/Documents/SacKySpace/.codex-build/rebrand-v2/candidate.pptx";
const finalPath = "/Users/katherinebui/Documents/SacKySpace/output/The Vietnam Chapter of ICF - Chapter Talk Aug 2026_reformatted_v2.pptx";
const stagingDir = path.join(workspaceDir, ".codex-finalizer");
const RUNTIME_PYTHON = "/Users/katherinebui/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3";

await fs.mkdir(stagingDir, { recursive: true });
await fs.mkdir(path.dirname(finalPath), { recursive: true });

const { finalizePresentation } = await import(pathToFileURL(
  path.join(SKILL_DIR, "container_tools/artifact_tool_utils.mjs"),
).href);

const result = await finalizePresentation({
  explicitTotalSlideCount: 50,
  requiredNativeTableOwnerSlides: [8],
  requiredNativeChartOwnerSlides: [],
  workspaceDir,
  candidatePath,
  finalPath,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools/inspect_presentation_layout_geometry.py"),
  layoutArgs: [
    "--expected-slide-size-emu", "12192000,6858000",
    "--expected-slide-count", "50",
    "--validate-bullet-geometry",
    "--validate-heading-fit",
    "--require-native-table-slide", "8",
  ],
  fontPolicy: {
    basis: "reference",
    families: ["Hoss Round", "Plus Jakarta Sans"],
    referencePath: "/Users/katherinebui/Documents/ICF Brand Guidelines 2025-09-08.pdf",
    referenceSha256: "3fd113212e77a8b7b1212f56b1d889607d870ec07a84e71648f319387ca3db1f",
  },
  verifyArtifactToolImport: true,
  receiptPath: path.join(stagingDir, "The Vietnam Chapter of ICF - Chapter Talk Aug 2026_reformatted_v2.pptx.validation.json"),
});

console.log(JSON.stringify(result, null, 2));
