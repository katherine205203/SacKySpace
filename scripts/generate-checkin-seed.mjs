import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(scriptDirectory, '..')
const dataDirectory = path.join(repositoryRoot, 'docs/checkin-v2/data')
const outputPath = path.join(
  repositoryRoot,
  'supabase/migrations/20260827000001_checkin_v2_reference_seed.sql',
)

const datasets = [
  {
    file: 'emotion_families_11.tsv',
    table: 'public.emotion_families',
    columns: [
      'emotion_family_id',
      'family_code',
      'family_name_vn',
      'family_name_en',
      'color_hex',
      'active',
      'sort_order',
    ],
  },
  {
    file: 'emotions_117_remap_authoritative.tsv',
    table: 'public.emotions',
    columns: [
      'emotion_id',
      'emotion_family_id',
      'emotion_name_vn',
      'emotion_name_en',
      'emoji',
      'color_hex',
      'description_vn',
      'description_en',
      'active',
      'sort_order',
    ],
  },
  {
    file: 'need_groups.tsv',
    table: 'public.need_groups',
    columns: [
      'need_group_id',
      'group_code',
      'group_name_vn',
      'group_name_en',
      'color_hex',
      'active',
      'sort_order',
    ],
  },
  {
    file: 'needs.tsv',
    table: 'public.needs',
    columns: [
      'need_id',
      'need_group_id',
      'need_name_vn',
      'need_name_en',
      'emoji',
      'color_hex',
      'description_vn',
      'description_en',
      'active',
      'sort_order',
    ],
  },
  {
    file: 'contexts.tsv',
    table: 'public.contexts',
    columns: [
      'context_id',
      'context_group',
      'context_name_vn',
      'emoji',
      'color_hex',
      'description_vn',
      'active',
      'sort_order',
    ],
  },
  {
    file: 'unknown_prompts.tsv',
    table: 'public.unknown_prompts',
    columns: ['prompt_id', 'emoji', 'prompt_text_vn', 'active', 'sort_order'],
  },
  {
    file: 'care_actions.tsv',
    table: 'public.care_actions',
    columns: [
      'care_action_id',
      'care_group',
      'emoji',
      'title_vn',
      'description_vn',
      'duration_min',
      'active',
      'sort_order',
    ],
  },
]

const sqlString = (value) => `'${String(value).replaceAll("'", "''")}'`

const sqlValue = (column, value) => {
  if (value === '') return 'NULL'
  if (column === 'active') return String(value).toLowerCase()
  if (column === 'sort_order' || column === 'duration_min') return value
  return sqlString(value)
}

const readTsv = async (file) => {
  const content = await readFile(path.join(dataDirectory, file), 'utf8')
  const lines = content.replace(/^\uFEFF/, '').trimEnd().split(/\r?\n/)
  const headers = lines.shift().split('\t')
  return lines.filter(Boolean).map((line) => {
    const values = line.split('\t')
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

const chunks = []
for (const dataset of datasets) {
  const rows = await readTsv(dataset.file)
  const expectedColumns = dataset.columns.join(', ')
  const assignments = dataset.columns
    .slice(1)
    .map((column) => `${column} = excluded.${column}`)
    .join(',\n  ')
  const values = rows
    .map(
      (row) =>
        `(${dataset.columns.map((column) => sqlValue(column, row[column])).join(', ')})`,
    )
    .join(',\n')

  chunks.push(`-- ${dataset.file}: ${rows.length} rows\n`)
  chunks.push(
    `insert into ${dataset.table} (${expectedColumns})\nvalues\n${values}\non conflict (${dataset.columns[0]}) do update set\n  ${assignments};\n`,
  )
}

const output = `-- Generated from the authoritative Check-in v2 TSV reference pack.\n-- Do not edit individual rows here; update the TSV source and regenerate.\n\nbegin;\n\n${chunks.join('\n')}\ncommit;\n`
await writeFile(outputPath, output, 'utf8')

console.log(`Generated ${outputPath}`)
for (const dataset of datasets) {
  const rows = await readTsv(dataset.file)
  console.log(`${dataset.table}: ${rows.length}`)
}
