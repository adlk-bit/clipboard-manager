import { useStore } from '../stores/useStore'

export default function SearchBar() {
  const searchQuery = useStore((s) => s.searchQuery)
  const setSearchQuery = useStore((s) => s.setSearchQuery)

  return (
    <div className="relative">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="搜索..."
        className="no-drag w-36 text-xs px-3 py-1.5 rounded-lg border border-primary-200 dark:border-gray-600 bg-primary-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-400 dark:focus:border-primary-500 focus:ring-1 focus:ring-primary-300 dark:focus:ring-primary-700 transition-all"
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 text-xs"
        >
          ✕
        </button>
      )}
    </div>
  )
}
