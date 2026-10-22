import { ImageOff } from 'lucide-react';
import { cardRarityLabels, cardSupertypeLabels, cardTypeLabels } from '../cards/types.js';
import type { CardDraft } from '../cards/types.js';

export function CardPreview({ card }: { card: CardDraft }) {
  const typeLine = [
    ...card.supertypes.map((supertype) => cardSupertypeLabels[supertype]),
    cardTypeLabels[card.type]
  ].join(' ');
  const stats = [
    { label: 'Energia', short: 'E', value: card.energyCost },
    { label: 'Poder', short: 'P', value: card.powerCost },
    { label: 'Might', short: 'M', value: card.might },
    { label: 'Bônus de might', short: '+M', value: card.mightBonus }
  ].filter((stat) => stat.value !== null);
  const collection = [card.set, card.collectorNumber && `#${card.collectorNumber}`, card.rarity && cardRarityLabels[card.rarity]]
    .filter(Boolean)
    .join(' · ');

  return (
    <aside aria-label="Pré-visualização da carta" className="card-preview">
      <p className="section-kicker">PRÉ-VISUALIZAÇÃO</p>
      <div className="card-preview-art">
        {card.imageUrl
          ? <img alt={card.name || 'Imagem da carta'} src={card.imageUrl} />
          : (
            <div className="card-preview-empty">
              <ImageOff size={22} aria-hidden="true" />
              <span>Sem imagem</span>
            </div>
          )}
      </div>

      <div className="card-preview-body">
        <div className="card-preview-domains">
          {card.domains.map((domain) => (
            <span className={`domain-pill domain-${domain.toLowerCase()}`} key={domain}>{domain}</span>
          ))}
        </div>
        <h2>{card.name || 'Sem nome'}</h2>
        {card.title && <p className="card-preview-title">{card.title}</p>}
        <p className="card-preview-type">
          {typeLine}
          {card.tags.length > 0 && <span> · {card.tags.join(' · ')}</span>}
        </p>

        {stats.length > 0 && (
          <dl className="card-preview-stats">
            {stats.map((stat) => (
              <div key={stat.label} title={stat.label}>
                <dt>{stat.short}</dt>
                <dd>{stat.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {card.keywords.length > 0 && (
          <div className="card-preview-keywords">
            {card.keywords.map((keyword) => <span key={keyword}>{keyword}</span>)}
          </div>
        )}
        {card.rulesText && <p className="card-preview-rules">{card.rulesText}</p>}
        {card.flavorText && <p className="card-preview-flavor">{card.flavorText}</p>}

        {card.customFields.length > 0 && (
          <dl className="card-preview-custom">
            {card.customFields.map((field, index) => (
              <div key={`${field.label}-${index}`}>
                <dt>{field.label || '—'}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {(collection || card.artist) && (
          <p className="card-preview-footer">
            <span>{collection}</span>
            {card.artist && <span>Arte: {card.artist}</span>}
          </p>
        )}
      </div>
    </aside>
  );
}
