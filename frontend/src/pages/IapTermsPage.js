import React from 'react';
import { useNavigate } from 'react-router-dom';

const heading = { fontSize: 20, fontWeight: 700, color: '#0E0B1E', marginTop: 28, marginBottom: 8 };
const link = { color: '#6366F1', textDecoration: 'underline' };

export default function IapTermsPage() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: '100vh', background: '#F7F6F2', padding: '24px 18px 60px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', background: '#fff', padding: '40px 30px', borderRadius: 18, boxShadow: '0 2px 30px rgba(0,0,0,0.04)', fontFamily: '-apple-system,Inter,sans-serif', color: '#1F2937', lineHeight: 1.6, fontSize: 15 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'transparent', border: 'none', color: '#6366F1', cursor: 'pointer', marginBottom: 20, fontSize: 14 }}>← Retour</button>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6, color: '#0E0B1E' }}>Conditions d'achat in-app</h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>Applicable aux achats via Apple App Store & Google Play — Dernière mise à jour : Février 2026</p>

        <h2 style={heading}>1. Produits disponibles</h2>
        <p>
          KOLO propose un abonnement <strong>KOLO Pro</strong> renouvelable automatiquement :
        </p>
        <ul>
          <li><strong>KOLO Pro Mensuel</strong> — <strong>24,99 € / mois</strong></li>
          <li><strong>KOLO Pro Annuel</strong> — disponible prochainement avec remise (~2 mois offerts)</li>
        </ul>
        <p>L'abonnement gratuit inclut 10 contacts maximum et 1 recherche prospection par semaine. Pro = tout illimité.</p>

        <h2 style={heading}>2. Renouvellement automatique</h2>
        <p>
          L'abonnement se renouvelle automatiquement à la fin de chaque période (mensuelle ou annuelle) à moins d'être annulé au moins 24h avant la fin de la période en cours.
          La période suivante sera débitée du même montant que la période en cours, sur le moyen de paiement enregistré dans ton compte Apple ID ou Google Play.
        </p>

        <h2 style={heading}>3. Gestion & annulation de l'abonnement</h2>
        <p>
          L'abonnement est géré <strong>directement par Apple ou Google</strong>, jamais par KOLO. Pour le résilier ou changer :
        </p>
        <ul>
          <li><strong>iOS</strong> : Réglages → ton nom → Abonnements → KOLO → Annuler</li>
          <li><strong>Android</strong> : Google Play → Compte → Paiements et abonnements → KOLO → Annuler</li>
        </ul>
        <p>L'annulation prend effet à la fin de la période en cours — tu gardes l'accès Pro jusque-là.</p>

        <h2 style={heading}>4. Remboursements</h2>
        <p>
          Les remboursements sont gérés par <strong>Apple</strong> ou <strong>Google</strong> selon leurs propres politiques. KOLO ne peut pas émettre de remboursement directement.
        </p>
        <ul>
          <li><strong>Apple</strong> : <a href="https://reportaproblem.apple.com" style={link} target="_blank" rel="noopener noreferrer">reportaproblem.apple.com</a></li>
          <li><strong>Google Play</strong> : <a href="https://play.google.com/store/account/orderhistory" style={link} target="_blank" rel="noopener noreferrer">Historique des commandes</a></li>
        </ul>

        <h2 style={heading}>5. Période d'essai (le cas échéant)</h2>
        <p>
          Si une période d'essai gratuite est proposée, elle se convertit automatiquement en abonnement payant à son terme — sauf annulation avant la fin de l'essai.
        </p>

        <h2 style={heading}>6. Modifications tarifaires</h2>
        <p>
          KOLO peut modifier les tarifs des futurs renouvellements. Toute modification te sera notifiée au moins 30 jours à l'avance, avec possibilité de refus en annulant l'abonnement avant l'application du nouveau tarif.
        </p>

        <h2 style={heading}>7. Référentiel légal</h2>
        <p>
          Ces conditions complètent nos{' '}
          <a href="/terms" style={link}>Conditions générales d'utilisation</a> et notre{' '}
          <a href="/privacy" style={link}>Politique de confidentialité</a>.
        </p>

        <h2 style={heading}>8. Contact</h2>
        <p>
          Pour toute question sur les achats in-app non résolue par Apple/Google :{' '}
          <a href="mailto:contact@trykolo.io" style={link}>contact@trykolo.io</a>
        </p>
      </div>
    </div>
  );
}
