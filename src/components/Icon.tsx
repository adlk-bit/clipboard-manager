import type { SVGProps } from 'react'

export type IconName =
  | 'check'
  | 'chevron-down'
  | 'chevron-up'
  | 'clipboard'
  | 'copy'
  | 'download'
  | 'edit'
  | 'folder'
  | 'image'
  | 'link'
  | 'pause'
  | 'pin'
  | 'play'
  | 'plus'
  | 'search'
  | 'settings'
  | 'smile'
  | 'star'
  | 'tag'
  | 'trash'
  | 'upload'
  | 'warning'
  | 'x'
  | 'window-maximize'
  | 'window-minimize'
  | 'window-restore'

interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName
  size?: number
}

export default function Icon({ name, size = 16, ...props }: IconProps) {
  const paths = (() => {
    switch (name) {
      case 'check':
        return <path d="m5 12 4 4L19 6" />
      case 'chevron-down':
        return <path d="m8 10 4 4 4-4" />
      case 'chevron-up':
        return <path d="m8 14 4-4 4 4" />
      case 'clipboard':
        return <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4.5V3h6v1.5M9 9h6M9 13h6M9 17h4" /></>
      case 'copy':
        return <><rect x="8" y="8" width="11" height="12" rx="2" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" /></>
      case 'download':
        return <><path d="M12 3v11m0 0 4-4m-4 4-4-4" /><path d="M5 19h14" /></>
      case 'edit':
        return <><path d="M4 20h4l11-11-4-4L4 16Z" /><path d="m13.5 6.5 4 4M4 20h16" /></>
      case 'folder':
        return <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2h7.5A2.5 2.5 0 0 1 21 9.5v7A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5Z" />
      case 'image':
        return <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m4 17 5-4 3 3 3-2 5 4" /></>
      case 'link':
        return <><path d="M10 13a5 5 0 0 0 7.07.07l3-3A5 5 0 0 0 13 3l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.07-.07l-3 3A5 5 0 0 0 11 21l1.71-1.71" /></>
      case 'pause':
        return <><path d="M9 6v12M15 6v12" /></>
      case 'pin':
        return <><path d="m9 4 6 6M8 9l-3 3 7 7 3-3M12 5l3-2 6 6-2 3" /><path d="m8 16-5 5" /></>
      case 'play':
        return <path d="m9 6 9 6-9 6Z" />
      case 'plus':
        return <path d="M12 5v14M5 12h14" />
      case 'search':
        return <><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></>
      case 'settings':
        return <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1v.08h-4V21a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1-.4h-.08v-4H3A1.7 1.7 0 0 0 4.6 8.5a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1v-.08h4V3a1.7 1.7 0 0 0 1.1 1.6 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.38.38.72.6 1 .27.3.62.44 1 .4h.08v4H21a1.7 1.7 0 0 0-1.6 1.1Z" /></>
      case 'smile':
        return <><circle cx="12" cy="12" r="9" /><path d="M8.5 10h.01M15.5 10h.01M8 14.5c1 1.15 2.33 1.75 4 1.75s3-.6 4-1.75" /></>
      case 'star':
        return <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z" />
      case 'tag':
        return <><path d="M4 4h6l10 10-6 6L4 10Z" /><circle cx="8" cy="8" r="1" /></>
      case 'trash':
        return <><path d="M4 7h16M9 3h6l1 4M7 7l1 14h8l1-14M10 11v6M14 11v6" /></>
      case 'upload':
        return <><path d="M12 16V5m0 0L8 9m4-4 4 4" /><path d="M5 20h14" /></>
      case 'warning':
        return <><path d="M12 3 2.8 20h18.4Z" /><path d="M12 9v5m0 3h.01" /></>
      case 'x':
        return <path d="m7 7 10 10M17 7 7 17" />
      case 'window-minimize':
        return <path d="M4 15h16" />
      case 'window-maximize':
        return <rect x="5" y="5" width="14" height="14" rx="1" />
      case 'window-restore':
        return <><path d="M8 8V5h11v11h-3" /><rect x="5" y="8" width="11" height="11" rx="1" /></>
    }
  })()

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      {...props}
    >
      {paths}
    </svg>
  )
}
