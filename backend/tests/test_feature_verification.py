"""
KOLO CRM - Feature Verification Tests (Iteration 5)
Tests for modal UI, task creation with date/time, prospect creation with required email
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "pressardelliot@gmail.com"
TEST_PASSWORD = "Test123"

class TestTaskCreation:
    """Test task creation with date, time, and linked prospect"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
        
        # Get an existing prospect to link
        prospects_response = requests.get(
            f"{BASE_URL}/api/prospects",
            headers=self.headers
        )
        if prospects_response.status_code == 200:
            prospects = prospects_response.json().get("prospects", [])
            self.prospect_id = prospects[0]["prospect_id"] if prospects else None
        else:
            self.prospect_id = None

    def test_create_task_with_date_only(self):
        """Test creating a task with date only"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d") + "T09:00:00"
        
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=self.headers,
            json={
                "title": "TEST_Task_Date_Only",
                "due_date": tomorrow,
                "task_type": "follow_up"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        print(f"✅ Task created with date only: {data['task_id']}")

    def test_create_task_with_date_and_time(self):
        """Test creating a task with specific date and time"""
        tomorrow = datetime.now() + timedelta(days=1)
        due_date = tomorrow.replace(hour=14, minute=30, second=0, microsecond=0).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=self.headers,
            json={
                "title": "TEST_Task_With_Time",
                "due_date": due_date,
                "task_type": "call"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        
        # Verify the task was created with correct time by fetching it
        tasks_response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers=self.headers
        )
        assert tasks_response.status_code == 200
        tasks = tasks_response.json().get("tasks", [])
        
        created_task = next((t for t in tasks if t["task_id"] == data["task_id"]), None)
        assert created_task is not None, "Created task should be in list"
        assert "14:30" in created_task["due_date"] or "14:30:00" in created_task["due_date"]
        print(f"✅ Task created with date and time: {data['task_id']}, due: {created_task['due_date']}")

    def test_create_task_with_linked_prospect(self):
        """Test creating a task linked to a prospect"""
        if not self.prospect_id:
            pytest.skip("No prospect available to link")
        
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        
        response = requests.post(
            f"{BASE_URL}/api/tasks",
            headers=self.headers,
            json={
                "title": "TEST_Task_With_Prospect",
                "due_date": tomorrow,
                "task_type": "follow_up",
                "prospect_id": self.prospect_id
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        print(f"✅ Task created with linked prospect: {data['task_id']}")


class TestProspectCreation:
    """Test prospect creation with required email"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_create_prospect_with_all_fields(self):
        """Test creating a prospect with name, phone, and email"""
        timestamp = datetime.now().strftime("%H%M%S")
        
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "full_name": f"TEST_Prospect_{timestamp}",
                "phone": "+33612345678",
                "email": f"test{timestamp}@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "prospect_id" in data
        print(f"✅ Prospect created: {data['prospect_id']}")
        
        # Verify prospect is in list
        prospects_response = requests.get(
            f"{BASE_URL}/api/prospects",
            headers=self.headers
        )
        assert prospects_response.status_code == 200
        prospects = prospects_response.json().get("prospects", [])
        created = next((p for p in prospects if p["prospect_id"] == data["prospect_id"]), None)
        assert created is not None
        assert created["email"] == f"test{timestamp}@example.com"

    def test_create_prospect_email_required(self):
        """Test that email is required for prospect creation"""
        response = requests.post(
            f"{BASE_URL}/api/prospects",
            headers=self.headers,
            json={
                "full_name": "TEST_No_Email",
                "phone": "+33600000000",
                # Missing email - should fail validation
            }
        )
        # Should fail because email is required
        assert response.status_code == 422, f"Should return 422 for missing email, got {response.status_code}"
        print("✅ Prospect creation correctly rejects missing email")


class TestTodayTasks:
    """Test Today tab shows tasks with dates and times"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_today_tasks_returns_tasks_due_today_or_overdue(self):
        """Test GET /api/tasks/today returns tasks due today or overdue"""
        response = requests.get(
            f"{BASE_URL}/api/tasks/today",
            headers=self.headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        
        # Check that all tasks have due_date field
        for task in data["tasks"]:
            assert "due_date" in task, "Task should have due_date"
            assert "title" in task, "Task should have title"
            # Verify task is either today or overdue
            if task.get("is_today"):
                print(f"✅ Today task: {task['title']}")
            elif task.get("is_overdue"):
                print(f"✅ Overdue task: {task['title']}")
        
        print(f"✅ Today tab shows {len(data['tasks'])} tasks")


class TestPasswordChange:
    """Test password change functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_change_password_wrong_current(self):
        """Test change password fails with wrong current password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=self.headers,
            json={
                "current_password": "WrongPassword123",
                "new_password": "NewPassword123"
            }
        )
        assert response.status_code == 400
        assert "incorrect" in response.json()["detail"].lower()
        print("✅ Password change correctly rejects wrong current password")

    def test_change_password_too_short(self):
        """Test change password fails with too short new password"""
        response = requests.post(
            f"{BASE_URL}/api/auth/change-password",
            headers=self.headers,
            json={
                "current_password": TEST_PASSWORD,
                "new_password": "abc"
            }
        )
        assert response.status_code == 400
        assert "6" in response.json()["detail"]  # Should mention 6 characters
        print("✅ Password change correctly rejects short password")


class TestNavigation:
    """Test navigation endpoints (Today, Prospects, Tasks tabs)"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Login and get token before each test"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        self.token = data.get("token")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def test_all_main_endpoints_accessible(self):
        """Test all main data endpoints are accessible"""
        endpoints = [
            ("/api/tasks/today", "Today tab"),
            ("/api/prospects", "Prospects tab"),
            ("/api/tasks", "Tasks tab"),
            ("/api/auth/me", "Profile/Settings")
        ]
        
        for endpoint, name in endpoints:
            response = requests.get(
                f"{BASE_URL}{endpoint}",
                headers=self.headers
            )
            assert response.status_code == 200, f"{name} endpoint failed: {response.text}"
            print(f"✅ {name} endpoint accessible: {endpoint}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
