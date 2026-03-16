"""
Test suite for KOLO CRM Authentication flows
Tests: register, login, auth/me, logout, duplicate email detection
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://responsive-kolo.preview.emergentagent.com')


class TestRegistration:
    """Test free trial registration endpoint"""
    
    def test_register_new_user(self):
        """Register a new user with email and password"""
        unique_email = f"test_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "testpassword123"}
        )
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert data["email"] == unique_email
        assert data["subscription_status"] == "trialing"
        assert "trial_ends_at" in data
        assert "token" in data
        assert data["token"].startswith("sess_")
        
        print(f"PASS: Registered new user {unique_email}")
        return data
    
    def test_register_duplicate_email_fails(self):
        """Registering with an existing email should fail"""
        # First register a user
        unique_email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
        
        response1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "password123"}
        )
        assert response1.status_code == 200
        
        # Try to register again with same email
        response2 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "differentpassword"}
        )
        
        assert response2.status_code == 400
        # Check for French error message about duplicate email
        detail = response2.json().get("detail", "")
        assert "compte" in detail.lower() or "email" in detail.lower(), f"Unexpected error: {detail}"
        print(f"PASS: Duplicate email {unique_email} correctly rejected")
    
    def test_register_short_password_fails(self):
        """Password must be at least 6 characters"""
        unique_email = f"test_short_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "12345"}  # Only 5 chars
        )
        
        assert response.status_code == 400
        assert "6 caractères" in response.json().get("detail", "")
        print("PASS: Short password correctly rejected")
    
    def test_register_invalid_email_fails(self):
        """Email must be valid format"""
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": "notanemail", "password": "password123"}
        )
        
        assert response.status_code == 400
        print("PASS: Invalid email format correctly rejected")


class TestLogin:
    """Test email/password login endpoint"""
    
    @pytest.fixture
    def registered_user(self):
        """Create a test user for login tests"""
        unique_email = f"test_login_{uuid.uuid4().hex[:8]}@example.com"
        password = "testpassword123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": password}
        )
        
        assert response.status_code == 200
        return {"email": unique_email, "password": password, "data": response.json()}
    
    def test_login_valid_credentials(self, registered_user):
        """Login with correct email and password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": registered_user["email"], "password": registered_user["password"]}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert data["email"] == registered_user["email"]
        assert "token" in data
        assert data["token"].startswith("sess_")
        assert "subscription_status" in data
        
        print(f"PASS: Login successful for {registered_user['email']}")
    
    def test_login_wrong_password(self, registered_user):
        """Login with wrong password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": registered_user["email"], "password": "wrongpassword"}
        )
        
        assert response.status_code == 401
        assert "incorrect" in response.json().get("detail", "").lower()
        print("PASS: Wrong password correctly rejected")
    
    def test_login_nonexistent_user(self):
        """Login with non-existent email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@nowhere.com", "password": "anypassword"}
        )
        
        assert response.status_code == 401
        print("PASS: Non-existent user correctly rejected")


class TestAuthMe:
    """Test /api/auth/me endpoint for session verification"""
    
    @pytest.fixture
    def auth_token(self):
        """Create a user and return their token"""
        unique_email = f"test_me_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "password123"}
        )
        
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_auth_me_with_valid_token(self, auth_token):
        """GET /api/auth/me with valid Bearer token"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "subscription_status" in data
        
        print("PASS: /api/auth/me returns user data with valid token")
    
    def test_auth_me_without_token(self):
        """GET /api/auth/me without token should fail"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        
        assert response.status_code == 401
        assert "authenticated" in response.json().get("detail", "").lower()
        print("PASS: /api/auth/me correctly rejects request without token")
    
    def test_auth_me_with_invalid_token(self):
        """GET /api/auth/me with invalid token should fail"""
        response = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": "Bearer invalid_token_12345"}
        )
        
        assert response.status_code == 401
        print("PASS: /api/auth/me correctly rejects invalid token")


class TestLogout:
    """Test logout endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Create a user and return their token"""
        unique_email = f"test_logout_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "password123"}
        )
        
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_logout_invalidates_session(self, auth_token):
        """Logout should invalidate the session token"""
        # Verify token works before logout
        response1 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response1.status_code == 200, "Token should work before logout"
        
        # Logout
        response2 = requests.post(
            f"{BASE_URL}/api/auth/logout",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response2.status_code == 200
        assert response2.json().get("message") == "Logged out"
        
        # Token should no longer work after logout
        response3 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response3.status_code == 401, "Token should be invalid after logout"
        
        print("PASS: Logout correctly invalidates session")


class TestSessionPersistence:
    """Test session persistence across requests (simulates page refresh)"""
    
    def test_token_persists_across_requests(self):
        """Token should remain valid for multiple requests"""
        unique_email = f"test_persist_{uuid.uuid4().hex[:8]}@example.com"
        
        # Register
        response1 = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "password123"}
        )
        assert response1.status_code == 200
        token = response1.json()["token"]
        
        # First request with token
        response2 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response2.status_code == 200
        
        # Second request with same token (simulates page refresh)
        response3 = requests.get(
            f"{BASE_URL}/api/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response3.status_code == 200
        
        # Third request - access protected endpoint
        response4 = requests.get(
            f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response4.status_code == 200
        
        print("PASS: Token persists across multiple requests")


class TestProtectedEndpoints:
    """Test that protected endpoints require authentication"""
    
    @pytest.fixture
    def auth_token(self):
        """Create a user and return their token"""
        unique_email = f"test_protected_{uuid.uuid4().hex[:8]}@example.com"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={"email": unique_email, "password": "password123"}
        )
        
        assert response.status_code == 200
        return response.json()["token"]
    
    def test_tasks_endpoint_requires_auth(self):
        """GET /api/tasks without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 401
        print("PASS: /api/tasks requires authentication")
    
    def test_tasks_endpoint_with_auth(self, auth_token):
        """GET /api/tasks with auth should succeed"""
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("PASS: /api/tasks works with authentication")
    
    def test_prospects_endpoint_requires_auth(self):
        """GET /api/prospects without auth should fail"""
        response = requests.get(f"{BASE_URL}/api/prospects")
        assert response.status_code == 401
        print("PASS: /api/prospects requires authentication")
    
    def test_prospects_endpoint_with_auth(self, auth_token):
        """GET /api/prospects with auth should succeed"""
        response = requests.get(
            f"{BASE_URL}/api/prospects",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        print("PASS: /api/prospects works with authentication")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
