'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Image, Film, SendHorizontal } from 'lucide-react'

export interface FollowUpFormData {
  name: string
  message: string
  delay_minutes: number
  media_type: 'none' | 'image' | 'gif'
  media_url: string
  enabled: boolean
  buttons?: { text: string; url: string }[]
}

interface FollowUpFormProps {
  segment: string
  initial?: {
    id: string
    name?: string | null
    message: string
    delay_minutes: number
    media_type?: string | null
    media_url?: string | null
    enabled?: boolean
    buttons?: { text: string; url?: string }[] | null
  }
  onSave: (d: FollowUpFormData) => Promise<void>
  onCancel: () => void
  saving: boolean
  previewSending: boolean
  onPreview: (d: { message: string; media_type?: string; media_url?: string; buttons?: { text: string; url?: string }[] }) => Promise<void>
}

export function FollowUpForm({
  segment,
  initial,
  onSave,
  onCancel,
  saving,
  previewSending,
  onPreview,
}: FollowUpFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [message, setMessage] = useState(initial?.message ?? '')
  const [delayMinutes, setDelayMinutes] = useState(initial?.delay_minutes ?? 60)
  const [mediaType, setMediaType] = useState<'none' | 'image' | 'gif'>(
    (initial?.media_type as 'none' | 'image' | 'gif') || 'none'
  )
  const [mediaUrl, setMediaUrl] = useState(initial?.media_url ?? '')
  const [enabled, setEnabled] = useState(initial?.enabled ?? true)
  const [buttons, setButtons] = useState<{ text: string; url: string }[]>(
    Array.isArray(initial?.buttons) && initial.buttons.length > 0
      ? initial.buttons.map((b) => ({ text: b.text || '', url: b.url || '' }))
      : []
  )

  useEffect(() => {
    if (initial) {
      setName(initial.name ?? '')
      setMessage(initial.message ?? '')
      setDelayMinutes(initial.delay_minutes ?? 60)
      setMediaType((initial.media_type as 'none' | 'image' | 'gif') || 'none')
      setMediaUrl(initial.media_url ?? '')
      setEnabled(initial.enabled ?? true)
      setButtons(
        Array.isArray(initial.buttons) && initial.buttons.length > 0
          ? initial.buttons.map((b) => ({ text: b.text || '', url: b.url || '' }))
          : []
      )
    }
  }, [initial])

  const validButtons = buttons.filter((b) => b.text.trim() && b.url.trim())

  const handleSave = () => {
    onSave({
      name,
      message,
      delay_minutes: delayMinutes,
      media_type: mediaType,
      media_url: mediaUrl,
      enabled,
      buttons: validButtons.length > 0 ? validButtons : undefined,
    })
  }

  const handlePreview = () => {
    onPreview({
      message,
      media_type: mediaType !== 'none' ? mediaType : undefined,
      media_url: mediaType !== 'none' && mediaUrl ? mediaUrl : undefined,
      buttons: validButtons.length > 0 ? validButtons : undefined,
    })
  }

  return (
    <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
      <div>
        <Label className="text-[10px] font-bold uppercase">Name (optional)</Label>
        <Input
          className="mt-1"
          placeholder="e.g. Reminder after 1h"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div>
        <Label className="text-[10px] font-bold uppercase">Delay (minutes)</Label>
        <Input
          type="number"
          className="mt-1"
          min={1}
          value={delayMinutes}
          onChange={(e) => setDelayMinutes(Number(e.target.value) || 60)}
        />
      </div>
      <div>
        <Label className="text-[10px] font-bold uppercase">Message</Label>
        <textarea
          className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[80px]"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Follow-up message..."
        />
      </div>
      <div>
        <Label className="text-[10px] font-bold uppercase">Media</Label>
        <div className="mt-1 flex gap-2">
          {(['none', 'image', 'gif'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={mediaType === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMediaType(t); if (t === 'none') setMediaUrl(''); }}
            >
              {t === 'none' ? 'None' : t === 'image' ? <><Image className="w-3.5 h-3.5 mr-1" /> Image</> : <><Film className="w-3.5 h-3.5 mr-1" /> GIF</>}
            </Button>
          ))}
        </div>
        {mediaType !== 'none' && (
          <Input
            className="mt-2"
            placeholder="Image/GIF URL or Telegram file_id"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
        )}
      </div>
      <div>
        <Label className="text-[10px] font-bold uppercase">Buttons (optional)</Label>
        <div className="mt-1 space-y-2">
          {buttons.map((b, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Button text" value={b.text} onChange={(e) => {
                const n = [...buttons]; n[i] = { ...n[i], text: e.target.value }; setButtons(n);
              }} />
              <Input placeholder="URL" value={b.url} onChange={(e) => {
                const n = [...buttons]; n[i] = { ...n[i], url: e.target.value }; setButtons(n);
              }} />
              <Button variant="ghost" size="sm" onClick={() => setButtons(buttons.filter((_, j) => j !== i))}>Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setButtons([...buttons, { text: '', url: '' }])}>Add button</Button>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="fu-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded"
        />
        <Label htmlFor="fu-enabled" className="text-xs cursor-pointer">Enabled</Label>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!message.trim() || previewSending}
          onClick={handlePreview}
        >
          <SendHorizontal className="w-3.5 h-3.5 mr-1" /> {previewSending ? 'Sending...' : 'Preview'}
        </Button>
        <Button size="sm" disabled={!message.trim() || saving} onClick={handleSave}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
