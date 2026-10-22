import { useRef, useState } from 'react';
import type { ClipboardEvent, DragEvent, KeyboardEvent, ReactNode } from 'react';
import { Copy, ImagePlus, Plus, Save, Trash2, X } from 'lucide-react';
import {
  cardDomains,
  cardRarities,
  cardRarityLabels,
  cardSupertypeLabels,
  cardSupertypes,
  cardTypeLabels,
  cardTypes
} from '../cards/types.js';
import type { CardDraft, CardRarity, CardType } from '../cards/types.js';
import { CardPreview } from './CardPreview.js';
import { TokenInput } from './TokenInput.js';

export type CardSuggestions = {
  tags: string[];
  keywords: string[];
  sets: string[];
  artists: string[];
};

export type EditorMessage = { kind: 'info' | 'error' | 'success'; text: string };

type CardEditorProps = {
  draft: CardDraft;
  isNew: boolean;
  isDirty: boolean;
  isSaving: boolean;
  message: EditorMessage | null;
  warning: string;
  suggestions: CardSuggestions;
  onChange: (draft: CardDraft) => void;
  onSave: () => void;
  onSaveAndNext: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onUploadImage: (file: File) => Promise<string>;
};

type StatField = 'energyCost' | 'powerCost' | 'might' | 'mightBonus';

const statFields: { field: StatField; label: string }[] = [
  { field: 'energyCost', label: 'Custo de energia' },
  { field: 'powerCost', label: 'Custo de poder' },
  { field: 'might', label: 'Might' },
  { field: 'mightBonus', label: 'Bônus de might' }
];

function toggle<T>(values: T[], value: T): T[] {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function firstImageFile(files: FileList | null | undefined): File | null {
  return Array.from(files ?? []).find((file) => file.type.startsWith('image/')) ?? null;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="card-form-section">
      <legend>{title}</legend>
      {children}
    </fieldset>
  );
}

export function CardEditor({
  draft,
  isNew,
  isDirty,
  isSaving,
  message,
  warning,
  suggestions,
  onChange,
  onSave,
  onSaveAndNext,
  onDuplicate,
  onDelete,
  onUploadImage
}: CardEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  function set<K extends keyof CardDraft>(field: K, value: CardDraft[K]) {
    onChange({ ...draft, [field]: value });
  }

  async function upload(file: File) {
    setIsUploading(true);
    setUploadError('');
    try {
      set('imageUrl', await onUploadImage(file));
    } catch {
      setUploadError('Não foi possível enviar a imagem. Use PNG, JPG, WEBP, GIF ou AVIF até 10 MB.');
    } finally {
      setIsUploading(false);
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLFormElement>) {
    const file = firstImageFile(event.clipboardData.files);
    if (!file) return;
    event.preventDefault();
    void upload(file);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    const file = firstImageFile(event.dataTransfer.files);
    if (!file) return;
    event.preventDefault();
    void upload(file);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if (!isSaving) onSave();
    }
  }

  const canSave = Boolean(draft.name.trim()) && !isSaving && !isUploading;

  return (
    <div className="card-editor-layout">
      <form
        aria-label="Editor de carta"
        className="card-form"
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onSubmit={(event) => {
          event.preventDefault();
          if (canSave) onSave();
        }}
      >
        <div className="card-form-heading">
          <div>
            <p className="section-kicker">{isNew ? 'NOVA CARTA' : 'EDITANDO CARTA'}</p>
            <h2>{draft.name.trim() || 'Sem nome'}</h2>
          </div>
          {!isNew && (
            <div className="card-form-heading-actions">
              <button className="text-button" onClick={onDuplicate} type="button">
                <Copy size={14} aria-hidden="true" />
                Duplicar
              </button>
              <button className="text-button danger" onClick={onDelete} type="button">
                <Trash2 size={14} aria-hidden="true" />
                Excluir
              </button>
            </div>
          )}
        </div>

        <Section title="Identidade">
          <div className="form-grid two">
            <div>
              <label className="field-label" htmlFor="card-name">Nome *</label>
              <input id="card-name" maxLength={120} onChange={(event) => set('name', event.target.value)} required value={draft.name} />
            </div>
            <div>
              <label className="field-label" htmlFor="card-title">Título / subtítulo</label>
              <input id="card-title" maxLength={120} onChange={(event) => set('title', event.target.value)} placeholder="Ex.: Loose Cannon" value={draft.title} />
            </div>
          </div>

          <div className="form-grid two">
            <div>
              <label className="field-label" htmlFor="card-type">Tipo</label>
              <select id="card-type" onChange={(event) => set('type', event.target.value as CardType)} value={draft.type}>
                {cardTypes.map((type) => <option key={type} value={type}>{cardTypeLabels[type]} ({type})</option>)}
              </select>
            </div>
            <div>
              <span className="field-label">Supertipos</span>
              <div className="chip-group" role="group" aria-label="Supertipos">
                {cardSupertypes.map((supertype) => (
                  <button
                    aria-pressed={draft.supertypes.includes(supertype)}
                    className="chip"
                    key={supertype}
                    onClick={() => set('supertypes', toggle(draft.supertypes, supertype))}
                    type="button"
                  >
                    {cardSupertypeLabels[supertype]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <span className="field-label">Domínios (cores)</span>
          <div className="chip-group" role="group" aria-label="Domínios">
            {cardDomains.map((domain) => (
              <button
                aria-pressed={draft.domains.includes(domain)}
                className={`chip domain-chip domain-${domain.toLowerCase()}`}
                key={domain}
                onClick={() => set('domains', toggle(draft.domains, domain))}
                type="button"
              >
                <span className="domain-dot" aria-hidden="true" />
                {domain}
              </button>
            ))}
          </div>
        </Section>

        <Section title="Estatísticas">
          <div className="form-grid four">
            {statFields.map(({ field, label }) => (
              <div key={field}>
                <label className="field-label" htmlFor={`card-${field}`}>{label}</label>
                <input
                  id={`card-${field}`}
                  inputMode="numeric"
                  max={999}
                  min={0}
                  onChange={(event) => {
                    const value = event.target.value;
                    set(field, value === '' ? null : Math.min(999, Math.max(0, Math.trunc(Number(value)))));
                  }}
                  placeholder="—"
                  type="number"
                  value={draft[field] ?? ''}
                />
              </div>
            ))}
          </div>
        </Section>

        <Section title="Texto">
          <div className="form-grid two">
            <TokenInput
              id="card-keywords"
              label="Keywords"
              onChange={(values) => set('keywords', values)}
              placeholder="Enter ou vírgula para adicionar"
              suggestions={suggestions.keywords}
              values={draft.keywords}
            />
            <TokenInput
              id="card-tags"
              label="Tags"
              onChange={(values) => set('tags', values)}
              placeholder="Ex.: Jinx, Zaun"
              suggestions={suggestions.tags}
              values={draft.tags}
            />
          </div>
          <label className="field-label" htmlFor="card-rules">Texto de regras</label>
          <textarea id="card-rules" maxLength={4000} onChange={(event) => set('rulesText', event.target.value)} rows={6} value={draft.rulesText} />
          <label className="field-label" htmlFor="card-flavor">Texto de ambientação (flavor)</label>
          <textarea className="short" id="card-flavor" maxLength={1000} onChange={(event) => set('flavorText', event.target.value)} rows={2} value={draft.flavorText} />
        </Section>

        <Section title="Coleção">
          <div className="form-grid four">
            <div>
              <label className="field-label" htmlFor="card-set">Set</label>
              <input id="card-set" list="card-set-suggestions" maxLength={60} onChange={(event) => set('set', event.target.value)} placeholder="Ex.: OGN" value={draft.set} />
              <datalist id="card-set-suggestions">
                {suggestions.sets.map((value) => <option key={value} value={value} />)}
              </datalist>
            </div>
            <div>
              <label className="field-label" htmlFor="card-number">Número</label>
              <input id="card-number" maxLength={30} onChange={(event) => set('collectorNumber', event.target.value)} placeholder="Ex.: 030" value={draft.collectorNumber} />
            </div>
            <div>
              <label className="field-label" htmlFor="card-rarity">Raridade</label>
              <select
                id="card-rarity"
                onChange={(event) => set('rarity', (event.target.value || null) as CardRarity | null)}
                value={draft.rarity ?? ''}
              >
                <option value="">—</option>
                {cardRarities.map((rarity) => <option key={rarity} value={rarity}>{cardRarityLabels[rarity]}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="card-artist">Artista</label>
              <input id="card-artist" list="card-artist-suggestions" maxLength={120} onChange={(event) => set('artist', event.target.value)} value={draft.artist} />
              <datalist id="card-artist-suggestions">
                {suggestions.artists.map((value) => <option key={value} value={value} />)}
              </datalist>
            </div>
          </div>
        </Section>

        <Section title="Imagem">
          <div
            className={`image-drop${isUploading ? ' is-uploading' : ''}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={handleDrop}
          >
            <ImagePlus size={18} aria-hidden="true" />
            <span>{isUploading ? 'Enviando imagem…' : 'Arraste, cole (Ctrl+V) ou'}</span>
            <button className="button button-secondary" disabled={isUploading} onClick={() => fileInput.current?.click()} type="button">
              Escolher arquivo
            </button>
            <input
              accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
              aria-label="Arquivo de imagem"
              hidden
              onChange={(event) => {
                const file = firstImageFile(event.target.files);
                event.target.value = '';
                if (file) void upload(file);
              }}
              ref={fileInput}
              type="file"
            />
          </div>
          <label className="field-label" htmlFor="card-image-url">URL da imagem</label>
          <div className="input-with-action">
            <input id="card-image-url" onChange={(event) => set('imageUrl', event.target.value)} placeholder="https://… ou envie um arquivo" value={draft.imageUrl} />
            {draft.imageUrl && (
              <button aria-label="Remover imagem" className="icon-button" onClick={() => set('imageUrl', '')} type="button">
                <X size={15} aria-hidden="true" />
              </button>
            )}
          </div>
          {uploadError && <p className="form-message error" role="alert">{uploadError}</p>}
        </Section>

        <Section title="Campos extras">
          <p className="muted-note">Use para qualquer informação que ainda não tenha campo próprio.</p>
          {draft.customFields.map((field, index) => (
            <div className="custom-field-row" key={index}>
              <input
                aria-label={`Nome do campo ${index + 1}`}
                maxLength={60}
                onChange={(event) => set('customFields', draft.customFields.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, label: event.target.value } : item))}
                placeholder="Campo"
                value={field.label}
              />
              <input
                aria-label={`Valor do campo ${index + 1}`}
                maxLength={1000}
                onChange={(event) => set('customFields', draft.customFields.map((item, itemIndex) =>
                  itemIndex === index ? { ...item, value: event.target.value } : item))}
                placeholder="Valor"
                value={field.value}
              />
              <button
                aria-label={`Remover campo ${index + 1}`}
                className="icon-button"
                onClick={() => set('customFields', draft.customFields.filter((_, itemIndex) => itemIndex !== index))}
                type="button"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
          <button className="text-button" onClick={() => set('customFields', [...draft.customFields, { label: '', value: '' }])} type="button">
            <Plus size={14} aria-hidden="true" />
            Adicionar campo
          </button>
        </Section>

        <Section title="Notas internas">
          <textarea aria-label="Notas internas" className="short" maxLength={4000} onChange={(event) => set('notes', event.target.value)} placeholder="Erratas, dúvidas de regra, pendências…" rows={3} value={draft.notes} />
        </Section>

        <div className="card-form-footer">
          <div className="card-form-status">
            {warning && <p className="form-message warning">{warning}</p>}
            {message
              ? <p className={`form-message ${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>
              : <p className="form-message">{isDirty ? 'Alterações não salvas · Ctrl+S salva' : 'Ctrl+S salva'}</p>}
          </div>
          <div className="card-form-actions">
            {isNew && (
              <button className="button button-secondary" disabled={!canSave} onClick={onSaveAndNext} type="button">
                Salvar e criar próxima
              </button>
            )}
            <button className="button button-primary" disabled={!canSave} type="submit">
              <Save size={15} aria-hidden="true" />
              {isSaving ? 'Salvando…' : isNew ? 'Criar carta' : 'Salvar alterações'}
            </button>
          </div>
        </div>
      </form>

      <CardPreview card={draft} />
    </div>
  );
}
