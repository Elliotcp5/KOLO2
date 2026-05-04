import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/**
 * Terms of Use (EULA) — required by Apple Guideline 3.1.2(c) for apps with
 * auto-renewable subscriptions. Must be reachable from within the app AND
 * from the App Store metadata (App Description).
 *
 * URL: https://trykolo.io/terms
 */
export default function TermsPage() {
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
          data-testid="terms-back-btn"
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
          Terms of Use (EULA)
        </h1>
        <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 28 }}>
          Last updated: May 3, 2026
        </p>

        <p>
          These Terms of Use (“Terms”, “EULA”) constitute a legally binding agreement
          between you (“User”, “you”) and KOLO (“KOLO”, “we”, “us”, “our”) governing
          your access to and use of the KOLO mobile application and related services
          (the “Service”). By creating an account or using the Service, you agree to
          these Terms. If you do not agree, do not use the Service.
        </p>

        <h2 style={heading}>1. Eligibility</h2>
        <p>
          You must be at least 18 years old and legally capable of entering into
          contracts under the laws of your country of residence to use the Service.
          Business accounts may only be created by an authorized representative of
          the entity.
        </p>

        <h2 style={heading}>2. Account &amp; Security</h2>
        <p>
          You are responsible for maintaining the confidentiality of your credentials
          and for all activity under your account. Notify us immediately at
          support@trykolo.io if you suspect unauthorized access. We may suspend or
          terminate your account in case of fraudulent or abusive behaviour.
        </p>

        <h2 style={heading}>3. Acceptable Use</h2>
        <p>
          You agree not to: (i) use the Service for any unlawful purpose;
          (ii) attempt to reverse-engineer, decompile or otherwise derive source
          code; (iii) upload content that infringes third-party rights;
          (iv) bypass billing, rate-limiting, or security mechanisms; or
          (v) use the Service to send unsolicited marketing communications in
          violation of applicable law (GDPR, CAN-SPAM, CASL, etc.).
        </p>

        <h2 style={heading}>4. License Grant</h2>
        <p>
          Subject to these Terms, KOLO grants you a limited, non-exclusive,
          non-transferable, revocable license to install and use the Service on
          devices you own or control, solely for your personal or internal
          business use. All rights not expressly granted are reserved.
        </p>

        <h2 style={heading}>5. User Content</h2>
        <p>
          You retain all rights in the prospect data, notes and other content you
          submit to the Service (“User Content”). You grant KOLO a worldwide,
          royalty-free license to host, process and display User Content solely to
          operate and improve the Service. You represent that you have all rights
          necessary to submit User Content, and that you comply with applicable
          privacy laws (including GDPR) when collecting prospect data.
        </p>

        <h2 style={heading}>6. Payment Processing</h2>
        <p>
          Payments on the web are processed by Stripe. Payments inside the iOS app
          are processed by Apple via StoreKit In-App Purchases. You are responsible
          for keeping your payment methods up to date. Failed payments may result
          in downgrade to the free tier.
        </p>

        <h2 style={heading}>6b. Apple Store Subscription Terms (Auto-Renewable)</h2>
        <p>
          KOLO offers the following auto-renewable subscription plans:
        </p>
        <ul style={list}>
          <li>
            <strong>KOLO PRO</strong> — Monthly: £/$/€9.99/month — Annual:
            £/$/€99.99/year
          </li>
          <li>
            <strong>KOLO PRO+</strong> — Monthly: £/$/€24.99/month — Annual:
            £/$/€249.99/year
          </li>
        </ul>
        <p>
          Subscriptions are billed in the local currency displayed at the time of
          purchase. Payment is charged to your Apple ID account at confirmation of
          purchase.
        </p>
        <p>
          Subscriptions automatically renew for the same duration and at the same
          price unless cancelled at least 24 hours before the end of the current
          billing period.
        </p>
        <p>
          Your subscription can be managed and cancelled at any time via
          Settings → Apple ID → Subscriptions on your iOS device.
        </p>
        <p>
          A free 14-day trial is available for new subscribers on both PRO and PRO+
          plans. If not cancelled before the trial ends, the subscription will
          automatically convert to a paid plan at the applicable rate.
        </p>
        <p>
          No refunds are provided for unused portions of an active subscription
          period.
        </p>
        <p>
          For privacy practices, please refer to our Privacy Policy:{' '}
          <a href="https://trykolo.io/privacy" style={link}>
            https://trykolo.io/privacy
          </a>
          .
        </p>

        <h2 style={heading}>7. International Operations</h2>
        <p>
          The Service is operated from the European Union. By using it, you consent
          to the transfer and processing of your data in the EU, the United States
          and any jurisdiction where our subprocessors operate, subject to
          appropriate safeguards (including EU Standard Contractual Clauses).
        </p>

        <h2 style={heading}>8. Intellectual Property</h2>
        <p>
          The Service, including all software, AI models, designs, trademarks and
          content we provide, is owned by KOLO or its licensors and is protected
          by intellectual-property laws. You may not copy, modify, distribute,
          sell or create derivative works without our prior written consent.
        </p>

        <h2 style={heading}>9. Termination</h2>
        <p>
          You may delete your account at any time via
          Settings → Delete my account. We may suspend or terminate your access
          with or without notice if you breach these Terms or applicable law.
          On termination, User Content is deleted in accordance with our Privacy
          Policy.
        </p>

        <h2 style={heading}>10. Disclaimer of Warranties</h2>
        <p>
          The Service is provided “AS IS” and “AS AVAILABLE” without warranties of
          any kind, express or implied, including merchantability, fitness for a
          particular purpose, non-infringement, and uninterrupted availability. AI
          suggestions are provided for guidance only and do not constitute
          professional, legal or financial advice.
        </p>

        <h2 style={heading}>11. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by law, KOLO's aggregate liability for
          any claim arising out of or related to the Service shall not exceed the
          amount you paid us in the 12 months preceding the claim. KOLO shall not
          be liable for any indirect, incidental, special, consequential or
          punitive damages.
        </p>

        <h2 style={heading}>12. Changes to the Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be
          communicated via email or in-app notice at least 14 days before they
          take effect. Continued use of the Service after the effective date
          constitutes acceptance of the updated Terms.
        </p>

        <h2 style={heading}>13. Governing Law &amp; Disputes</h2>
        <p>
          These Terms are governed by the laws of France, without regard to
          conflict-of-laws principles. Any dispute arising hereunder shall be
          submitted to the exclusive jurisdiction of the competent courts of
          Paris, France, except where mandatory consumer-protection laws grant
          you a different forum.
        </p>

        <h2 style={heading}>14. Contact</h2>
        <p>
          For any question regarding these Terms, please contact us at{' '}
          <a href="mailto:support@trykolo.io" style={link}>
            support@trykolo.io
          </a>
          .
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
