"""
Test suite for iteration 22 - Bug fixes and feature verification
Tests:
1. SMS modal readability (CSS fix verified via frontend)
2. Landing page PRO+ features language
3. Profile plan display
4. BudgetSlider with projectType
5. AI suggestions dropdown
6. Backend /api/plans/pricing endpoint returns STARTER not FREE
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPricingEndpoint:
    """Test /api/plans/pricing endpoint returns STARTER not FREE"""
    
    def test_pricing_returns_starter_not_free(self):
        """Bug #6: Verify pricing endpoint returns STARTER for free tier"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        assert "free" in data["plans"]
        
        # Verify the free plan is named STARTER, not FREE
        free_plan = data["plans"]["free"]
        assert free_plan["name"] == "STARTER", f"Expected 'STARTER', got '{free_plan['name']}'"
        
    def test_pricing_has_all_plans(self):
        """Verify all 3 plans are present"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        
        data = response.json()
        plans = data["plans"]
        
        assert "free" in plans, "Missing 'free' plan"
        assert "pro" in plans, "Missing 'pro' plan"
        assert "pro_plus" in plans, "Missing 'pro_plus' plan"
        
    def test_pricing_eur_values(self):
        """Verify EUR pricing is correct"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        
        data = response.json()
        assert data["currency"] == "EUR"
        
        # Verify PRO price
        pro_plan = data["plans"]["pro"]
        assert pro_plan["price_monthly"] == 999  # 9.99€ in cents
        
        # Verify PRO+ price
        pro_plus_plan = data["plans"]["pro_plus"]
        assert pro_plus_plan["price_monthly"] == 2499  # 24.99€ in cents


class TestUserPlan:
    """Test user plan endpoint for PRO+ user"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_login_works(self):
        """Verify login with test@test.com works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert data["email"] == "test@test.com"
        
    def test_user_plan_is_pro_plus(self, auth_token):
        """Bug #3: Verify test@test.com has PRO+ plan"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert data["effective_plan"] == "pro_plus", f"Expected 'pro_plus', got '{data['effective_plan']}'"
        
    def test_pro_plus_features_enabled(self, auth_token):
        """Verify PRO+ user has all premium features enabled"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        features = data["features"]
        
        # Verify key PRO+ features
        assert features.get("budget_slider") == True, "budget_slider should be enabled"
        assert features.get("sms_one_click") == True, "sms_one_click should be enabled"
        assert features.get("heat_score") == True, "heat_score should be enabled"
        assert features.get("roi_dashboard") == True, "roi_dashboard should be enabled"
        assert features.get("interaction_history") == True, "interaction_history should be enabled"
        assert features.get("weekly_report") == True, "weekly_report should be enabled"


class TestAISuggestions:
    """Test AI suggestions endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_ai_suggestions_endpoint(self, auth_token):
        """Feature #5: Verify AI suggestions endpoint works"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/ai-suggestions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "suggestions" in data
        # Suggestions should be a list
        assert isinstance(data["suggestions"], list)
        
    def test_ai_suggestion_accept_endpoint(self, auth_token):
        """Feature #5: Verify AI suggestion accept endpoint exists"""
        # First get suggestions
        response = requests.get(
            f"{BASE_URL}/api/tasks/ai-suggestions",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        
        suggestions = response.json().get("suggestions", [])
        
        if suggestions:
            # Try to accept first suggestion
            suggestion = suggestions[0]
            accept_response = requests.post(
                f"{BASE_URL}/api/tasks/ai-suggestions/accept",
                headers={
                    "Authorization": f"Bearer {auth_token}",
                    "Content-Type": "application/json"
                },
                json=suggestion
            )
            # Should return 200 or 201
            assert accept_response.status_code in [200, 201]


class TestProspectCreation:
    """Test prospect creation with budget slider data"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token for test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed - skipping authenticated tests")
    
    def test_create_prospect_with_buyer_budget(self, auth_token):
        """Feature #4: Test creating prospect with buyer project type and budget"""
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "full_name": "TEST_Buyer Budget Test",
                "phone": "+33600000001",
                "project_type": "buyer",
                "budget_min": 100,
                "budget_max": 400,
                "delay": "urgent"
            }
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        prospect_id = data.get("prospect_id") or data.get("id")
        assert prospect_id is not None, "Prospect ID should be returned"
        
        # Verify prospect was created with correct data by fetching it
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        
        prospect_data = get_response.json()
        assert prospect_data.get("project_type") == "buyer"
        assert prospect_data.get("budget_min") == 100
        assert prospect_data.get("budget_max") == 400
        
        # Cleanup - delete the test prospect
        if prospect_id:
            requests.delete(
                f"{BASE_URL}/api/prospects/{prospect_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
    
    def test_create_prospect_with_seller_budget(self, auth_token):
        """Feature #4: Test creating prospect with seller project type"""
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "full_name": "TEST_Seller Budget Test",
                "phone": "+33600000002",
                "project_type": "seller",
                "budget_min": 500,
                "budget_max": 500,  # Single value for seller
                "delay": "3_6_months"
            }
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        prospect_id = data.get("prospect_id") or data.get("id")
        assert prospect_id is not None
        
        # Verify prospect was created with correct data
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        
        prospect_data = get_response.json()
        assert prospect_data.get("project_type") == "seller"
        
        # Cleanup
        if prospect_id:
            requests.delete(
                f"{BASE_URL}/api/prospects/{prospect_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )
    
    def test_create_prospect_with_renter_budget(self, auth_token):
        """Feature #4: Test creating prospect with renter project type"""
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={
                "Authorization": f"Bearer {auth_token}",
                "Content-Type": "application/json"
            },
            json={
                "full_name": "TEST_Renter Budget Test",
                "phone": "+33600000003",
                "project_type": "renter",
                "budget_min": 500,
                "budget_max": 1500,
                "delay": "6_plus_months"
            }
        )
        assert response.status_code in [200, 201]
        
        data = response.json()
        prospect_id = data.get("prospect_id") or data.get("id")
        assert prospect_id is not None
        
        # Verify prospect was created with correct data
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        
        prospect_data = get_response.json()
        assert prospect_data.get("project_type") == "renter"
        
        # Cleanup
        if prospect_id:
            requests.delete(
                f"{BASE_URL}/api/prospects/{prospect_id}",
                headers={"Authorization": f"Bearer {auth_token}"}
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
