export type AdminMode = 'basic' | 'advanced'
export type AdminView = 'overview' | 'content' | 'data' | 'prompts' | 'import_export' | 'rules' | 'assets' | 'recovery' | 'audit'
export type AdminFieldType = 'text' | 'textarea' | 'number' | 'color' | 'boolean'

export type AdminField = {
  key: string
  label: string
  type: AdminFieldType
  required?: boolean
  advanced?: boolean
}

export type AdminEntityKey =
  | 'emotion_families'
  | 'emotions'
  | 'need_groups'
  | 'needs'
  | 'contexts'
  | 'unknown_prompts'
  | 'care_actions'
  | 'diary_prompts'
  | 'action_reflection_outcomes'
  | 'gift_box_styles'

export type AdminEntityDefinition = {
  key: AdminEntityKey
  label: string
  module: string
  table: string
  idField: string
  displayField: string
  activeField: string
  sortField: string
  fields: AdminField[]
  usedBy: string[]
}

export type AdminReferenceRow = Record<string, unknown>

export type AdminExportSelection = AdminEntityKey | 'audit_logs'

export type AdminExportDataset = {
  key: AdminExportSelection
  label: string
  table: string
  columns: string[]
  rows: AdminReferenceRow[]
}

export type AdminRuntimeConfig = {
  configKey: string
  module: string
  valueType: 'number' | 'boolean' | 'text' | 'json'
  scope: string
  defaultValue: unknown
  publishedValue: unknown
  draftValue: unknown
  configurabilityLevel: 'basic' | 'advanced'
  validationSchema: Record<string, unknown>
  dependencyTags: string[]
  publishedVersion: number
  effectiveFrom: string | null
  updatedAt: string
}

export type AdminConfigVersion = {
  id: string
  configKey: string
  version: number
  value: unknown
  status: string
  changeNote: string | null
  createdAt: string
}

export type AdminAsset = {
  assetId: string
  assetType: string
  name: string
  previewUrl: string | null
  active: boolean
  sortOrder: number
  provider: string
  currentVersion: number
  metadata: Record<string, unknown>
  updatedAt: string
}

export type AdminAuditLog = {
  id: string
  createdAt: string
  domain: string
  action: string
  entityType: string | null
  targetId: string | null
  before: unknown
  after: unknown
  version: number | null
}

export type AdminModuleCount = {
  key: string
  label: string
  count: number | null
  status: 'ok' | 'unavailable'
}

export type AdminUiContent = {
  id: string
  contentKey: string
  module: string
  screen: string
  element: string
  elementType: 'title' | 'subtitle' | 'section_title' | 'button' | 'tab' | 'label' | 'helper' | 'empty_state' | 'confirmation' | 'system_message'
  defaultTextVn: string
  textVn: string
  defaultTextEn: string | null
  textEn: string | null
  maxLength: number | null
  maxLengthMode: 'hard' | 'warning'
  protected: boolean
  active: boolean
  description: string | null
  placementHint: string | null
  updatedAt: string | null
  updatedBy: string | null
}
