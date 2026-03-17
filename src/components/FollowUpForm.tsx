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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-5 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Name (optional)</Label>
          <Input
            placeholder="e.g. Reminder after 1h"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Delay (minutes)</Label>
          <Input
            type="number"
            min={1}
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(Number(e.target.value) || 60)}
            className="border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Message</Label>
        <textarea
          className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-transparent px-3 py-2 text-sm min-h-[100px] focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Follow-up message..."
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Media</Label>
        <div className="flex gap-2">
          {(['none', 'image', 'gif'] as const).map((t) => (
            <Button
              key={t}
              type="button"
              variant={mediaType === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => { setMediaType(t); if (t === 'none') setMediaUrl(''); }}
            >
              {t === 'none' ? 'None' : t === 'image' ? <><Image className="w-4 h-4 mr-1.5" /> Image</> : <><Film className="w-4 h-4 mr-1.5" /> GIF</>}
            </Button>
          ))}
        </div>
        {mediaType !== 'none' && (
          <Input
            className="mt-2 border-zinc-200 dark:border-zinc-800 focus-visible:ring-zinc-900 dark:focus-visible:ring-zinc-100"
            placeholder="Image/GIF URL or Telegram file_id"
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
          />
        )}
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-zinc-900 dark:text-zinc-50">Buttons (optional)</Label>
        <div className="space-y-2">
          {buttons.map((b, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="Button text" value={b.text} onChange={(e) => {
                const n = [...buttons]; n[i] = { ...n[i], text: e.target.value }; setButtons(n);
              }} className="border-zinc-200 dark:border-zinc-800" />
              <Input placeholder="URL" value={b.url} onChange={(e) => {
                const n = [...buttons]; n[i] = { ...n[i], url: e.target.value }; setButtons(n);
              }} className="border-zinc-200 dark:border-zinc-800" />
              <Button variant="ghost" size="sm" onClick={() => setButtons(buttons.filter((_, j) => j !== i))} className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30">Remove</Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setButtons([...buttons, { text: '', url: '' }])}>Add button</Button>
        </div>
      </div>
      <div className="flex items-center gap-2 pt-2">
        <input
          type="checkbox"
          id="fu-enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
        />
        <Label htmlFor="fu-enabled" className="text-sm cursor-pointer text-zinc-700 dark:text-zinc-300">Enabled</Label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <Button
          variant="outline"
          size="sm"
          disabled={!message.trim() || previewSending}
          onClick={handlePreview}
        >
          <SendHorizontal className="w-4 h-4 mr-2" /> {previewSending ? 'Sending...' : 'Send Preview'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button size="sm" disabled={!message.trim() || saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Follow-up'}
          </Button>
        </div>
      </div>
    </div>
  )
}
