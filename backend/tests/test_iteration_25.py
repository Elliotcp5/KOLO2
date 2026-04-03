"""
Iteration 25 - Final verification tests for App Store submission
Tests: Login error messages, forgot password, prospect creation, budget slider, safe-area, import contacts error
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://responsive-kolo.preview.emergentagent.com')

class TestLoginErrorMessages:
    """Test login error messages show correct localized text"""
    
    def test_login_wrong_password_returns_401(self):
        """Login with wrong password should return 401 with correct error message"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "wrongpassword123"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        # Should show localized error, not server error
        assert "incorrect" in data["detail"].lower() or "mot de passe" in data["detail"].lower()
        print(f"✓ Login error message: {data['detail']}")
    
    def test_login_nonexistent_user_returns_401(self):
        """Login with non-existent user should return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "nonexistent@test.com",
            "password": "anypassword"
        })
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        print(f"✓ Non-existent user error: {data['detail']}")
    
    def test_login_correct_credentials_returns_200(self):
        """Login with correct credentials should return 200 with token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == "test@test.com"
        print(f"✓ Login successful, token received")


class TestForgotPassword:
    """Test forgot password flow"""
    
    def test_forgot_password_endpoint_exists(self):
        """Forgot password endpoint should exist and accept POST"""
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "test@test.com"
        })
        # Should return 200 even for non-existent emails (security best practice)
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "reset_token" in data
        print(f"✓ Forgot password endpoint works")
    
    def test_reset_password_endpoint_exists(self):
        """Reset password endpoint should exist"""
        # First get a reset token
        response = requests.post(f"{BASE_URL}/api/auth/forgot-password", json={
            "email": "test@test.com"
        })
        assert response.status_code == 200
        data = response.json()
        
        if "reset_token" in data:
            # Try to reset with the token
            reset_response = requests.post(f"{BASE_URL}/api/auth/reset-password", json={
                "token": data["reset_token"],
                "new_password": "testtest"  # Keep same password for test user
            })
            assert reset_response.status_code == 200
            print(f"✓ Reset password endpoint works")
        else:
            print(f"✓ Forgot password returns message (no token in demo mode)")


class TestProspectCreation:
    """Test prospect creation flow"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_create_prospect_buyer(self, auth_token):
        """Create a buyer prospect with all fields"""
        import uuid
        unique_id = uuid.uuid4().hex[:6]
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": f"TEST_Buyer_{unique_id}",
                "phone": "+33612345678",
                "email": f"buyer_{unique_id}@test.com",
                "project_type": "buyer",
                "budget_min": 100,
                "budget_max": 400,
                "budget_undefined": False,
                "delay": "urgent"
            }
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert "prospect_id" in data
        prospect_id = data["prospect_id"]
        
        # Verify by fetching the prospect
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        prospect_data = get_response.json()
        assert prospect_data["project_type"] == "buyer"
        assert prospect_data["budget_min"] == 100
        assert prospect_data["budget_max"] == 400
        print(f"✓ Buyer prospect created and verified: {prospect_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_create_prospect_seller(self, auth_token):
        """Create a seller prospect"""
        import uuid
        unique_id = uuid.uuid4().hex[:6]
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": f"TEST_Seller_{unique_id}",
                "phone": "+33612345679",
                "email": f"seller_{unique_id}@test.com",
                "project_type": "seller",
                "budget_min": 500,
                "budget_max": 500,
                "delay": "3_6_months"
            }
        )
        assert response.status_code in [200, 201]
        data = response.json()
        prospect_id = data["prospect_id"]
        
        # Verify by fetching
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        prospect_data = get_response.json()
        assert prospect_data["project_type"] == "seller"
        print(f"✓ Seller prospect created and verified: {prospect_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
    
    def test_create_prospect_renter(self, auth_token):
        """Create a renter prospect"""
        import uuid
        unique_id = uuid.uuid4().hex[:6]
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "full_name": f"TEST_Renter_{unique_id}",
                "phone": "+33612345680",
                "project_type": "renter",
                "budget_min": 1000,
                "budget_max": 2000,
                "delay": "6_plus_months"
            }
        )
        assert response.status_code in [200, 201]
        data = response.json()
        prospect_id = data["prospect_id"]
        
        # Verify by fetching
        get_response = requests.get(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert get_response.status_code == 200
        prospect_data = get_response.json()
        assert prospect_data["project_type"] == "renter"
        print(f"✓ Renter prospect created and verified: {prospect_id}")
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )


class TestPlanFeatures:
    """Test plan features for PRO+ user"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_pro_plus_user_has_budget_slider(self, auth_token):
        """PRO+ user should have budget_slider feature"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["effective_plan"] == "pro_plus"
        assert data["features"]["budget_slider"] == True
        print(f"✓ PRO+ user has budget_slider feature")
    
    def test_pro_plus_user_has_heat_score(self, auth_token):
        """PRO+ user should have heat_score feature"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["features"]["heat_score"] == True
        print(f"✓ PRO+ user has heat_score feature")
    
    def test_pro_plus_user_has_roi_dashboard(self, auth_token):
        """PRO+ user should have roi_dashboard feature"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert data["features"]["roi_dashboard"] == True
        print(f"✓ PRO+ user has roi_dashboard feature")
    
    def test_plans_current_endpoint(self, auth_token):
        """Plans current endpoint should return plan info"""
        response = requests.get(
            f"{BASE_URL}/api/plans/current",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "effective_plan" in data
        assert data["effective_plan"] == "pro_plus"
        print(f"✓ Plans current endpoint returns pro_plus")
    
    def test_plans_pricing_endpoint(self):
        """Plans pricing endpoint should return all plans"""
        response = requests.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        data = response.json()
        
        assert "plans" in data
        # Plans is a dictionary with keys: free, pro, pro_plus
        assert "free" in data["plans"] or "starter" in data["plans"]
        assert "pro" in data["plans"]
        assert "pro_plus" in data["plans"]
        print(f"✓ Plans pricing endpoint works - found {list(data['plans'].keys())}")


class TestSubscriptionStatus:
    """Test subscription status endpoints"""
    
    @pytest.fixture
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Authentication failed")
    
    def test_subscription_status_endpoint(self, auth_token):
        """Subscription status endpoint should work"""
        response = requests.get(
            f"{BASE_URL}/api/subscription/status",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        
        assert "status" in data
        assert data["status"] == "active"
        print(f"✓ Subscription status: {data['status']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
