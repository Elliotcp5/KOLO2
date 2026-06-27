import React from 'react';
import { useI18n } from '../i18n';

const LOGOS = [
  { src: '/marketing/assets/logos/guyhoquet.png',     alt: 'Guy Hoquet' },
  { src: '/marketing/assets/logos/exp.png',           alt: 'eXp' },
  { src: '/marketing/assets/logos/sothebys.png',      alt: "Sotheby's International Realty" },
  { src: '/marketing/assets/logos/iad.png',           alt: 'iad' },
  { src: '/marketing/assets/logos/vaneau.png',        alt: 'Vaneau' },
  { src: '/marketing/assets/logos/safti.png',         alt: 'SAFTI' },
  { src: '/marketing/assets/logos/sixieme-avenue.png',alt: 'Sixième Avenue' },
  { src: '/marketing/assets/logos/barnes.png',        alt: 'Barnes International Realty' },
  { src: '/marketing/assets/logos/kw.png',            alt: 'Keller Williams' },
  { src: '/marketing/assets/logos/orpi.png',          alt: 'Orpi' },
  { src: '/marketing/assets/logos/kretz.png',         alt: 'Kretz Family Real Estate' },
  { src: '/marketing/assets/logos/engel-volkers.png', alt: 'Engel & Völkers' },
  { src: '/marketing/assets/logos/capifrance.png',    alt: 'Capifrance' },
  { src: '/marketing/assets/logos/c21.png',           alt: 'Century 21' },
  { src: '/marketing/assets/logos/deferla.png',       alt: 'De Ferla Immobilier' },
];

const LogoMarquee = () => {
  const { t } = useI18n();
  const items = [...LOGOS, ...LOGOS];
  return (
    <section className="mkt-marquee" data-testid="mkt-logo-marquee">
      <div className="mkt-marquee-label">{t('marquee_label')}</div>
      <div className="mkt-marquee-track-wrap">
        <div className="mkt-marquee-track">
          {items.map((l, i) => (
            <img
              key={`${l.alt}-${i}`}
              src={l.src}
              alt={l.alt}
              loading="lazy"
              draggable="false"
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default LogoMarquee;
