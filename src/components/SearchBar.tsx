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
        className="no-drag w-40 text-xs px-3 py-1.5 rounded-[10px] border border-transparent bg-[#ededf0] dark:bg-white/10 text-[#3a3a3c] dark:text-[#f5f5f7] placeholder-[#8e8e93] focus:outline-none focus:bg-white dark:focus:bg-[#3a3a3c] focus:border-[#0a84ff]/45 focus:ring-2 focus:ring-[#0a84ff]/15 transition-[background-color,border-color,box-shadow] duration-150"
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
