import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import XLSX from 'xlsx'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const legacySeedPath = path.join(repositoryRoot, 'supabase/migrations/20260827000001_checkin_v2_reference_seed.sql')
const defaultOutputPath = path.join(repositoryRoot, 'supabase/migrations/20260910000000_emotion_reference_151.sql')
const inputPath = process.argv[2]
const outputPath = process.argv[3] ?? defaultOutputPath

if (!inputPath) {
  console.error('Usage: node scripts/generate-emotion-reference-migration.mjs <xlsx-path> [output-path]')
  process.exit(1)
}

const familyColumns = [
  'emotion_family_id',
  'family_code',
  'family_name_vn',
  'family_name_en',
  'color_hex',
  'active',
  'sort_order',
]

const emotionColumns = [
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
]

const replacementByLegacyId = {
  EMO_087: 'EMO_040', // Chân thật – Được là mình -> Cảm thấy được là mình
  EMO_102: 'EMO_124', // Buồn & nhớ khắc khoải -> Nhớ thương khắc khoải
  EMO_103: 'EMO_048', // Sonder -> Chợt thấy mỗi người một câu chuyện
  EMO_104: 'EMO_151', // Mauerbauertraurigkeit -> Muốn khép mình lại
  EMO_105: 'EMO_136', // Sợ sự bình thường - mờ nhạt -> Sợ mình mờ nhạt
  EMO_106: 'EMO_141', // Altschmerz -> Mỏi mệt chuyện cũ
  EMO_107: 'EMO_072', // Mamihlapinatapai -> Ngập ngừng chờ nhau
  EMO_108: 'EMO_128', // Đời... vô thường ha? -> Xao lòng trước vô thường
  EMO_109: 'EMO_058', // Bất lực không thể gọi tên cảm xúc -> Khó gọi tên cảm xúc
  EMO_110: 'EMO_049', // Metanoia -> Chuyển biến trong cách nhìn
  EMO_111: 'EMO_126', // Hoài niệm ngọt ngàooo -> Hoài niệm ấm áp
  EMO_112: 'EMO_013', // Nụ cười… mất dần nhân tính -> Hả hê trước điều không may của người khác
  EMO_113: 'EMO_079', // Dépaysement -> Lạc nhịp nơi xa lạ
  EMO_115: 'EMO_024', // Cưng xỉu!!!! Moeeee -> Cưng quá muốn ôm siết
  EMO_116: 'EMO_038', // Vui kiểu... vương vấn sau ăn uống nhâm nhi. -> Luyến lưu sau bữa ăn
  EMO_117: 'EMO_142', // Kiểu... cuộn mình trong chăn ấm -> Muốn nán lại trong chăn
}

const normalize = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

const sqlString = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`

const sqlValue = (column, value) => {
  if (value === null || value === undefined || value === '') return 'NULL'
  if (column === 'active') return String(value).toLowerCase() === 'true' ? 'true' : 'false'
  if (column === 'sort_order') return String(Number(value))
  return sqlString(value)
}

const extractInsertTuples = (sql, table) => {
  const marker = `insert into public.${table}`
  const markerStart = sql.indexOf(marker)
  if (markerStart < 0) throw new Error(`Could not find INSERT for ${table}`)
  const valuesStart = sql.indexOf('values', markerStart) + 'values'.length
  const valuesEnd = sql.indexOf('on conflict', valuesStart)
  const body = sql.slice(valuesStart, valuesEnd)
  const tuples = []
  let tuple = []
  let depth = 0
  let quoted = false

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index]
    if (character === "'") {
      if (quoted && body[index + 1] === "'") {
        if (depth) tuple.push("''")
        index += 1
        continue
      }
      quoted = !quoted
      if (depth) tuple.push(character)
      continue
    }
    if (!quoted && character === '(') {
      if (depth === 0) tuple = []
      depth += 1
      if (depth > 1) tuple.push(character)
      continue
    }
    if (!quoted && character === ')') {
      depth -= 1
      if (depth === 0) tuples.push(tuple.join(''))
      else tuple.push(character)
      continue
    }
    if (depth) tuple.push(character)
  }
  return tuples
}

const splitSqlFields = (value) => {
  const fields = []
  let field = []
  let quoted = false
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index]
    if (character === "'") {
      if (quoted && value[index + 1] === "'") {
        field.push("''")
        index += 1
        continue
      }
      quoted = !quoted
      field.push(character)
      continue
    }
    if (!quoted && character === ',') {
      fields.push(field.join('').trim())
      field = []
      continue
    }
    field.push(character)
  }
  fields.push(field.join('').trim())
  return fields
}

const parseSqlValue = (value) => {
  if (value.startsWith("'") && value.endsWith("'")) return value.slice(1, -1).replaceAll("''", "'")
  if (value === 'true') return true
  if (value === 'false') return false
  if (value === 'NULL') return null
  const number = Number(value)
  return Number.isNaN(number) ? value : number
}

const parseSheet = (workbook, sheetName, columns) => {
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Missing workbook sheet: ${sheetName}`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true })
  const headers = rows.shift()?.map((value) => String(value ?? '').trim()) ?? []
  const missingColumns = columns.filter((column) => !headers.includes(column))
  if (missingColumns.length) throw new Error(`${sheetName} is missing columns: ${missingColumns.join(', ')}`)
  return rows
    .filter((row) => row.some((value) => value !== null && value !== ''))
    .map((row) => Object.fromEntries(columns.map((column) => [column, row[headers.indexOf(column)] ?? null])))
}

const emitUpsert = ({ table, columns, rows, comment }) => {
  const assignments = columns.slice(1).map((column) => `  ${column} = excluded.${column}`).join(',\n')
  const values = rows.map((row) => `(${columns.map((column) => sqlValue(column, row[column])).join(', ')})`).join(',\n')
  return `-- ${comment}: ${rows.length} rows\ninsert into ${table} (${columns.join(', ')})\nvalues\n${values}\non conflict (${columns[0]}) do update set\n${assignments};`
}

const workbook = XLSX.readFile(inputPath, { cellDates: false })
const families = parseSheet(workbook, 'Emotion_Family', familyColumns)
const emotions = parseSheet(workbook, 'Emotion_DB', emotionColumns)
if (!families.length) throw new Error('Workbook contains no emotion families')
if (!emotions.length) throw new Error('Workbook contains no emotions')

const familyIds = new Set(families.map((row) => row.emotion_family_id))
const emotionIds = new Set(emotions.map((row) => row.emotion_id))
if (familyIds.size !== families.length) throw new Error('Workbook contains duplicate emotion_family_id values')
if (emotionIds.size !== emotions.length) throw new Error('Workbook contains duplicate emotion_id values')
if (emotions.some((row) => !familyIds.has(row.emotion_family_id))) throw new Error('Workbook contains an emotion with an unknown family')

const legacySeed = await readFile(legacySeedPath, 'utf8')
const legacyRows = extractInsertTuples(legacySeed, 'emotions').map((tuple) => Object.fromEntries(
  splitSqlFields(tuple).map((value, index) => [emotionColumns[index], parseSqlValue(value)]),
))
if (legacyRows.length !== 117) throw new Error(`Expected 117 legacy emotions, received ${legacyRows.length}`)
if (new Set(legacyRows.map((row) => row.emotion_id)).size !== legacyRows.length) throw new Error('Legacy seed contains duplicate emotion_id values')
const newByName = new Map(emotions.map((row) => [normalize(row.emotion_name_vn), row]))
const newByEnglishName = new Map(emotions.map((row) => [normalize(row.emotion_name_en), row]))
const mapping = legacyRows.map((legacy) => {
  const exactMatch = newByName.get(normalize(legacy.emotion_name_vn)) ?? newByEnglishName.get(normalize(legacy.emotion_name_en))
  const newId = exactMatch?.emotion_id ?? replacementByLegacyId[legacy.emotion_id]
  if (!newId || !emotionIds.has(newId)) throw new Error(`No migration target for legacy ${legacy.emotion_id} (${legacy.emotion_name_vn})`)
  return { oldId: legacy.emotion_id, newId }
})
if (new Set(mapping.map(({ newId }) => newId)).size !== mapping.length) {
  throw new Error('Legacy emotion mapping is not one-to-one; resolve duplicate targets before generating a migration')
}

const mappingValues = mapping.map(({ oldId, newId }) => `(${sqlString(oldId)}, ${sqlString(newId)})`).join(',\n')
const replacementComment = Object.entries(replacementByLegacyId).map(([oldId, newId]) => `${oldId}→${newId}`).join(', ')

const output = `-- Generated from ${path.basename(inputPath)}.
-- The workbook reuses emotion IDs, so this migration remaps foreign keys by
-- the legacy canonical emotion before activating the new ${emotions.length}-emotion catalog.
-- Manual semantic replacements: ${replacementComment}

begin;

${emitUpsert({ table: 'public.emotion_families', columns: familyColumns, rows: families, comment: 'Emotion_Family workbook' })}

${emitUpsert({ table: 'public.emotions', columns: emotionColumns, rows: emotions, comment: 'Emotion_DB workbook' })}

create temporary table emotion_reference_id_migration (
  old_id text primary key,
  new_id text not null
) on commit drop;

insert into emotion_reference_id_migration (old_id, new_id)
values
${mappingValues};

-- Capture secondary relations before changing primary IDs. Rebuilding this
-- small relation table avoids PK collisions when two legacy IDs converge.
create temporary table emotion_secondary_reference_migration on commit drop as
select
  secondary.checkin_id,
  coalesce(migration.new_id, secondary.emotion_id) as emotion_id,
  min(secondary.position) as source_position
from public.checkin_secondary_emotions as secondary
left join emotion_reference_id_migration as migration on migration.old_id = secondary.emotion_id
group by secondary.checkin_id, coalesce(migration.new_id, secondary.emotion_id);

-- Snapshot JSON remains historical by design; only live foreign-key/reference
-- IDs are remapped so locked records do not get rewritten.
update public.checkins as checkin
set primary_emotion_id = migration.new_id
from emotion_reference_id_migration as migration
where checkin.primary_emotion_id = migration.old_id;

update public.diary_entries as diary
set daily_emotion_id = migration.new_id
from emotion_reference_id_migration as migration
where diary.daily_emotion_id = migration.old_id;

update public.journey_diary_entries as journey
set primary_emotion_id = migration.new_id
from emotion_reference_id_migration as migration
where journey.primary_emotion_id = migration.old_id;

update public.future_letter_context_attachments as attachment
set ref_id = migration.new_id
from emotion_reference_id_migration as migration
where attachment.attachment_type = 'emotion'
  and attachment.ref_id = migration.old_id;

update public.future_letter_rules as rule
set config_json = jsonb_set(rule.config_json, '{emotionId}', to_jsonb(migration.new_id), true)
from emotion_reference_id_migration as migration
where rule.rule_type = 'emotion_frequency'
  and rule.config_json ->> 'emotionId' = migration.old_id;

-- Locked/delivered gifts intentionally retain their content lock; this
-- maintenance update changes only the canonical reference ID.
alter table public.gifts disable trigger gifts_before_write;
update public.gifts as gift
set emotion_id = migration.new_id
from emotion_reference_id_migration as migration
where gift.emotion_id = migration.old_id;
alter table public.gifts enable trigger gifts_before_write;

delete from public.checkin_secondary_emotions;
insert into public.checkin_secondary_emotions (checkin_id, emotion_id, position)
select checkin_id, emotion_id, new_position::smallint
from (
  select
    migrated.checkin_id,
    migrated.emotion_id,
    row_number() over (partition by migrated.checkin_id order by migrated.source_position, migrated.emotion_id) as new_position,
    checkin.primary_emotion_id
  from emotion_secondary_reference_migration as migrated
  join public.checkins as checkin on checkin.id = migrated.checkin_id
  where migrated.emotion_id <> checkin.primary_emotion_id
) as deduplicated
where new_position <= 2;

-- Known legacy IDs that are not in the workbook are retained for auditability
-- but hidden from the active reference loader.
update public.emotions
set active = false
where emotion_id in (select old_id from emotion_reference_id_migration)
  and emotion_id not in (${[...emotionIds].map(sqlString).join(', ')})
  and active is distinct from false;

do $$
begin
  if exists (
    select 1
    from public.checkins
    where checkin_type = 'emotion'
      and (primary_emotion_id is null or not exists (select 1 from public.emotions where emotion_id = checkins.primary_emotion_id))
  ) then
    raise exception 'Emotion reference migration left an invalid check-in primary emotion';
  end if;
  if exists (
    select 1
    from public.checkin_secondary_emotions as secondary
    where not exists (select 1 from public.emotions where emotion_id = secondary.emotion_id)
  ) then
    raise exception 'Emotion reference migration left an invalid secondary emotion';
  end if;
end;
$$;

commit;
`

await writeFile(outputPath, output, 'utf8')
console.log(`Generated ${outputPath}`)
console.log(`emotion_families: ${families.length}`)
console.log(`emotions: ${emotions.length}`)
console.log(`legacy emotion mappings: ${mapping.length}`)
