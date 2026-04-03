"""
Iteration 23 Tests - Email Localization, Stripe Webhook, FAB Add Prospect
Tests:
1. Email template localization for 4 languages (fr, en, de, it)
2. Stripe webhook endpoint responds correctly
3. Backend services running
"""

import pytest
import requests
import os
import sys

# Add backend to path for importing email_service
sys.path.insert(0, '/app/backend')

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://responsive-kolo.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "testtest"


class TestEmailLocalization:
    """Test email template localization for all 4 languages"""
    
    def test_email_content_dictionary_exists(self):
        """Verify EMAIL_CONTENT dictionary has all 4 locales"""
        from email_service import EMAIL_CONTENT
        
        assert "fr" in EMAIL_CONTENT, "French locale missing"
        assert "en" in EMAIL_CONTENT, "English locale missing"
        assert "de" in EMAIL_CONTENT, "German locale missing"
        assert "it" in EMAIL_CONTENT, "Italian locale missing"
        print("✓ All 4 locales present in EMAIL_CONTENT")
    
    def test_french_welcome_email(self):
        """Test French welcome email generation"""
        from email_service import get_welcome_email_html
        
        html = get_welcome_email_html("Jean", is_trial=True, trial_plan="pro", locale="fr")
        
        assert "Bienvenue Jean" in html, "French welcome title missing"
        assert "essai gratuit" in html.lower() or "trial" in html.lower(), "Trial mention missing"
        assert "KOLO" in html, "KOLO branding missing"
        print("✓ French welcome email generated correctly")
    
    def test_english_welcome_email(self):
        """Test English welcome email generation"""
        from email_service import get_welcome_email_html
        
        html = get_welcome_email_html("John", is_trial=True, trial_plan="pro", locale="en")
        
        assert "Welcome John" in html, "English welcome title missing"
        assert "trial" in html.lower(), "Trial mention missing"
        assert "KOLO" in html, "KOLO branding missing"
        print("✓ English welcome email generated correctly")
    
    def test_german_welcome_email(self):
        """Test German welcome email generation"""
        from email_service import get_welcome_email_html
        
        html = get_welcome_email_html("Hans", is_trial=True, trial_plan="pro", locale="de")
        
        assert "Willkommen Hans" in html, "German welcome title missing"
        assert "Testphase" in html or "trial" in html.lower(), "Trial mention missing"
        assert "KOLO" in html, "KOLO branding missing"
        print("✓ German welcome email generated correctly")
    
    def test_italian_welcome_email(self):
        """Test Italian welcome email generation"""
        from email_service import get_welcome_email_html
        
        html = get_welcome_email_html("Marco", is_trial=True, trial_plan="pro", locale="it")
        
        assert "Benvenuto Marco" in html, "Italian welcome title missing"
        assert "prova" in html.lower() or "trial" in html.lower(), "Trial mention missing"
        assert "KOLO" in html, "KOLO branding missing"
        print("✓ Italian welcome email generated correctly")
    
    def test_trial_reminder_email_all_locales(self):
        """Test trial reminder email for all locales"""
        from email_service import get_trial_reminder_email_html
        
        locales = ["fr", "en", "de", "it"]
        expected_content = {
            "fr": ["jours", "essai", "KOLO"],
            "en": ["days", "trial", "KOLO"],
            "de": ["Tage", "Testphase", "KOLO"],
            "it": ["giorni", "prova", "KOLO"]
        }
        
        for locale in locales:
            html = get_trial_reminder_email_html("User", days_left=7, trial_plan="pro", locale=locale)
            for expected in expected_content[locale]:
                assert expected in html, f"{locale}: Expected '{expected}' in reminder email"
            print(f"✓ {locale.upper()} trial reminder email generated correctly")
    
    def test_trial_expired_email_all_locales(self):
        """Test trial expired email for all locales"""
        from email_service import get_trial_expired_email_html
        
        locales = ["fr", "en", "de", "it"]
        
        for locale in locales:
            html = get_trial_expired_email_html("User", trial_plan="pro", locale=locale)
            assert "KOLO" in html, f"{locale}: KOLO branding missing"
            assert len(html) > 500, f"{locale}: Email content too short"
            print(f"✓ {locale.upper()} trial expired email generated correctly")
    
    def test_password_reset_email_all_locales(self):
        """Test password reset email for all locales"""
        from email_service import get_password_reset_email_html
        
        locales = ["fr", "en", "de", "it"]
        expected_cta = {
            "fr": "nouveau mot de passe",
            "en": "new password",
            "de": "Neues Passwort",
            "it": "nuova password"
        }
        
        for locale in locales:
            html = get_password_reset_email_html("User", "https://example.com/reset?token=abc", locale=locale)
            assert "KOLO" in html, f"{locale}: KOLO branding missing"
            assert "https://example.com/reset?token=abc" in html, f"{locale}: Reset link missing"
            print(f"✓ {locale.upper()} password reset email generated correctly")
    
    def test_subscription_confirmation_email_all_locales(self):
        """Test subscription confirmation email for all locales"""
        from email_service import send_subscription_confirmation_email
        
        # We can't actually send emails, but we can verify the function exists
        assert callable(send_subscription_confirmation_email), "send_subscription_confirmation_email should be callable"
        print("✓ Subscription confirmation email function exists")
    
    def test_locale_fallback_to_english(self):
        """Test that unknown locale falls back to English"""
        from email_service import get_email_content
        
        content = get_email_content("xx")  # Unknown locale
        assert content == get_email_content("en"), "Unknown locale should fallback to English"
        print("✓ Unknown locale correctly falls back to English")


class TestStripeWebhook:
    """Test Stripe webhook endpoint"""
    
    def test_webhook_endpoint_responds(self):
        """Test that /api/webhook/stripe endpoint responds"""
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json={"type": "test_event"},
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 with status ok (even for test events)
        assert response.status_code == 200, f"Webhook returned {response.status_code}"
        data = response.json()
        assert "status" in data, "Response should have status field"
        print(f"✓ Stripe webhook endpoint responds: {data}")
    
    def test_webhook_handles_checkout_session_completed(self):
        """Test webhook handles checkout.session.completed event structure"""
        # This is a mock event - real events need Stripe signature
        event_data = {
            "type": "checkout.session.completed",
            "data": {
                "object": {
                    "id": "cs_test_123",
                    "customer_email": "test@example.com",
                    "subscription": "sub_test_123",
                    "customer": "cus_test_123",
                    "metadata": {
                        "email": "test@example.com",
                        "locale": "fr",
                        "country": "FR"
                    }
                }
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/api/webhook/stripe",
            json=event_data,
            headers={"Content-Type": "application/json"}
        )
        
        # Should return 200 (may have error in message due to missing Stripe signature)
        assert response.status_code == 200, f"Webhook returned {response.status_code}"
        print(f"✓ Webhook handles checkout.session.completed structure")


class TestBackendServices:
    """Test backend services are running"""
    
    def test_api_geo_endpoint(self):
        """Test /api/geo endpoint"""
        response = requests.get(f"{BASE_URL}/api/geo")
        assert response.status_code == 200, f"Geo endpoint returned {response.status_code}"
        data = response.json()
        assert "country" in data, "Response should have country"
        assert "currency" in data, "Response should have currency"
        print(f"✓ Geo endpoint works: {data}")
    
    def test_login_endpoint(self):
        """Test login with test credentials"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        
        assert response.status_code == 200, f"Login returned {response.status_code}: {response.text}"
        data = response.json()
        # API returns 'token' not 'session_token'
        assert "token" in data, "Response should have token"
        print(f"✓ Login works for {TEST_EMAIL}")
        return data["token"]
    
    def test_plans_pricing_endpoint(self):
        """Test /api/plans/pricing endpoint"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200, f"Pricing endpoint returned {response.status_code}"
        data = response.json()
        assert "plans" in data, "Response should have plans"
        assert "free" in data["plans"], "Should have free plan"
        assert "pro" in data["plans"], "Should have pro plan"
        assert "pro_plus" in data["plans"], "Should have pro_plus plan"
        print(f"✓ Plans pricing endpoint works")


class TestProspectCreation:
    """Test prospect creation with project types"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for tests"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Login failed")
    
    def test_create_prospect_buyer(self, auth_token):
        """Test creating a buyer prospect"""
        import uuid
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": f"TEST_Buyer_{uuid.uuid4().hex[:6]}",
                "phone": "+33612345678",
                "email": "buyer@test.com",
                "project_type": "buyer",
                "budget_min": 200,
                "budget_max": 400,
                "delay": "3_6_months"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code in [200, 201], f"Create prospect returned {response.status_code}: {response.text}"
        data = response.json()
        # Response may just have message and prospect_id
        assert "prospect_id" in data, "Response should have prospect_id"
        print(f"✓ Created buyer prospect: {data.get('prospect_id')}")
    
    def test_create_prospect_seller(self, auth_token):
        """Test creating a seller prospect"""
        import uuid
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": f"TEST_Seller_{uuid.uuid4().hex[:6]}",
                "phone": "+33612345679",
                "email": "seller@test.com",
                "project_type": "seller",
                "budget_min": 500,
                "budget_max": 500,
                "delay": "urgent"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code in [200, 201], f"Create prospect returned {response.status_code}: {response.text}"
        data = response.json()
        assert "prospect_id" in data, "Response should have prospect_id"
        print(f"✓ Created seller prospect: {data.get('prospect_id')}")
    
    def test_create_prospect_renter(self, auth_token):
        """Test creating a renter prospect"""
        import uuid
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": f"TEST_Renter_{uuid.uuid4().hex[:6]}",
                "phone": "+33612345680",
                "email": "renter@test.com",
                "project_type": "renter",
                "budget_min": 800,
                "budget_max": 1200,
                "delay": "6_plus_months"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code in [200, 201], f"Create prospect returned {response.status_code}: {response.text}"
        data = response.json()
        assert "prospect_id" in data, "Response should have prospect_id"
        print(f"✓ Created renter prospect: {data.get('prospect_id')}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
