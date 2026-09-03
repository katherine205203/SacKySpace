export type UiContentElementType =
  | 'title'
  | 'subtitle'
  | 'section_title'
  | 'button'
  | 'tab'
  | 'label'
  | 'helper'
  | 'empty_state'
  | 'confirmation'
  | 'system_message'

export type UiContentMaxLengthMode = 'hard' | 'warning'

export type UiContentDefinition = {
  module: string
  screen: string
  element: string
  elementType: UiContentElementType
  defaultTextVn: string
  defaultTextEn: string | null
  maxLength: number | null
  maxLengthMode: UiContentMaxLengthMode
  protected?: boolean
  description?: string
  placementHint?: string
}

export const UI_CONTENT_DEFAULTS: Record<string, UiContentDefinition> = {
  'home.landing.hero_eyebrow': { module: 'Home', screen: 'Landing', element: 'Hero eyebrow', elementType: 'label', defaultTextVn: 'Sắc Ký · Home', defaultTextEn: null, maxLength: 32, maxLengthMode: 'hard' },
  'home.landing.hero_subtitle': { module: 'Home', screen: 'Landing', element: 'Hero subtitle', elementType: 'subtitle', defaultTextVn: 'Hôm nay là một ngày mới, hãy lắng nghe mình nhé.', defaultTextEn: null, maxLength: 100, maxLengthMode: 'warning' },
  'home.landing.orb_title': { module: 'Home', screen: 'Landing', element: 'Color Orb title', elementType: 'section_title', defaultTextVn: 'Khoảng màu hiện tại', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'home.landing.checkin_cta': { module: 'Home', screen: 'Landing', element: 'Check-in CTA', elementType: 'button', defaultTextVn: 'Check-in ngay', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },
  'home.landing.journey_title': { module: 'Home', screen: 'Landing', element: 'Recent journey title', elementType: 'section_title', defaultTextVn: 'Hành trình gần đây', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'home.landing.journey_history': { module: 'Home', screen: 'Landing', element: 'Recent journey history link', elementType: 'button', defaultTextVn: 'Xem lịch sử', defaultTextEn: null, maxLength: 20, maxLengthMode: 'hard' },
  'home.landing.action_title': { module: 'Home', screen: 'Landing', element: 'Action section title', elementType: 'section_title', defaultTextVn: 'Việc cần làm', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },
  'home.landing.action_view_all': { module: 'Home', screen: 'Landing', element: 'Action view all link', elementType: 'button', defaultTextVn: 'Xem tất cả', defaultTextEn: null, maxLength: 20, maxLengthMode: 'hard' },
  'home.landing.action_today_empty': { module: 'Home', screen: 'Landing', element: 'Today action empty state', elementType: 'empty_state', defaultTextVn: 'Hôm nay chưa có việc cần làm.', defaultTextEn: null, maxLength: 100, maxLengthMode: 'warning' },
  'home.landing.action_upcoming_empty': { module: 'Home', screen: 'Landing', element: 'Upcoming action empty state', elementType: 'empty_state', defaultTextVn: 'Chưa có action sắp tới.', defaultTextEn: null, maxLength: 100, maxLengthMode: 'warning' },
  'home.landing.action_overdue_empty': { module: 'Home', screen: 'Landing', element: 'Overdue action empty state', elementType: 'empty_state', defaultTextVn: 'Không có action quá hạn.', defaultTextEn: null, maxLength: 100, maxLengthMode: 'warning' },
  'home.landing.action_unscheduled': { module: 'Home', screen: 'Landing', element: 'Unscheduled affordance', elementType: 'helper', defaultTextVn: '{count} việc chưa lên lịch', defaultTextEn: null, maxLength: 60, maxLengthMode: 'warning' },
  'home.landing.diary_title': { module: 'Home', screen: 'Landing', element: 'Diary section title', elementType: 'section_title', defaultTextVn: 'Nhật ký hôm nay', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },
  'home.landing.diary_empty': { module: 'Home', screen: 'Landing', element: 'Diary empty state', elementType: 'empty_state', defaultTextVn: 'Hôm nay vẫn còn một khoảng trống để bạn viết xuống điều đang ở lại.', defaultTextEn: null, maxLength: 160, maxLengthMode: 'warning' },
  'home.landing.diary_start': { module: 'Home', screen: 'Landing', element: 'Diary empty CTA', elementType: 'button', defaultTextVn: 'Bắt đầu viết', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },
  'home.landing.for_me_title': { module: 'Home', screen: 'Landing', element: 'Personal surfaces title', elementType: 'section_title', defaultTextVn: 'Dành cho mình', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },
  'home.landing.future_letter_title': { module: 'Home', screen: 'Landing', element: 'Future letter surface title', elementType: 'title', defaultTextVn: 'Thư cho mình', defaultTextEn: null, maxLength: 32, maxLengthMode: 'warning' },
  'home.landing.gift_title': { module: 'Home', screen: 'Landing', element: 'Gift surface title', elementType: 'title', defaultTextVn: 'Quà cho ngày mai', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },

  'checkin.landing.eyebrow': { module: 'Check-in', screen: 'Landing', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'Sắc Ký · Check-in', defaultTextEn: null, maxLength: 32, maxLengthMode: 'hard' },
  'checkin.landing.title': { module: 'Check-in', screen: 'Landing', element: 'Page title', elementType: 'title', defaultTextVn: 'Check-in', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'checkin.landing.subtitle': { module: 'Check-in', screen: 'Landing', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Dành vài phút lắng nghe và hiểu mình hơn mỗi ngày.', defaultTextEn: null, maxLength: 100, maxLengthMode: 'warning' },
  'checkin.landing.history': { module: 'Check-in', screen: 'Landing', element: 'History button', elementType: 'button', defaultTextVn: 'Lịch sử check-in', defaultTextEn: null, maxLength: 32, maxLengthMode: 'hard' },
  'checkin.landing.emotion_title': { module: 'Check-in', screen: 'Landing', element: 'Emotion card title', elementType: 'title', defaultTextVn: 'Emotion Check-in', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },
  'checkin.landing.emotion_copy': { module: 'Check-in', screen: 'Landing', element: 'Emotion card copy', elementType: 'helper', defaultTextVn: 'Hiểu cảm xúc hiện tại và chăm sóc bản thân tốt hơn mỗi ngày.', defaultTextEn: null, maxLength: 140, maxLengthMode: 'warning' },
  'checkin.landing.unknown_title': { module: 'Check-in', screen: 'Landing', element: 'Unknown card title', elementType: 'title', defaultTextVn: 'Unknown Check-in', defaultTextEn: null, maxLength: 40, maxLengthMode: 'warning' },
  'checkin.landing.unknown_copy': { module: 'Check-in', screen: 'Landing', element: 'Unknown card copy', elementType: 'helper', defaultTextVn: 'Chưa gọi tên được cảm xúc? Viết ra những gì đang hiện diện.', defaultTextEn: null, maxLength: 140, maxLengthMode: 'warning' },

  'diary.landing.eyebrow': { module: 'Diary', screen: 'Landing', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'Diary', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },
  'diary.landing.title': { module: 'Diary', screen: 'Landing', element: 'Page title', elementType: 'title', defaultTextVn: 'Nhật ký hôm nay', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'diary.landing.subtitle': { module: 'Diary', screen: 'Landing', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Một khoảng lặng để bạn ghi lại điều đang ở cùng mình.', defaultTextEn: null, maxLength: 120, maxLengthMode: 'warning' },
  'diary.landing.history': { module: 'Diary', screen: 'Landing', element: 'History button', elementType: 'button', defaultTextVn: 'Lịch sử nhật ký', defaultTextEn: null, maxLength: 32, maxLengthMode: 'hard' },
  'diary.journey.setup.eyebrow': { module: 'Diary', screen: 'Journey setup', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'Nhật ký chặng', defaultTextEn: null, maxLength: 32, maxLengthMode: 'hard' },
  'diary.journey.setup.title': { module: 'Diary', screen: 'Journey setup', element: 'Page title', elementType: 'title', defaultTextVn: 'Nhìn lại một chặng', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'diary.journey.setup.subtitle': { module: 'Diary', screen: 'Journey setup', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Chọn bất kỳ khoảng thời gian nào bạn muốn để nhìn lại hành trình của mình một cách trọn vẹn và ý nghĩa.', defaultTextEn: null, maxLength: 180, maxLengthMode: 'warning' },
  'diary.journey.setup.start': { module: 'Diary', screen: 'Journey setup', element: 'Start writing button', elementType: 'button', defaultTextVn: 'Bắt đầu viết', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },

  'actionspace.landing.eyebrow': { module: 'Action Space', screen: 'Landing', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'Sắc Ký · Capture → Plan → Reflect', defaultTextEn: null, maxLength: 48, maxLengthMode: 'hard' },
  'actionspace.landing.title': { module: 'Action Space', screen: 'Landing', element: 'Page title', elementType: 'title', defaultTextVn: 'Action Space', defaultTextEn: null, maxLength: 48, maxLengthMode: 'warning' },
  'actionspace.landing.subtitle': { module: 'Action Space', screen: 'Landing', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Những bước nhỏ đang chờ bạn — có thể lên lịch, hoặc để dành cho lúc sẵn sàng.', defaultTextEn: null, maxLength: 140, maxLengthMode: 'warning' },
  'actionspace.landing.add_button': { module: 'Action Space', screen: 'Landing', element: 'Create action button', elementType: 'button', defaultTextVn: '＋ Viết action', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },
  'actionspace.landing.today_empty': { module: 'Action Space', screen: 'Landing', element: 'Today empty state', elementType: 'empty_state', defaultTextVn: 'Hôm nay chưa có bước nào được lên lịch.', defaultTextEn: null, maxLength: 120, maxLengthMode: 'warning' },

  'futureletter.landing.eyebrow': { module: 'Future Letter', screen: 'Landing', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'FutureMe / Future Letter', defaultTextEn: null, maxLength: 40, maxLengthMode: 'hard' },
  'futureletter.landing.title': { module: 'Future Letter', screen: 'Landing', element: 'Page title', elementType: 'title', defaultTextVn: 'Những điều mình gửi về sau', defaultTextEn: null, maxLength: 64, maxLengthMode: 'warning' },
  'futureletter.landing.subtitle': { module: 'Future Letter', screen: 'Landing', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Viết từ hôm nay, để một phiên bản tương lai của mình gặp được những lời này.', defaultTextEn: null, maxLength: 140, maxLengthMode: 'warning' },
  'futureletter.landing.new_button': { module: 'Future Letter', screen: 'Landing', element: 'Create letter button', elementType: 'button', defaultTextVn: '＋ Viết thư mới', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },
  'futureletter.landing.empty_title': { module: 'Future Letter', screen: 'Landing', element: 'Empty state title', elementType: 'empty_state', defaultTextVn: 'Chưa có lá thư nào ở đây', defaultTextEn: null, maxLength: 64, maxLengthMode: 'warning' },
  'futureletter.landing.empty_copy': { module: 'Future Letter', screen: 'Landing', element: 'Empty state copy', elementType: 'empty_state', defaultTextVn: 'Một lá thư không phải lời nhắc. Nó là một điều mình muốn gửi tới chính mình vào một thời điểm có ý nghĩa.', defaultTextEn: null, maxLength: 180, maxLengthMode: 'warning' },

  'gift.landing.eyebrow': { module: 'Gift for Tomorrow', screen: 'Landing', element: 'Page eyebrow', elementType: 'label', defaultTextVn: 'Sắc Ký · Gift for Tomorrow', defaultTextEn: null, maxLength: 44, maxLengthMode: 'hard' },
  'gift.landing.title': { module: 'Gift for Tomorrow', screen: 'Landing', element: 'Page title', elementType: 'title', defaultTextVn: 'Một món quà cho ngày mai.', defaultTextEn: null, maxLength: 64, maxLengthMode: 'warning' },
  'gift.landing.subtitle': { module: 'Gift for Tomorrow', screen: 'Landing', element: 'Page subtitle', elementType: 'subtitle', defaultTextVn: 'Gửi cho mình một điều nhỏ hôm nay. Ngày mai, mình sẽ nhận lại nó.', defaultTextEn: null, maxLength: 140, maxLengthMode: 'warning' },
  'gift.landing.question_button': { module: 'Gift for Tomorrow', screen: 'Landing', element: 'Question CTA', elementType: 'button', defaultTextVn: 'Gửi một câu hỏi', defaultTextEn: null, maxLength: 28, maxLengthMode: 'hard' },
  'gift.landing.message_button': { module: 'Gift for Tomorrow', screen: 'Landing', element: 'Message CTA', elementType: 'button', defaultTextVn: 'Gửi lời nhắn', defaultTextEn: null, maxLength: 24, maxLengthMode: 'hard' },

  'system.auth.required': { module: 'System', screen: 'Global', element: 'Authentication required', elementType: 'system_message', defaultTextVn: 'Bạn cần đăng nhập để tiếp tục.', defaultTextEn: null, maxLength: 80, maxLengthMode: 'hard', protected: true, description: 'Thông báo hệ thống bảo vệ để không bị chỉnh nhầm.' },
}

export const getUiContentDefinition = (contentKey: string): UiContentDefinition | undefined => UI_CONTENT_DEFAULTS[contentKey]

export const uiContentDefaultText = (contentKey: string, fallback = contentKey): string => getUiContentDefinition(contentKey)?.defaultTextVn ?? fallback
