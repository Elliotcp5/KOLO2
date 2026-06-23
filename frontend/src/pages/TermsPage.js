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
          Last updated: March 31, 2026
        </p>

        <h2 style={heading}>1. Company Information</h2>
        <p>KOLO is operated by:</p>
        <p style={{ marginTop: 4 }}>
          <strong>KOLO.IO LTD</strong><br />
          Company number: <strong>17140900</strong> (incorporated in England & Wales)<br />
          124 City Road<br />
          London, EC1V 2NX<br />
          United Kingdom<br />
          Email:{' '}
          <a href="mailto:contact@trykolo.io" style={link}>contact@trykolo.io</a><br />
          Registry:{' '}
          <a href="https://find-and-update.company-information.service.gov.uk/company/17140900" style={link} target="_blank" rel="noopener noreferrer">
            Companies House — UK
          </a>
        </p>
        <p>
          KOLO.IO LTD is a company incorporated under the laws of England and Wales.
          All user data is hosted on <strong>Infomaniak</strong> (Swiss sovereign cloud) under Swiss data-protection law and GDPR.
          We never sell, lease, or share personal data with third parties for commercial purposes.
        </p>

        <h2 style={heading}>2. Purpose of the Platform</h2>
        <p>
          KOLO is a mobile-first SaaS (Software as a Service) platform designed
          to help real estate agents and other professionals optimize their
          workflow through artificial intelligence.
        </p>
        <p>
          The platform enables users to manage tasks, prospects, reminders, and
          business-related data in a structured and efficient environment.
        </p>

        <h2 style={heading}>3. Access and Use</h2>
        <p>
          Access to KOLO is restricted to users with an active paid subscription.
        </p>
        <p>Users agree to:</p>
        <ul style={list}>
          <li>Provide accurate and up-to-date information</li>
          <li>Use the platform in compliance with applicable laws and regulations</li>
          <li>Not misuse, disrupt, or attempt to gain unauthorized access to the system</li>
        </ul>
        <p>
          KOLO reserves the right to suspend or terminate access in case of
          violation of these terms.
        </p>

        <h2 style={heading}>4. Data Ownership</h2>
        <p>
          All data entered into KOLO by users — including but not limited to:
          Prospects, Tasks, Notes, Contacts, Business-related information —
          remain the sole and exclusive property of the user.
        </p>
        <p>KOLO does not:</p>
        <ul style={list}>
          <li>Sell user data</li>
          <li>Exploit user data for commercial purposes</li>
          <li>Share user data with third parties for marketing or resale</li>
        </ul>

        <h2 style={heading}>5. Data Privacy and Security</h2>
        <p>
          Data protection and privacy are core principles of KOLO.
        </p>
        <ul style={list}>
          <li>All data is hosted on secure servers located in France</li>
          <li>Infrastructure is compliant with the General Data Protection Regulation (GDPR)</li>
          <li>Data is stored on a sovereign, encrypted, and highly secured cloud environment</li>
        </ul>
        <p>
          KOLO implements industry-standard security measures including data
          encryption (in transit and at rest), secure authentication mechanisms,
          and controlled access to infrastructure.
        </p>
        <p>
          Despite best efforts, no system can guarantee absolute security. Users
          acknowledge this inherent limitation.
        </p>

        <h2 style={heading}>6. Payment Processing</h2>
        <p>
          All payments on KOLO are processed via Stripe, a third-party payment
          provider.
        </p>
        <p>
          KOLO does not store or have access to any banking details and does not
          process payment information directly.
        </p>
        <p>
          Users are encouraged to review Stripe's own legal terms and privacy
          policies.
        </p>

        <h2 style={heading}>6b. Apple Store Subscription Terms (Auto-Renewable)</h2>
        <p>
          For purchases made through the iOS application, payments are processed
          by Apple via StoreKit In-App Purchases (not by Stripe).
        </p>
        <p>KOLO offers the following auto-renewable subscription plans:</p>
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
          Subscriptions are billed in the local currency displayed at the time
          of purchase. Payment is charged to your Apple ID account at
          confirmation of purchase.
        </p>
        <p>
          Subscriptions automatically renew for the same duration and at the
          same price unless cancelled at least 24 hours before the end of the
          current billing period.
        </p>
        <p>
          Your subscription can be managed and cancelled at any time via
          Settings → Apple ID → Subscriptions on your iOS device.
        </p>
        <p>
          A free 14-day trial is available for new subscribers on both PRO and
          PRO+ plans. If not cancelled before the trial ends, the subscription
          will automatically convert to a paid plan at the applicable rate.
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
          KOLO operates globally, with a primary focus on professionals located
          in Europe, United Kingdom, United States, and United Arab Emirates.
        </p>
        <p>
          Users are responsible for ensuring their use of KOLO complies with
          their local regulations.
        </p>

        <h2 style={heading}>8. Liability</h2>
        <p>
          KOLO provides tools designed to assist users in managing their
          business activities.
        </p>
        <p>
          KOLO does not guarantee business results, act as a real estate
          intermediary, or replace professional judgment.
        </p>
        <p>
          KOLO shall not be held liable for business losses, data loss caused by
          user actions, or service interruptions beyond reasonable control.
        </p>

        <h2 style={heading}>9. Intellectual Property</h2>
        <p>
          All elements of the KOLO platform, including software, design,
          branding, and content are the exclusive property of KOLO.io LTD,
          unless otherwise stated.
        </p>
        <p>
          Any reproduction, distribution, or unauthorized use is strictly
          prohibited.
        </p>

        <h2 style={heading}>10. Support</h2>
        <p>For any inquiries, support requests, or complaints:</p>
        <p>
          Email:{' '}
          <a href="mailto:contact@trykolo.io" style={link}>contact@trykolo.io</a>
        </p>
        <p>
          KOLO commits to responding as quickly as possible and within a
          reasonable timeframe.
        </p>

        <h2 style={heading}>11. Modifications</h2>
        <p>
          KOLO reserves the right to update or modify these legal notices at any
          time.
        </p>
        <p>
          Users will be informed of significant changes where applicable.
          Continued use of the platform constitutes acceptance of the updated
          terms.
        </p>

        <h2 style={heading}>12. Governing Law</h2>
        <p>
          These legal notices are governed by the laws of England and Wales.
        </p>
        <p>
          Any disputes shall fall under the jurisdiction of the competent courts
          in London, United Kingdom.
        </p>

        <p style={{ marginTop: 40, fontSize: 13, color: '#9ca3af' }}>
          © {new Date().getFullYear()} KOLO.io LTD. All rights reserved.
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
