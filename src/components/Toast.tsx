import { useEffect, useState } from 'react'

interface ToastProps {
  message: string
  type?: 'success' | 'info'
  onClose: () => void
}

export default function Toast({ message, type = 'success', onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Trigger enter animation
    requestAnimationFrame(() => setVisible(true))

    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onClose, 200) // Wait for exit animation
    }, 1500)

    return () => clearTimeout(timer)
  }, [onClose])

  return (
    <div
      className={`fixed bottom-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg text-sm font-medium transition-all duration-200 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-2'
      } ${
        type === 'success'
          ? 'bg-primary-500 text-white'
          : 'bg-gray-700 text-white'
      }`}
    >
      {message}
    </div>
  )
}
