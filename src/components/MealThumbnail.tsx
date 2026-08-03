import { useEffect, useState } from 'react'
import type { MealOption } from '../types'

interface MealThumbnailProps {
  option?: MealOption
  className: string
  badge?: string
}

export function MealThumbnail({ option, className, badge }: MealThumbnailProps) {
  const [imageFailed, setImageFailed] = useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [option?.imageUrl])

  const showImage = Boolean(option?.imageUrl) && !imageFailed

  return (
    <span className={className} style={{ background: option?.color ?? 'var(--surface-strong)' }}>
      {showImage ? <img src={option?.imageUrl} alt="" onError={() => setImageFailed(true)} /> : <span className="meal-thumb-fallback">{option?.glyph ?? '＋'}</span>}
      {badge && <small>{badge}</small>}
    </span>
  )
}
