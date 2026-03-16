"""
KOLO Features Test Suite v2 - Testing update-name, update-phone and other endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://responsive-kolo.preview.emergentagent.com')
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "testtest"

class TestKoloBackendAPIs:
    """Test backend API endpoints for KOLO app"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        self.token = None
    
    def login(self):
        """Login and get auth token"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            return True
        return False
    
    # === API Health Check ===
    def test_api_health(self):
        """Test API is running"""
        response = self.session.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        print("✓ API health check passed")
    
    # === Authentication Tests ===
    def test_login_success(self):
        """Test successful login"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        print(f"✓ Login successful, user_id: {data.get('user_id')}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        assert response.status_code in [400, 401, 404]
        print("✓ Invalid credentials rejected correctly")
    
    # === Update Name Tests ===
    def test_update_name_success(self):
        """Test updating user name - CRITICAL FIX"""
        assert self.login(), "Login failed"
        
        new_name = "Test User Updated"
        response = self.session.post(f"{BASE_URL}/api/auth/update-name", json={
            "name": new_name
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("name") == new_name
        print(f"✓ Name updated successfully to: {new_name}")
        
        # Verify change persisted via /api/auth/me
        me_response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert me_response.status_code == 200
        me_data = me_response.json()
        assert me_data.get("name") == new_name, f"Name not persisted: expected {new_name}, got {me_data.get('name')}"
        print("✓ Name change verified via /api/auth/me")
    
    def test_update_name_too_short(self):
        """Test name validation - too short"""
        assert self.login(), "Login failed"
        
        response = self.session.post(f"{BASE_URL}/api/auth/update-name", json={
            "name": "A"  # Too short
        })
        
        assert response.status_code == 400
        print("✓ Short name rejected correctly")
    
    def test_update_name_unauthenticated(self):
        """Test update name without auth"""
        response = self.session.post(f"{BASE_URL}/api/auth/update-name", json={
            "name": "Test Name"
        })
        
        assert response.status_code == 401
        print("✓ Unauthenticated update name rejected")
    
    # === Update Phone Tests ===
    def test_update_phone_success(self):
        """Test updating user phone - CRITICAL FIX"""
        assert self.login(), "Login failed"
        
        new_phone = "+33612345678"
        response = self.session.post(f"{BASE_URL}/api/auth/update-phone", json={
            "phone": new_phone
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("phone") == new_phone
        print(f"✓ Phone updated successfully to: {new_phone}")
        
        # Verify change persisted via /api/auth/profile
        profile_response = self.session.get(f"{BASE_URL}/api/auth/profile")
        assert profile_response.status_code == 200
        profile_data = profile_response.json()
        assert profile_data.get("phone") == new_phone, f"Phone not persisted: expected {new_phone}, got {profile_data.get('phone')}"
        print("✓ Phone change verified via /api/auth/profile")
    
    def test_update_phone_invalid_format(self):
        """Test phone validation - invalid format"""
        assert self.login(), "Login failed"
        
        response = self.session.post(f"{BASE_URL}/api/auth/update-phone", json={
            "phone": "abc123"  # Invalid format
        })
        
        assert response.status_code == 400
        print("✓ Invalid phone format rejected correctly")
    
    def test_update_phone_too_short(self):
        """Test phone validation - too short"""
        assert self.login(), "Login failed"
        
        response = self.session.post(f"{BASE_URL}/api/auth/update-phone", json={
            "phone": "123"  # Too short
        })
        
        assert response.status_code == 400
        print("✓ Short phone number rejected correctly")
    
    def test_update_phone_unauthenticated(self):
        """Test update phone without auth"""
        response = self.session.post(f"{BASE_URL}/api/auth/update-phone", json={
            "phone": "+33612345678"
        })
        
        assert response.status_code == 401
        print("✓ Unauthenticated update phone rejected")
    
    # === User Profile Tests ===
    def test_get_profile(self):
        """Test getting user profile"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{BASE_URL}/api/auth/profile")
        assert response.status_code == 200
        data = response.json()
        assert "email" in data
        assert "name" in data or data.get("name") is None
        assert "phone" in data or data.get("phone") is None
        print(f"✓ Profile retrieved: {data.get('email')}")
    
    def test_get_me(self):
        """Test getting current user info"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ User info retrieved: {data.get('email')}")
    
    # === Preferences Tests ===
    def test_update_preferences(self):
        """Test updating user preferences"""
        assert self.login(), "Login failed"
        
        response = self.session.put(f"{BASE_URL}/api/auth/preferences", json={
            "theme_preference": "dark"
        })
        
        assert response.status_code == 200
        print("✓ Preferences updated successfully")
    
    # === Prospects Tests ===
    def test_get_prospects(self):
        """Test getting prospects list"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{BASE_URL}/api/prospects")
        assert response.status_code == 200
        data = response.json()
        assert "prospects" in data
        print(f"✓ Prospects retrieved: {len(data.get('prospects', []))} prospects")
    
    # === Tasks Tests ===
    def test_get_today_tasks(self):
        """Test getting today's tasks"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{BASE_URL}/api/tasks/today")
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        print(f"✓ Today's tasks retrieved: {len(data.get('tasks', []))} tasks")
    
    def test_get_all_tasks(self):
        """Test getting all tasks"""
        assert self.login(), "Login failed"
        
        response = self.session.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        print(f"✓ All tasks retrieved: {len(data.get('tasks', []))} tasks")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
