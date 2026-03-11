"""
Test phone number registration and SMS phone features for KOLO CRM
Features tested:
1. Registration with phone number field - should require phone during signup
2. Phone number stored and formatted to international format (+33...)
3. Settings page displays SMS Phone with current number
4. Update phone number endpoint works correctly
5. Today tasks view shows tasks scheduled for today
6. Login and authentication flow works
"""
import pytest
import requests
import os
import uuid
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://kolo-refactor.preview.emergentagent.com').rstrip('/')

class TestPhoneRegistration:
    """Test registration with phone number requirement"""
    
    def test_register_with_phone_success(self):
        """Test successful registration with phone number"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"test_phone_{unique_id}@test.com"
        phone = "0612345678"
        password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "phone": phone
            }
        )
        
        print(f"Register response status: {response.status_code}")
        print(f"Register response: {response.json()}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "user_id" in data
        assert data["email"] == email.lower()
        assert data["subscription_status"] == "trialing"
        assert "trial_ends_at" in data
        assert "token" in data
        
        # Store token for cleanup
        self.token = data["token"]
        self.user_id = data["user_id"]
    
    def test_register_without_phone_fails(self):
        """Test that registration without phone number fails"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"test_nophone_{unique_id}@test.com"
        password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password
                # Missing phone field
            }
        )
        
        print(f"Register without phone status: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Should fail due to missing phone
        assert response.status_code == 422 or response.status_code == 400, f"Expected validation error, got {response.status_code}"
    
    def test_register_with_invalid_phone_fails(self):
        """Test that registration with invalid phone number fails"""
        unique_id = uuid.uuid4().hex[:8]
        email = f"test_invalidphone_{unique_id}@test.com"
        password = "testpass123"
        phone = "123"  # Too short
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "password": password,
                "phone": phone
            }
        )
        
        print(f"Register with invalid phone status: {response.status_code}")
        print(f"Response: {response.text}")
        
        assert response.status_code == 400, f"Expected 400 for invalid phone, got {response.status_code}"
        assert "téléphone" in response.text.lower() or "phone" in response.text.lower()


class TestPhoneFormatting:
    """Test phone number formatting to international format"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user for phone formatting tests"""
        unique_id = uuid.uuid4().hex[:8]
        self.email = f"test_format_{unique_id}@test.com"
        self.phone = "0612345678"
        self.password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "phone": self.phone
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user_id")
        else:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        yield
    
    def test_phone_formatted_to_international(self):
        """Test that phone 0612345678 becomes +33612345678"""
        # Get profile to check stored phone
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/auth/profile",
            headers=headers
        )
        
        print(f"Profile response status: {response.status_code}")
        print(f"Profile response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "phone" in data
        
        # Verify international format
        phone = data["phone"]
        assert phone.startswith("+33"), f"Expected phone to start with +33, got {phone}"
        assert phone == "+33612345678", f"Expected +33612345678, got {phone}"


class TestUpdatePhone:
    """Test update phone number endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user for phone update tests"""
        unique_id = uuid.uuid4().hex[:8]
        self.email = f"test_update_{unique_id}@test.com"
        self.phone = "0612345678"
        self.password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "phone": self.phone
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user_id")
        else:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        yield
    
    def test_update_phone_success(self):
        """Test updating phone number"""
        headers = {"Authorization": f"Bearer {self.token}"}
        new_phone = "0698765432"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/update-phone",
            headers=headers,
            json={"phone": new_phone}
        )
        
        print(f"Update phone status: {response.status_code}")
        print(f"Update phone response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert data["phone"] == "+33698765432", f"Expected +33698765432, got {data['phone']}"
        
        # Verify persistence by fetching profile
        profile_response = requests.get(
            f"{BASE_URL}/api/auth/profile",
            headers=headers
        )
        
        assert profile_response.status_code == 200
        profile = profile_response.json()
        assert profile["phone"] == "+33698765432"
    
    def test_update_phone_invalid_fails(self):
        """Test that updating with invalid phone fails"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/auth/update-phone",
            headers=headers,
            json={"phone": "123"}  # Too short
        )
        
        print(f"Update invalid phone status: {response.status_code}")
        
        assert response.status_code == 400
    
    def test_update_phone_requires_auth(self):
        """Test that updating phone requires authentication"""
        response = requests.post(
            f"{BASE_URL}/api/auth/update-phone",
            json={"phone": "0612345678"}
        )
        
        assert response.status_code == 401


class TestGetProfile:
    """Test get profile endpoint returns phone number"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user"""
        unique_id = uuid.uuid4().hex[:8]
        self.email = f"test_profile_{unique_id}@test.com"
        self.phone = "0612345678"
        self.password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "phone": self.phone
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user_id")
        else:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        yield
    
    def test_get_profile_returns_phone(self):
        """Test that profile endpoint returns phone number"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/auth/profile",
            headers=headers
        )
        
        print(f"Profile status: {response.status_code}")
        print(f"Profile response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "phone" in data
        assert "subscription_status" in data
        assert "trial_ends_at" in data
        
        # Verify phone is in international format
        assert data["phone"].startswith("+33")


class TestLoginFlow:
    """Test login and authentication flow"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user for login tests"""
        unique_id = uuid.uuid4().hex[:8]
        self.email = f"test_login_{unique_id}@test.com"
        self.phone = "0612345678"
        self.password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "phone": self.phone
            }
        )
        
        if response.status_code != 200:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        yield
    
    def test_login_success(self):
        """Test successful login with email/password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": self.email,
                "password": self.password
            }
        )
        
        print(f"Login status: {response.status_code}")
        print(f"Login response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert data["email"] == self.email.lower()
    
    def test_login_wrong_password(self):
        """Test login with wrong password fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": self.email,
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
    
    def test_login_nonexistent_user(self):
        """Test login with nonexistent email fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@test.com",
                "password": "testpass123"
            }
        )
        
        assert response.status_code == 401


class TestTodayTasks:
    """Test today tasks endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup_user(self):
        """Create a test user with tasks"""
        unique_id = uuid.uuid4().hex[:8]
        self.email = f"test_tasks_{unique_id}@test.com"
        self.phone = "0612345678"
        self.password = "testpass123"
        
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": self.email,
                "password": self.password,
                "phone": self.phone
            }
        )
        
        if response.status_code == 200:
            data = response.json()
            self.token = data.get("token")
            self.user_id = data.get("user_id")
        else:
            pytest.skip(f"Failed to create test user: {response.text}")
        
        yield
    
    def test_today_tasks_endpoint(self):
        """Test that today tasks endpoint works"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/tasks/today",
            headers=headers
        )
        
        print(f"Today tasks status: {response.status_code}")
        print(f"Today tasks response: {response.json()}")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "tasks" in data
        assert isinstance(data["tasks"], list)
    
    def test_today_tasks_requires_auth(self):
        """Test that today tasks requires authentication"""
        response = requests.get(f"{BASE_URL}/api/tasks/today")
        
        assert response.status_code == 401
    
    def test_create_and_see_today_task(self):
        """Test creating a task and seeing it in today's tasks"""
        headers = {"Authorization": f"Bearer {self.token}"}
        
        # Create a task for today
        today = datetime.utcnow().replace(hour=12, minute=0, second=0, microsecond=0)
        
        task_response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=headers,
            json={
                "title": f"Test Task {uuid.uuid4().hex[:6]}",
                "description": "Test task for today",
                "task_type": "follow_up",
                "due_date": today.isoformat()
            }
        )
        
        print(f"Create task status: {task_response.status_code}")
        print(f"Create task response: {task_response.json() if task_response.status_code == 200 else task_response.text}")
        
        assert task_response.status_code in [200, 201], f"Failed to create task: {task_response.text}"
        
        # Fetch today tasks
        response = requests.get(
            f"{BASE_URL}/api/tasks/today",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have at least one task
        assert len(data["tasks"]) >= 1


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
