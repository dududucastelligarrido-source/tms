import { useState, useMemo } from 'react'

type Direction = 'asc' | 'desc'

export function useSort<T>(data: T[], defaultKey: keyof T | null = null, defaultDir: Direction = 'asc') {
  const [key, setKey] = useState<keyof T | null>(defaultKey)
  const [dir, setDir] = useState<Direction>(defaultDir)

  function toggle(k: keyof T) {
    if (k === key) {
      setDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setKey(k)
      setDir('asc')
    }
  }

  const sorted = useMemo(() => {
    if (!key) return data
    return [...data].sort((a, b) => {
      const av = a[key]
      const bv = b[key]
      if (av == null) return 1
      if (bv == null) return -1
      let cmp = 0
      if (typeof av === 'string' && typeof bv === 'string') {
        cmp = av.localeCompare(bv, 'pt-BR')
      } else {
        cmp = av < bv ? -1 : av > bv ? 1 : 0
      }
      return dir === 'asc' ? cmp : -cmp
    })
  }, [data, key, dir])

  return { sorted, key, dir, toggle }
}

/** Ícone de seta para usar no <th> */
export function SortIcon({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="text-slate-700 ml-1 text-xs">↕</span>
  return <span className="text-blue-400 ml-1 text-xs">{dir === 'asc' ? '↑' : '↓'}</span>
}
