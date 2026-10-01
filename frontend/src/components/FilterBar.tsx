import type { Ref } from 'react'
import type { When } from '../lib/dates'
import type { Filters } from '../lib/filter'

const WHEN_OPTIONS: [When, string][] = [
  ['today', 'Today'],
  ['tomorrow', 'Tomorrow'],
  ['weekend', 'This weekend'],
  ['week', 'Next 7 days'],
  ['all', 'All'],
]

const BOROUGHS = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island', 'Online']

interface Props {
  filters: Filters
  categories: [string, number][]
  sources: [string, number][]
  onChange: (patch: Partial<Filters>, options?: { refitMap?: boolean }) => void
  ref?: Ref<HTMLElement>
}

export function FilterBar({ filters, categories, sources, onChange, ref }: Props) {
  const toggleBorough = (borough: string) => {
    const selected = filters.boroughs.includes(borough)
      ? filters.boroughs.filter((b) => b !== borough)
      : [...filters.boroughs, borough]
    onChange({ boroughs: selected }, { refitMap: true })
  }

  return (
    <section className="filters" aria-label="Filters" ref={ref}>
      <input
        id="search"
        type="search"
        placeholder="Search yoga, concerts, a park name…"
        aria-label="Search events"
        value={filters.query}
        onChange={(e) => onChange({ query: e.target.value })}
      />

      <div className="segmented" role="group" aria-label="When">
        {WHEN_OPTIONS.map(([value, label]) => (
          <button key={value} aria-pressed={filters.when === value} onClick={() => onChange({ when: value })}>
            {label}
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Borough">
        <button
          aria-pressed={filters.boroughs.length === 0}
          onClick={() => onChange({ boroughs: [] }, { refitMap: true })}
        >
          All boroughs
        </button>
        {BOROUGHS.map((b) => (
          <button key={b} aria-pressed={filters.boroughs.includes(b)} onClick={() => toggleBorough(b)}>
            {b}
          </button>
        ))}
      </div>

      <div className="row">
        <select aria-label="Category" value={filters.category} onChange={(e) => onChange({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map(([name, count]) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </select>
        <select
          aria-label="Source"
          value={filters.source}
          onChange={(e) => onChange({ source: e.target.value }, { refitMap: true })}
        >
          <option value="">All sources</option>
          {sources.map(([name, count]) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={filters.kids} onChange={(e) => onChange({ kids: e.target.checked })} />
          Good for kids
        </label>
        <label className="toggle">
          <input type="checkbox" checked={filters.donation} onChange={(e) => onChange({ donation: e.target.checked })} />
          Include "suggested donation"
        </label>
      </div>
    </section>
  )
}
