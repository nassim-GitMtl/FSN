import React, { useEffect, useRef, useState } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

// ─── Google Places API (New) types ───────────────────────────────────────────

interface Suggestion {
  placePrediction: {
    placeId: string;
    text: { text: string };
    structuredFormat: {
      mainText: { text: string };
      secondaryText: { text: string };
    };
  };
}

interface AddressComponent {
  longText: string;
  shortText: string;
  types: string[];
}

// ─── Public interface ─────────────────────────────────────────────────────────

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
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const AddressSearch: React.FC<AddressSearchProps> = ({
  onSelect,
  placeholder = 'Search address…',
  inputClassName,
  label,
}) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  // If no API key is configured yet, render nothing so the rest of the form works fine
  if (!API_KEY) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY!,
          },
          body: JSON.stringify({ input: query }),
        });
        const data = await res.json();
        const list: Suggestion[] = data.suggestions ?? [];
        setSuggestions(list);
        setOpen(list.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => clearTimeout(timerRef.current);
  }, [query]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleSelect = async (suggestion: Suggestion) => {
    const placeId = suggestion.placePrediction.placeId;
    setQuery('');
    setOpen(false);
    try {
      const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
        headers: {
          'X-Goog-Api-Key': API_KEY!,
          'X-Goog-FieldMask': 'addressComponents',
        },
      });
      const place = await res.json();
      const components: AddressComponent[] = place.addressComponents ?? [];

      const get = (type: string, short = false) =>
        components.find((c) => c.types.includes(type))?.[short ? 'shortText' : 'longText'] ?? '';

      const street = [get('street_number'), get('route')].filter(Boolean).join(' ');
      const city = get('locality') || get('postal_town') || get('sublocality_level_1');
      const state = get('administrative_area_level_1', true);
      const zip = get('postal_code');

      onSelect({ street, city, state, zip });
    } catch {
      // silently ignore detail failures — user can fill fields manually
    }
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
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg">
          {suggestions.map((s) => {
            const main = s.placePrediction.structuredFormat.mainText.text;
            const secondary = s.placePrediction.structuredFormat.secondaryText.text;
            return (
              <li key={s.placePrediction.placeId}>
                <button
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full px-4 py-2.5 text-left border-b border-surface-100 last:border-b-0 hover:bg-surface-50"
                >
                  <div className="text-sm font-medium text-surface-800">{main}</div>
                  <div className="text-xs text-surface-400">{secondary}</div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
