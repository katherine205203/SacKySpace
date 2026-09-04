import type { CSSProperties } from 'react'
import type { DiaryEmotionSnapshot } from '../types'

type DiaryEmotionVisualProps = {
  snapshot: DiaryEmotionSnapshot
  size?: 'default' | 'small'
}

export function DiaryEmotionVisual({ snapshot, size = 'default' }: DiaryEmotionVisualProps) {
  const description = snapshot.description_vn?.trim() || `Một ngày có sắc ${snapshot.emotion_name_vn}.`
  return <div
    className={`diary-emotion-visual diary-emotion-visual--${size}`}
    style={{ '--emotion-color': snapshot.color_hex } as CSSProperties}
    tabIndex={0}
    role="img"
    aria-label={`${snapshot.emotion_name_vn} · ${snapshot.emotion_name_en}`}
  >
    <span className="diary-emotion-visual__orb" aria-hidden="true"><span>{snapshot.emoji}</span></span>
    <strong>{snapshot.emotion_name_vn}</strong>
    <small>{snapshot.emotion_name_en}</small>
    <span className="diary-emotion-visual__tooltip" role="tooltip">{description}</span>
  </div>
}
