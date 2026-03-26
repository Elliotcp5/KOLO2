"""
KOLO P0 Bug Fixes Verification Tests
Tests for:
1. PRO+ features access (budget_slider)
2. Trial emails endpoint
3. Pricing endpoint (FREE → STARTER rename)
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "testtest"


class TestPROPlusFeatures:
    """Test PRO+ user has access to premium features"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    def test_login_success(self):
        """Test login with PRO+ account"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_current_plan_is_pro_plus(self, auth_token):
        """Test that test user has PRO+ plan"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify PRO+ plan
        assert data["plan"] == "pro_plus", f"Expected pro_plus, got {data['plan']}"
        assert data["effective_plan"] == "pro_plus"
        print(f"✓ User plan is PRO+")
    
    def test_budget_slider_feature_enabled(self, auth_token):
        """Test that budget_slider feature is enabled for PRO+ user"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        # Verify budget_slider is enabled
        assert data["features"]["budget_slider"] == True, "budget_slider should be True for PRO+"
        print(f"✓ budget_slider feature is enabled")
    
    def test_sms_one_click_feature_enabled(self, auth_token):
        """Test that sms_one_click feature is enabled for PRO+ user"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["features"]["sms_one_click"] == True, "sms_one_click should be True for PRO+"
        print(f"✓ sms_one_click feature is enabled")
    
    def test_heat_score_feature_enabled(self, auth_token):
        """Test that heat_score feature is enabled for PRO+ user"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["features"]["heat_score"] == True, "heat_score should be True for PRO+"
        print(f"✓ heat_score feature is enabled")
    
    def test_roi_dashboard_feature_enabled(self, auth_token):
        """Test that roi_dashboard feature is enabled for PRO+ user"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["features"]["roi_dashboard"] == True, "roi_dashboard should be True for PRO+"
        print(f"✓ roi_dashboard feature is enabled")


class TestPricingEndpoint:
    """Test pricing endpoint returns correct plan names"""
    
    def test_pricing_returns_starter_not_free(self):
        """Test that FREE plan is renamed to STARTER"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        data = response.json()
        
        # Check that 'free' plan exists and has name 'STARTER'
        assert "free" in data["plans"], "free plan should exist"
        assert data["plans"]["free"]["name"] == "STARTER", f"Expected STARTER, got {data['plans']['free']['name']}"
        print(f"✓ FREE plan renamed to STARTER")
    
    def test_pricing_has_all_plans(self):
        """Test that all 3 plans are present"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        data = response.json()
        
        assert "free" in data["plans"]
        assert "pro" in data["plans"]
        assert "pro_plus" in data["plans"]
        print(f"✓ All 3 plans present (free/pro/pro_plus)")
    
    def test_pricing_eur_currency(self):
        """Test EUR pricing"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing?currency=EUR")
        assert response.status_code == 200
        data = response.json()
        
        assert data["currency"] == "EUR"
        assert "€" in data["plans"]["pro"]["display_monthly"]
        print(f"✓ EUR pricing correct")


class TestTrialEmailsEndpoint:
    """Test trial emails cron endpoint"""
    
    def test_trial_emails_endpoint_exists(self):
        """Test that /api/cron/trial-emails endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/cron/trial-emails",
            headers={"X-Cron-Key": "kolo_cron_secret_2026"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] == True
        assert "emails_sent" in data
        print(f"✓ Trial emails endpoint works")
    
    def test_trial_emails_requires_api_key(self):
        """Test that endpoint requires API key"""
        response = requests.post(
            f"{BASE_URL}/api/cron/trial-emails",
            headers={"X-Cron-Key": "wrong_key"}
        )
        # Should return 401 or 403 for wrong key
        assert response.status_code in [401, 403], f"Expected 401/403, got {response.status_code}"
        print(f"✓ Trial emails endpoint requires valid API key")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
