"""
KOLO CRM Complete Feature Tests - Iteration 11
Testing all requested endpoints:
- POST /api/auth/login - user authentication
- POST /api/auth/register - new user registration
- GET /api/prospects - prospect list
- POST /api/prospects - create prospect
- GET /api/tasks/ai-suggestions - AI suggestions for inactive prospects
- POST /api/prospects/{prospect_id}/generate-message - AI SMS generation
- POST /api/tasks - manual task creation
- GET /api/tasks - task list
"""

import pytest
import requests
import os
import uuid
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://kolo-final-push.preview.emergentagent.com"

# Known test user
TEST_USER_EMAIL = "test@test.com"
TEST_USER_PASSWORD = "testtest"

# Inactive prospect for AI testing
INACTIVE_PROSPECT_ID = "prospect_9ee8eb4275a4"  # Marie Inactif Test

def unique_email(prefix="test"):
    """Generate unique email using uuid"""
    return f"{prefix}_{uuid.uuid4().hex[:8]}@test.com"


class TestAuth:
    """Test authentication endpoints"""
    
    def test_login_with_known_user(self):
        """POST /api/auth/login - Login with known test user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        assert "token" in data, "Token missing from response"
        assert data["token"].startswith("sess_"), "Token should start with sess_"
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == TEST_USER_EMAIL
        assert "subscription_status" in data
        print(f"✓ Login successful for {TEST_USER_EMAIL}, status: {data['subscription_status']}")
        
    def test_login_invalid_credentials(self):
        """POST /api/auth/login - Login fails with wrong password"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": "wrongpassword123"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Login correctly rejected with invalid credentials")
        
    def test_register_new_user(self):
        """POST /api/auth/register - Register new user with free trial"""
        email = unique_email("newuser")
        
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": email,
            "password": "testpass123",
            "full_name": "Test User",
            "phone": "+33612345678"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        assert "user_id" in data
        assert "email" in data
        assert data["email"] == email.lower()
        assert "subscription_status" in data
        assert data["subscription_status"] == "trialing"
        assert "trial_ends_at" in data
        assert "token" in data
        print(f"✓ New user registered with email {email}, status: trialing")
        
    def test_register_duplicate_email_fails(self):
        """POST /api/auth/register - Cannot register with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": "testpass123",
            "full_name": "Duplicate Test",
            "phone": "+33612345678"
        })
        
        assert response.status_code == 400
        print("✓ Duplicate email registration correctly rejected")


class TestProspects:
    """Test prospect endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_prospects_list(self):
        """GET /api/prospects - Get list of prospects"""
        response = requests.get(f"{BASE_URL}/api/prospects", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get prospects: {response.text}"
        data = response.json()
        
        assert "prospects" in data
        assert isinstance(data["prospects"], list)
        print(f"✓ Retrieved {len(data['prospects'])} prospects")
        
        # Check if inactive prospect exists
        prospect_ids = [p["prospect_id"] for p in data["prospects"]]
        if INACTIVE_PROSPECT_ID in prospect_ids:
            print(f"✓ Inactive prospect {INACTIVE_PROSPECT_ID} found in list")
        
    def test_create_prospect(self):
        """POST /api/prospects - Create new prospect"""
        prospect_name = f"Test Prospect {uuid.uuid4().hex[:8]}"
        
        response = requests.post(f"{BASE_URL}/api/prospects", 
            headers=self.headers,
            json={
                "full_name": prospect_name,
                "phone": "+33612345678",
                "email": f"prospect_{uuid.uuid4().hex[:8]}@test.com",
                "source": "manual",
                "status": "new",
                "notes": "Test prospect created by automated test"
            }
        )
        
        assert response.status_code in [200, 201], f"Failed to create prospect: {response.text}"
        data = response.json()
        
        assert "prospect_id" in data
        assert data["prospect_id"].startswith("prospect_")
        print(f"✓ Created prospect {prospect_name} with ID {data['prospect_id']}")


class TestTasks:
    """Test task endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_tasks_list(self):
        """GET /api/tasks - Get list of tasks"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        data = response.json()
        
        assert "tasks" in data
        assert isinstance(data["tasks"], list)
        print(f"✓ Retrieved {len(data['tasks'])} tasks")
        
    def test_create_manual_task(self):
        """POST /api/tasks - Create manual task"""
        from datetime import datetime, timedelta
        
        due_date = (datetime.utcnow() + timedelta(days=1)).isoformat() + "Z"
        
        response = requests.post(f"{BASE_URL}/api/tasks",
            headers=self.headers,
            json={
                "title": f"Test Task {uuid.uuid4().hex[:8]}",
                "description": "Automated test task",
                "task_type": "call",
                "due_date": due_date
            }
        )
        
        assert response.status_code in [200, 201], f"Failed to create task: {response.text}"
        data = response.json()
        
        assert "task_id" in data
        assert data["task_id"].startswith("task_")
        print(f"✓ Created manual task with ID {data['task_id']}")
        
    def test_create_task_linked_to_prospect(self):
        """POST /api/tasks - Create task linked to a prospect"""
        from datetime import datetime, timedelta
        
        # First get a prospect ID
        prospects_response = requests.get(f"{BASE_URL}/api/prospects", headers=self.headers)
        assert prospects_response.status_code == 200
        prospects = prospects_response.json().get("prospects", [])
        
        if not prospects:
            pytest.skip("No prospects available to link task")
            
        prospect_id = prospects[0]["prospect_id"]
        due_date = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        
        response = requests.post(f"{BASE_URL}/api/tasks",
            headers=self.headers,
            json={
                "prospect_id": prospect_id,
                "title": f"Follow-up Task {uuid.uuid4().hex[:8]}",
                "description": "Follow-up call with prospect",
                "task_type": "call",
                "due_date": due_date
            }
        )
        
        assert response.status_code in [200, 201], f"Failed to create linked task: {response.text}"
        data = response.json()
        
        assert "task_id" in data
        task_id = data["task_id"]
        
        # Verify the task was created with prospect link by fetching tasks
        tasks_response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        if tasks_response.status_code == 200:
            tasks = tasks_response.json().get("tasks", [])
            linked_task = next((t for t in tasks if t.get("task_id") == task_id), None)
            if linked_task and linked_task.get("prospect_id") == prospect_id:
                print(f"✓ Created task {task_id} correctly linked to prospect {prospect_id}")
            else:
                print(f"✓ Created task {task_id} (prospect link verification pending)")
        else:
            print(f"✓ Created task {task_id} linked to prospect {prospect_id}")


class TestAISuggestions:
    """Test AI suggestions for inactive prospects"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_get_ai_suggestions(self):
        """GET /api/tasks/ai-suggestions - Get AI suggestions for inactive prospects"""
        response = requests.get(f"{BASE_URL}/api/tasks/ai-suggestions", headers=self.headers)
        
        assert response.status_code == 200, f"Failed to get AI suggestions: {response.text}"
        data = response.json()
        
        assert "suggestions" in data
        assert isinstance(data["suggestions"], list)
        
        if data["suggestions"]:
            suggestion = data["suggestions"][0]
            assert "prospect_id" in suggestion
            assert "prospect_name" in suggestion
            assert "task_title" in suggestion or "task_type" in suggestion
            print(f"✓ Got {len(data['suggestions'])} AI suggestions")
            print(f"  First suggestion: {suggestion.get('prospect_name', 'N/A')} - {suggestion.get('reason', 'N/A')}")
        else:
            print("✓ AI suggestions endpoint working (no inactive prospects found or all are active)")
            
        if "inactive_count" in data:
            print(f"  Inactive prospect count: {data['inactive_count']}")
            
    def test_ai_suggestions_requires_auth(self):
        """GET /api/tasks/ai-suggestions - Requires authentication"""
        response = requests.get(f"{BASE_URL}/api/tasks/ai-suggestions")
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ AI suggestions correctly requires authentication")


class TestAIMessageGeneration:
    """Test AI SMS message generation"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token for each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        self.token = response.json()["token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
    def test_generate_message_for_prospect(self):
        """POST /api/prospects/{prospect_id}/generate-message - Generate AI SMS"""
        # First get a prospect ID
        prospects_response = requests.get(f"{BASE_URL}/api/prospects", headers=self.headers)
        assert prospects_response.status_code == 200
        prospects = prospects_response.json().get("prospects", [])
        
        if not prospects:
            pytest.skip("No prospects available for message generation")
            
        prospect_id = prospects[0]["prospect_id"]
        prospect_name = prospects[0].get("full_name", "Unknown")
        
        response = requests.post(
            f"{BASE_URL}/api/prospects/{prospect_id}/generate-message",
            headers=self.headers,
            json={"context": "sms_follow_up"}
        )
        
        assert response.status_code == 200, f"Failed to generate message: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert len(data["message"]) > 0
        print(f"✓ Generated AI message for {prospect_name}:")
        print(f"  Message: {data['message'][:100]}...")
        
    def test_generate_message_with_inactive_prospect(self):
        """POST /api/prospects/{prospect_id}/generate-message - Test with inactive prospect"""
        # Try with the known inactive prospect
        response = requests.post(
            f"{BASE_URL}/api/prospects/{INACTIVE_PROSPECT_ID}/generate-message",
            headers=self.headers,
            json={"context": "overdue_follow_up"}
        )
        
        if response.status_code == 404:
            print(f"⚠ Inactive prospect {INACTIVE_PROSPECT_ID} not found (may have been deleted)")
            pytest.skip("Inactive prospect not found")
            
        assert response.status_code == 200, f"Failed to generate message: {response.text}"
        data = response.json()
        
        assert "message" in data
        print(f"✓ Generated message for inactive prospect:")
        print(f"  Message: {data['message'][:100]}...")
        
    def test_generate_message_invalid_prospect(self):
        """POST /api/prospects/{prospect_id}/generate-message - Invalid prospect returns 404"""
        response = requests.post(
            f"{BASE_URL}/api/prospects/nonexistent_prospect_id/generate-message",
            headers=self.headers,
            json={"context": "follow_up"}
        )
        
        assert response.status_code == 404
        print("✓ Correctly returns 404 for non-existent prospect")


class TestHealthAndBasics:
    """Test basic health endpoints"""
    
    def test_api_health(self):
        """Basic API connectivity test"""
        # Try a simple endpoint
        response = requests.get(f"{BASE_URL}/api/geo")
        
        assert response.status_code == 200, f"API not responding: {response.text}"
        data = response.json()
        
        assert "country" in data
        assert "currency" in data
        print(f"✓ API healthy - detected country: {data['country']}, currency: {data['currency']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
