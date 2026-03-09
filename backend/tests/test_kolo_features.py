"""
KOLO CRM Feature Tests - Testing all main features:
- Registration (free trial 7 days)
- Login
- Prospect creation
- Prospect editing (PUT /api/prospects/{id})
- Billing portal access (POST /api/billing/portal)
"""

import pytest
import requests
import os
import time
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://crm-ui-stage.preview.emergentagent.com"

def unique_email(prefix="test"):
    """Generate unique email using uuid"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"


class TestRegistration:
    """Test free trial registration (7 days, no payment required)"""
    
    def test_register_success(self):
        """Register a new user with email/password"""
        email = unique_email("reg")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123"
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify response contains expected fields
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == email
        assert "subscription_status" in data
        assert data["subscription_status"] == "trialing"
        assert "trial_ends_at" in data
        assert "token" in data
        assert data["token"].startswith("sess_")
        
    def test_register_duplicate_email_fails(self):
        """Cannot register with an already used email"""
        email = unique_email("dup")
        
        # First registration
        response1 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123"
        })
        assert response1.status_code == 200
        
        # Second registration with same email
        response2 = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass456"
        })
        assert response2.status_code == 400
        # Check for French error message
        detail = response2.json().get("detail", "").lower()
        assert "existe" in detail or "already" in detail or "compte" in detail
    
    def test_register_short_password_fails(self):
        """Password must be at least 6 characters"""
        email = unique_email("short")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "12345"  # Only 5 characters
        })
        
        assert response.status_code == 400
        assert "6" in response.json().get("detail", "")


class TestLogin:
    """Test login with email/password"""
    
    def test_login_success(self):
        """Login with valid credentials"""
        email = unique_email("login")
        password = "testpass123"
        
        # First register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password
        })
        assert reg_response.status_code == 200
        
        # Then login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": password
        })
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == email
        assert "token" in data
        assert data["token"].startswith("sess_")
        assert "subscription_status" in data
        
    def test_login_wrong_password_fails(self):
        """Login fails with wrong password"""
        email = unique_email("wrongpw")
        password = "testpass123"
        
        # First register
        reg_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": password
        })
        assert reg_response.status_code == 200
        
        # Try to login with wrong password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": email,
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401
        
    def test_login_nonexistent_user_fails(self):
        """Login fails for non-existent user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": f"nonexistent_{uuid.uuid4().hex[:8]}@test.com",
            "password": "testpass123"
        })
        
        assert response.status_code == 401


class TestProspects:
    """Test prospect CRUD operations"""
    
    def _get_auth_token(self):
        """Helper to create user and get token"""
        email = unique_email("prospect")
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
        
    def test_create_prospect(self):
        """Create a new prospect"""
        token = self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/prospects", 
            headers=headers,
            json={
                "full_name": "Test Prospect",
                "phone": "+33612345678",
                "email": "prospect@test.com",
                "source": "manual",
                "status": "new",
                "notes": "Test notes"
            }
        )
        
        assert response.status_code in [200, 201]
        data = response.json()
        assert "prospect_id" in data
        
    def test_get_prospects_list(self):
        """Get list of prospects"""
        token = self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/prospects", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        assert "prospects" in data or isinstance(data, list)
        
    def test_edit_prospect(self):
        """Edit/update an existing prospect - PUT /api/prospects/{id}"""
        token = self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        # First create a prospect
        create_response = requests.post(f"{BASE_URL}/api/prospects", 
            headers=headers,
            json={
                "full_name": "Original Name",
                "phone": "+33612345678",
                "email": "original@test.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert create_response.status_code in [200, 201]
        prospect_id = create_response.json()["prospect_id"]
        
        # Update the prospect
        update_response = requests.put(f"{BASE_URL}/api/prospects/{prospect_id}",
            headers=headers,
            json={
                "full_name": "Updated Name",
                "phone": "+33698765432",
                "status": "in_progress"
            }
        )
        
        assert update_response.status_code == 200
        
        # Verify the update
        get_response = requests.get(f"{BASE_URL}/api/prospects/{prospect_id}", headers=headers)
        assert get_response.status_code == 200
        
        updated_prospect = get_response.json()
        assert updated_prospect["full_name"] == "Updated Name"
        assert updated_prospect["phone"] == "+33698765432"
        assert updated_prospect["status"] == "in_progress"


class TestBillingPortal:
    """Test Stripe billing portal access - POST /api/billing/portal"""
    
    def _get_auth_token(self):
        """Helper to create user and get token"""
        email = unique_email("billing")
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
        
    def test_billing_portal_access(self):
        """Access billing portal - should return Stripe URL"""
        token = self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.post(f"{BASE_URL}/api/billing/portal",
            headers=headers,
            json={"action": "payment_method"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should return a Stripe billing portal URL
        assert "url" in data
        assert "stripe.com" in data["url"] or "billing.stripe.com" in data["url"]
        
    def test_billing_portal_requires_auth(self):
        """Billing portal requires authentication"""
        response = requests.post(f"{BASE_URL}/api/billing/portal",
            json={"action": "payment_method"}
        )
        
        assert response.status_code == 401


class TestAuthMe:
    """Test auth/me endpoint for session verification"""
    
    def _get_auth_token(self):
        """Helper to create user and get token"""
        self.email = unique_email("authme")
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": self.email,
            "password": "testpass123"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        return response.json()["token"]
        
    def test_auth_me_with_valid_token(self):
        """Get current user with valid token"""
        token = self._get_auth_token()
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == self.email
        assert "subscription_status" in data
        
    def test_auth_me_without_token(self):
        """Auth/me fails without token"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        
    def test_auth_me_with_invalid_token(self):
        """Auth/me fails with invalid token"""
        response = requests.get(f"{BASE_URL}/api/auth/me", 
            headers={"Authorization": "Bearer invalid_token_xyz"})
        
        assert response.status_code == 401


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
