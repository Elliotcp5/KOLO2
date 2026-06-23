import React from 'react';
import { useNavigate } from 'react-router-dom';

const heading = { fontSize: 20, fontWeight: 700, color: '#0E0B1E', marginTop: 28, marginBottom: 8 };
const link = { color: '#6366F1', textDecoration: 'underline' };

export default function LegalPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', padding: '24px 18px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', padding: '40px 30px', borderRadius: 18, boxShadow: '0 2px 30px rgba(0,0,0,0.04)', fontFamily: '-apple-system,Inter,sans-serif', color: '#1F2937', lineHeight: 1.6, fontSize: 15 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: '#6366F1', cursor: 'pointer', marginBottom: 20, fontSize: 14 }}>← Retour</button>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6, color: '#0E0B1E' }}>Mentions légales</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>Dernière mise à jour : Février 2026</p>

        <h2 style={heading}>Éditeur du service</h2>
        <p>
          <strong>KOLO.IO LTD</strong><br />
          Numéro d'enregistrement : <strong>17140900</strong> (Companies House, England & Wales)<br />
          124 City Road, Londres, EC1V 2NX, Royaume-Uni<br />
          Email : <a href="mailto:contact@trykolo.io" style={link}>contact@trykolo.io</a><br />
          Vérifier l'enregistrement : <a href="https://find-and-update.company-information.service.gov.uk/company/17140900" style={link} target="_blank" rel="noopener noreferrer">Companies House</a>
        </p>

        <h2 style={heading}>Directeur de la publication</h2>
        <p>Le représentant légal de KOLO.IO LTD.</p>

        <h2 style={heading}>Hébergement & Sécurité des données</h2>
        <p>
          Les données utilisateurs sont hébergées sur <strong>Infomaniak Network SA</strong> — opérateur Suisse de cloud souverain certifié <strong>ISO 27001</strong>, <strong>ISO 9001</strong>, <strong>ISO 14001</strong> et <strong>ISO 50001</strong>, conforme au RGPD et à la loi suisse sur la protection des données (LPD).<br />
          <strong>Infomaniak Network SA</strong>, Rue Eugène-Marziano 25, 1227 Les Acacias, Genève, Suisse — <a href="https://www.infomaniak.com/" style={link} target="_blank" rel="noopener noreferrer">infomaniak.com</a>
        </p>
        <p>
          Aucune donnée n'est revendue ni partagée à des tiers à des fins commerciales. Les flux de paiement transitent uniquement via l'App Store d'Apple et Google Play Billing (politique stricte des stores). Les emails transactionnels passent via <strong>Resend</strong> (USA, conforme SCC RGPD).
        </p>

        <h2 style={heading}>Propriété intellectuelle</h2>
        <p>
          Le logo, la marque <strong>KOLO</strong>, les contenus IA générés par le copilote, le design de l'application et le code source sont la propriété exclusive de <strong>KOLO.IO LTD</strong>. Toute reproduction, copie, diffusion ou modification — totale ou partielle — sans accord écrit est strictement interdite.
        </p>

        <h2 style={heading}>Contact</h2>
        <p>
          Pour toute question relative à ces mentions légales ou à l'utilisation du service :{' '}
          <a href="mailto:contact@trykolo.io" style={link}>contact@trykolo.io</a>
        </p>
      </div>
    </div>
  );
}
