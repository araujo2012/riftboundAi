import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { X } from 'lucide-react';

type TokenInputProps = {
  id: string;
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
};

export function TokenInput({ id, label, values, onChange, suggestions = [], placeholder }: TokenInputProps) {
  const [pending, setPending] = useState('');
  const listId = `${id}-suggestions`;

  function commit(text: string) {
    const additions = text.split(',').map((value) => value.trim()).filter(Boolean);
    const known = new Set(values.map((value) => value.toLowerCase()));
    const next = [...values];
    for (const addition of additions) {
      if (known.has(addition.toLowerCase())) continue;
      known.add(addition.toLowerCase());
      next.push(addition);
    }
    if (next.length !== values.length) onChange(next);
    setPending('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commit(pending);
    } else if (event.key === 'Backspace' && !pending && values.length) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className="token-field">
      <label className="field-label" htmlFor={id}>{label}</label>
      <div className="token-input">
        {values.map((value) => (
          <span className="token" key={value}>
            {value}
            <button
              aria-label={`Remover ${value}`}
              onClick={() => onChange(values.filter((item) => item !== value))}
              type="button"
            >
              <X size={11} aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          list={suggestions.length ? listId : undefined}
          onBlur={() => commit(pending)}
          onChange={(event) => {
            const text = event.target.value;
            const { nativeEvent } = event;
            // Picking a datalist option replaces the whole value instead of typing it, so commit it right away.
            const isReplacement = !(nativeEvent instanceof InputEvent) || nativeEvent.inputType === 'insertReplacementText';
            if (isReplacement && suggestions.includes(text)) commit(text);
            else setPending(text);
          }}
          onKeyDown={handleKeyDown}
          placeholder={values.length ? undefined : placeholder}
          value={pending}
        />
      </div>
      {suggestions.length > 0 && (
        <datalist id={listId}>
          {suggestions.filter((suggestion) => !values.includes(suggestion)).map((suggestion) => (
            <option key={suggestion} value={suggestion} />
          ))}
        </datalist>
      )}
    </div>
  );
}
