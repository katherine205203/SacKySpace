import type { AdminEntityDefinition } from './types'

export const ADMIN_ENTITY_REGISTRY: AdminEntityDefinition[] = [
  { key: 'emotion_families', label: 'Nhóm cảm xúc', module: 'Check-in', table: 'emotion_families', idField: 'emotion_family_id', displayField: 'family_name_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['emotions.emotion_family_id'], fields: [
    { key: 'family_code', label: 'Mã nhóm', type: 'text', required: true }, { key: 'family_name_vn', label: 'Tên tiếng Việt', type: 'text', required: true }, { key: 'family_name_en', label: 'Tên tiếng Anh', type: 'text', required: true }, { key: 'color_hex', label: 'Màu', type: 'color', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'emotions', label: 'Cảm xúc', module: 'Check-in', table: 'emotions', idField: 'emotion_id', displayField: 'emotion_name_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['checkins.primary_emotion_id', 'checkin_secondary_emotions.emotion_id', 'diary_entries.daily_emotion_id', 'gifts.emotion_id'], fields: [
    { key: 'emotion_family_id', label: 'Nhóm cảm xúc', type: 'text', required: true }, { key: 'emotion_name_vn', label: 'Tên tiếng Việt', type: 'text', required: true }, { key: 'emotion_name_en', label: 'Tên tiếng Anh', type: 'text', required: true }, { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'color_hex', label: 'Màu', type: 'color', required: true }, { key: 'description_vn', label: 'Mô tả tiếng Việt', type: 'textarea', required: true }, { key: 'description_en', label: 'Mô tả tiếng Anh', type: 'textarea', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'need_groups', label: 'Nhóm nhu cầu', module: 'Check-in', table: 'need_groups', idField: 'need_group_id', displayField: 'group_name_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['needs.need_group_id'], fields: [
    { key: 'group_code', label: 'Mã nhóm', type: 'text', required: true }, { key: 'group_name_vn', label: 'Tên tiếng Việt', type: 'text', required: true }, { key: 'group_name_en', label: 'Tên tiếng Anh', type: 'text', required: true }, { key: 'color_hex', label: 'Màu', type: 'color', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'needs', label: 'Nhu cầu', module: 'Check-in', table: 'needs', idField: 'need_id', displayField: 'need_name_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['checkin_needs.need_id'], fields: [
    { key: 'need_group_id', label: 'Nhóm nhu cầu', type: 'text', required: true }, { key: 'need_name_vn', label: 'Tên tiếng Việt', type: 'text', required: true }, { key: 'need_name_en', label: 'Tên tiếng Anh', type: 'text', required: true }, { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'color_hex', label: 'Màu', type: 'color', required: true }, { key: 'description_vn', label: 'Mô tả tiếng Việt', type: 'textarea', required: true }, { key: 'description_en', label: 'Mô tả tiếng Anh', type: 'textarea', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'contexts', label: 'Bối cảnh', module: 'Check-in', table: 'contexts', idField: 'context_id', displayField: 'context_name_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['checkin_contexts.context_id'], fields: [
    { key: 'context_group', label: 'Nhóm bối cảnh', type: 'text', required: true }, { key: 'context_name_vn', label: 'Tên tiếng Việt', type: 'text', required: true }, { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'color_hex', label: 'Màu', type: 'color', required: true }, { key: 'description_vn', label: 'Mô tả', type: 'textarea', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'unknown_prompts', label: 'Unknown prompts', module: 'Check-in', table: 'unknown_prompts', idField: 'prompt_id', displayField: 'prompt_text_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['checkins.unknown_prompt_id'], fields: [
    { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'prompt_text_vn', label: 'Nội dung prompt', type: 'textarea', required: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'care_actions', label: 'Action Catalog', module: 'Action Space', table: 'care_actions', idField: 'care_action_id', displayField: 'title_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['reminders.care_action_id'], fields: [
    { key: 'care_group', label: 'Nhóm Action', type: 'text', required: true }, { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'title_vn', label: 'Tên Action', type: 'text', required: true }, { key: 'description_vn', label: 'Mô tả', type: 'textarea', required: true }, { key: 'duration_min', label: 'Số phút', type: 'number' }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'diary_prompts', label: 'Diary prompts', module: 'Diary', table: 'diary_prompts', idField: 'id', displayField: 'text_vn', activeField: 'active', sortField: 'sort_order', usedBy: ['diary_prompt_responses.prompt_id'], fields: [
    { key: 'code', label: 'Code', type: 'text', required: true }, { key: 'text_vn', label: 'Nội dung tiếng Việt', type: 'textarea', required: true }, { key: 'text_en', label: 'Nội dung tiếng Anh', type: 'textarea' }, { key: 'emoji', label: 'Emoji', type: 'text', required: true }, { key: 'hex_color', label: 'Màu', type: 'color', required: true }, { key: 'description', label: 'Mô tả', type: 'textarea' }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'action_reflection_outcomes', label: 'Reflection Outcomes', module: 'Action Space', table: 'action_reflection_outcomes', idField: 'id', displayField: 'label_vn', activeField: 'is_active', sortField: 'sort_order', usedBy: ['action_reflections.outcome_id'], fields: [
    { key: 'label_vn', label: 'Nhãn', type: 'text', required: true }, { key: 'semantic_group', label: 'Semantic group', type: 'text', required: true }, { key: 'is_active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
  { key: 'gift_box_styles', label: 'Gift box styles', module: 'Gift for Tomorrow', table: 'gift_box_styles', idField: 'id', displayField: 'name', activeField: 'active', sortField: 'sort_order', usedBy: ['gifts.box_style_id'], fields: [
    { key: 'name', label: 'Tên style', type: 'text', required: true }, { key: 'palette', label: 'Palette JSON', type: 'text', required: true, advanced: true }, { key: 'ribbon', label: 'Ribbon', type: 'color', required: true }, { key: 'shape', label: 'Shape', type: 'text', required: true }, { key: 'config', label: 'Config JSON', type: 'textarea', advanced: true }, { key: 'active', label: 'Đang hoạt động', type: 'boolean' }, { key: 'sort_order', label: 'Thứ tự', type: 'number' },
  ] },
]

export const getAdminEntity = (key: string): AdminEntityDefinition => {
  const definition = ADMIN_ENTITY_REGISTRY.find((item) => item.key === key)
  if (!definition) throw new Error('Entity không được đăng ký trong Admin Studio.')
  return definition
}
