import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Privacy Policy — required by Apple Guideline 3.1.2(c) and 5.1.1.
 * URL: https://trykolo.io/privacy  (and /privacy-policy as alias)
 */
export default function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#ffffff',
        color: '#0E0B1E',
        fontFamily: 'DM Sans, -apple-system, system-ui, sans-serif',
        padding: '24px 20px 64px',
        lineHeight: 1.65,
      }}
    >
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
          data-testid="privacy-back-btn"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'none',
            border: 'none',
            color: '#6C63FF',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 500,
            padding: 0,
            marginBottom: 20,
          }}
        >
          <ArrowLeft size={16} /> Back
        </button>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 6, color: '#0E0B1E' }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>
          Last updated: May 3, 2026
        </p>

        <p>
          This Privacy Policy explains how KOLO (“KOLO”, “we”, “us”) collects,
          uses and protects your personal data when you use the KOLO application
          and related services (“Service”). We comply with the EU General Data
          Protection Regulation (GDPR), the California Consumer Privacy Act
          (CCPA) and other applicable data-protection laws.
        </p>

        <h2 style={heading}>1. Data we collect</h2>
        <ul style={list}>
          <li>
            <strong>Account data:</strong> name, email, password (hashed),
            optional phone number, preferred language.
          </li>
          <li>
            <strong>Prospect data:</strong> names, phone numbers, notes and
            project details that you voluntarily add about your own real-estate
            prospects. You are the Data Controller for this data.
          </li>
          <li>
            <strong>Usage data:</strong> screens visited, features used,
            approximate country derived from IP address, device type and
            operating system.
          </li>
          <li>
            <strong>Payment data:</strong> processed directly by Stripe (web) or
            Apple (iOS StoreKit). We never receive or store full card numbers.
          </li>
        </ul>

        <h2 style={heading}>2. Contacts permission (iOS / Android)</h2>
        <p>
          When you add a new prospect, you may choose to import a single contact
          from your device's address book using Apple's native Contact Picker.
          <strong> Your address book is never read in bulk, never uploaded to our
          servers, and never shared with third parties.</strong> Only the contact
          you explicitly select is read locally into the prospect form (name,
          phone number), where you can review and edit it before saving.
        </p>

        <h2 style={heading}>3. How we use your data</h2>
        <ul style={list}>
          <li>Provide, operate and improve the Service.</li>
          <li>
            Generate AI suggestions to help you manage your prospects (prompts
            are sent to our AI providers — see section 6).
          </li>
          <li>Process subscriptions and prevent fraud.</li>
          <li>
            Communicate service-related notices (sign-up confirmation,
            password reset, receipt, weekly digest if enabled).
          </li>
          <li>Comply with legal obligations (tax, anti-fraud).</li>
        </ul>

        <h2 style={heading}>4. Legal bases (GDPR)</h2>
        <p>
          Contract performance (providing the Service), legitimate interest
          (security, service improvement), consent (optional marketing) and
          legal obligation (accounting, tax).
        </p>

        <h2 style={heading}>5. Data retention</h2>
        <p>
          Account and prospect data are retained as long as your account is
          active. Upon account deletion (Settings → Delete my account), your
          personal data and prospect data are permanently erased within 30 days,
          except where retention is required by law (invoices: 10 years).
        </p>

        <h2 style={heading}>6. Subprocessors</h2>
        <p>We rely on the following vetted subprocessors:</p>
        <ul style={list}>
          <li><strong>MongoDB Atlas</strong> — database hosting (EU region)</li>
          <li><strong>Stripe</strong> — web payment processing</li>
          <li><strong>Apple Inc.</strong> — iOS In-App Purchases</li>
          <li><strong>Anthropic, OpenAI</strong> — AI suggestions (data is processed transiently, not used for model training)</li>
          <li><strong>Resend / Brevo</strong> — transactional emails</li>
        </ul>
        <p>
          All subprocessors are bound by Data Processing Agreements and, where
          applicable, EU Standard Contractual Clauses.
        </p>

        <h2 style={heading}>7. Your rights</h2>
        <p>
          Under GDPR and CCPA you have the right to access, rectify, erase,
          export and object to the processing of your data, and to withdraw
          consent at any time. Exercise these rights by contacting{' '}
          <a href="mailto:privacy@trykolo.io" style={link}>privacy@trykolo.io</a>.
          You also have the right to lodge a complaint with your local
          supervisory authority (CNIL in France).
        </p>

        <h2 style={heading}>8. Security</h2>
        <p>
          Data is transmitted over HTTPS/TLS 1.2+ and stored encrypted at rest.
          Passwords are hashed with bcrypt. Access is limited to authorized
          personnel on a need-to-know basis.
        </p>

        <h2 style={heading}>9. Children</h2>
        <p>
          KOLO is not directed to children under 16. We do not knowingly collect
          personal data from children. If you believe we have, contact us at{' '}
          <a href="mailto:privacy@trykolo.io" style={link}>privacy@trykolo.io</a>.
        </p>

        <h2 style={heading}>10. Changes</h2>
        <p>
          We may update this Policy. Material changes will be communicated in-app
          or by email at least 14 days before taking effect.
        </p>

        <h2 style={heading}>11. Contact</h2>
        <p>
          Data Controller: KOLO.<br />
          Email:{' '}
          <a href="mailto:privacy@trykolo.io" style={link}>privacy@trykolo.io</a>
        </p>

        <p style={{ marginTop: 40, fontSize: 13, color: '#9ca3af' }}>
          © {new Date().getFullYear()} KOLO. All rights reserved.
        </p>
      </div>
    </div>
  );
}

const heading = {
  fontSize: 20,
  fontWeight: 700,
  marginTop: 32,
  marginBottom: 12,
  color: '#0E0B1E',
};
const list = { paddingLeft: 22, marginBottom: 12 };
const link = { color: '#6C63FF', textDecoration: 'underline' };
