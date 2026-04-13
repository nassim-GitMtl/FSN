import React, { useEffect, useRef, useState } from 'react';

interface NominatimResult {
  place_id: number;
  display_name: string;
  address: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
}

export interface AddressParts {
  street: string;
  city: string;
  state: string;
  zip: string;
}

interface AddressSearchProps {
  onSelect: (parts: AddressParts) => void;
  placeholder?: string;
  inputClassName?: string;
  /** Optional label shown above the search box */
  label?: string;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({
  onSelect,
  placeholder = 'Search address…',
  inputClassName,
  label,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 4) {
      setResults([]);
      setOpen(false);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const url =
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}` +
          `&format=json&addressdetails=1&limit=5`;
        const res = await fetch(url);
        const data: NominatimResult[] = await res.json();
        setResults(data);
        setOpen(data.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 500);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSelect = (result: NominatimResult) => {
    const { house_number, road, city, town, village, suburb, state, postcode } = result.address;
    const street = [house_number, road].filter(Boolean).join(' ');
    const resolvedCity = city || town || village || suburb || '';
    onSelect({ street, city: resolvedCity, state: state || '', zip: postcode || '' });
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && <div className="eyebrow mb-1.5">{label}</div>}
      <div className="relative">
        <input
          type="search"
          autoComplete="off"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className={inputClassName}
        />
        {loading && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-400">
            …
          </span>
        )}
      </div>
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => handleSelect(r)}
                className="w-full px-4 py-2.5 text-left text-sm text-surface-800 hover:bg-surface-50 border-b border-surface-100 last:border-b-0"
              >
                {r.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
