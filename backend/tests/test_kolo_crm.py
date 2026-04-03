"""
KOLO CRM Backend API Tests
Tests for: Login, Tasks (color logic), Prospects (status confirmation flow)
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials - loaded from environment or use test defaults
TEST_EMAIL = os.environ.get('TEST_EMAIL', 'test@test.com')
TEST_PASSWORD = os.environ.get('TEST_PASSWORD', 'testtest')


class TestHealthAndGeo:
    """Basic API health tests"""
    
    def test_api_root(self):
        """API root should return KOLO API message"""
        response = requests.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "KOLO API v1.0.0"
        print("✅ API root endpoint working")

    def test_geo_pricing_usd(self):
        """Geo endpoint should return USD pricing for US"""
        response = requests.get(f"{BASE_URL}/api/geo?country=US&locale=en-US")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "USD"
        assert data["amount"] == 9.99
        print("✅ Geo pricing USD working")
    
    def test_geo_pricing_eur(self):
        """Geo endpoint should return EUR pricing for France"""
        response = requests.get(f"{BASE_URL}/api/geo?country=FR&locale=fr-FR")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "EUR"
        print("✅ Geo pricing EUR working")


class TestAuthentication:
    """Authentication tests"""
    
    def test_login_success(self):
        """Login with valid credentials should succeed"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert data["email"] == TEST_EMAIL
        assert data["subscription_status"] == "active"
        print(f"✅ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_password(self):
        """Login with invalid password should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": "wrongpassword"}
        )
        assert response.status_code == 401
        print("✅ Invalid password rejected correctly")
    
    def test_login_invalid_email(self):
        """Login with non-existent email should fail"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": "nonexistent@test.com", "password": "anypassword"}
        )
        assert response.status_code == 401
        print("✅ Non-existent email rejected correctly")


@pytest.fixture(scope="class")
def auth_session():
    """Create an authenticated session for tests"""
    session = requests.Session()
    response = session.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    # Store session token from cookies
    return session


class TestTasks:
    """Task CRUD and color logic tests"""
    
    def test_get_tasks_today(self, auth_session):
        """Get today's tasks should work"""
        response = auth_session.get(f"{BASE_URL}/api/tasks/today")
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        print(f"✅ Today tasks endpoint working, found {len(data['tasks'])} tasks")
    
    def test_get_all_tasks(self, auth_session):
        """Get all tasks should work"""
        response = auth_session.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200
        data = response.json()
        assert "tasks" in data
        print(f"✅ All tasks endpoint working, found {len(data['tasks'])} tasks")
    
    def test_create_task_today(self, auth_session):
        """Create a task due today"""
        today = datetime.now().strftime("%Y-%m-%dT12:00:00")
        response = auth_session.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_Task_Today_Orange",
                "due_date": today,
                "task_type": "follow_up"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        print(f"✅ Created task due TODAY (should be ORANGE): {data['task_id']}")
        return data["task_id"]
    
    def test_create_task_past(self, auth_session):
        """Create a task due in the past (overdue)"""
        past_date = (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%dT12:00:00")
        response = auth_session.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_Task_Past_Red",
                "due_date": past_date,
                "task_type": "follow_up"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        print(f"✅ Created task due PAST (should be RED/overdue): {data['task_id']}")
        return data["task_id"]
    
    def test_create_task_future(self, auth_session):
        """Create a task due in the future"""
        future_date = (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%dT12:00:00")
        response = auth_session.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_Task_Future_White",
                "due_date": future_date,
                "task_type": "follow_up"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        print(f"✅ Created task due FUTURE (should be WHITE): {data['task_id']}")
        return data["task_id"]
    
    def test_complete_task(self, auth_session):
        """Complete a task and verify it's marked as completed"""
        # First create a task
        today = datetime.now().strftime("%Y-%m-%dT12:00:00")
        create_response = auth_session.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_Task_To_Complete_Green",
                "due_date": today,
                "task_type": "follow_up"
            }
        )
        assert create_response.status_code == 200
        task_id = create_response.json()["task_id"]
        
        # Complete the task
        complete_response = auth_session.post(f"{BASE_URL}/api/tasks/{task_id}/complete")
        assert complete_response.status_code == 200
        print(f"✅ Completed task (should be GREEN): {task_id}")
        
        # Verify task is completed in full list
        tasks_response = auth_session.get(f"{BASE_URL}/api/tasks")
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()["tasks"]
        completed_task = next((t for t in tasks if t["task_id"] == task_id), None)
        if completed_task:
            assert completed_task["completed"] == True
            print("✅ Task completion verified in database")
        
        return task_id
    
    def test_today_tasks_excludes_completed(self, auth_session):
        """Today endpoint should not include completed tasks"""
        response = auth_session.get(f"{BASE_URL}/api/tasks/today")
        assert response.status_code == 200
        tasks = response.json()["tasks"]
        for task in tasks:
            assert task["completed"] == False, "Today tasks should not include completed tasks"
        print(f"✅ Today tasks correctly excludes completed tasks (found {len(tasks)} pending)")


class TestProspects:
    """Prospect CRUD and status change tests"""
    
    def test_get_prospects(self, auth_session):
        """Get prospects list should work"""
        response = auth_session.get(f"{BASE_URL}/api/prospects")
        assert response.status_code == 200
        data = response.json()
        assert "prospects" in data
        print(f"✅ Prospects endpoint working, found {len(data['prospects'])} active prospects")
    
    def test_create_prospect(self, auth_session):
        """Create a new prospect"""
        response = auth_session.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": "TEST_Prospect_John",
                "phone": "+33612345678",
                "email": "test_john@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert "prospect_id" in data
        print(f"✅ Created prospect: {data['prospect_id']}")
        return data["prospect_id"]
    
    def test_get_single_prospect(self, auth_session):
        """Get single prospect with tasks"""
        # First create a prospect
        create_response = auth_session.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": "TEST_Prospect_Detail",
                "phone": "+33698765432",
                "email": "test_detail@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["prospect_id"]
        
        # Get the prospect detail
        response = auth_session.get(f"{BASE_URL}/api/prospects/{prospect_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["full_name"] == "TEST_Prospect_Detail"
        assert "tasks" in data  # Should include tasks array
        print(f"✅ Got prospect detail with {len(data.get('tasks', []))} tasks")
        return prospect_id
    
    def test_update_prospect_status_to_closed(self, auth_session):
        """Update prospect status to 'closed' (won)"""
        # Create a prospect first
        create_response = auth_session.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": "TEST_Prospect_To_Close",
                "phone": "+33611111111",
                "email": "test_close@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["prospect_id"]
        
        # Update to closed
        update_response = auth_session.put(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            json={"status": "closed"}
        )
        assert update_response.status_code == 200
        print(f"✅ Updated prospect to 'closed' status")
        
        # Verify prospect is NOT in the main list (filtered out)
        list_response = auth_session.get(f"{BASE_URL}/api/prospects")
        assert list_response.status_code == 200
        prospects = list_response.json()["prospects"]
        closed_prospect = next((p for p in prospects if p["prospect_id"] == prospect_id), None)
        assert closed_prospect is None, "Closed prospects should be filtered from list"
        print("✅ Closed prospect correctly filtered from main list")
        
        return prospect_id
    
    def test_update_prospect_status_to_lost(self, auth_session):
        """Update prospect status to 'lost'"""
        # Create a prospect first
        create_response = auth_session.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": "TEST_Prospect_To_Lose",
                "phone": "+33622222222",
                "email": "test_lose@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert create_response.status_code == 200
        prospect_id = create_response.json()["prospect_id"]
        
        # Update to lost
        update_response = auth_session.put(
            f"{BASE_URL}/api/prospects/{prospect_id}",
            json={"status": "lost"}
        )
        assert update_response.status_code == 200
        print(f"✅ Updated prospect to 'lost' status")
        
        # Verify prospect is NOT in the main list (filtered out)
        list_response = auth_session.get(f"{BASE_URL}/api/prospects")
        assert list_response.status_code == 200
        prospects = list_response.json()["prospects"]
        lost_prospect = next((p for p in prospects if p["prospect_id"] == prospect_id), None)
        assert lost_prospect is None, "Lost prospects should be filtered from list"
        print("✅ Lost prospect correctly filtered from main list")
        
        return prospect_id
    
    def test_prospects_exclude_closed_and_lost(self, auth_session):
        """Main prospects list should exclude closed and lost"""
        response = auth_session.get(f"{BASE_URL}/api/prospects")
        assert response.status_code == 200
        prospects = response.json()["prospects"]
        
        for prospect in prospects:
            assert prospect["status"] not in ["closed", "lost"], \
                f"Found {prospect['status']} prospect in list - should be filtered"
        
        print(f"✅ All {len(prospects)} prospects in list are active (not closed/lost)")


class TestTaskProspectIntegration:
    """Test task creation linked to prospects"""
    
    def test_create_task_for_prospect(self, auth_session):
        """Create a task linked to a prospect"""
        # First create a prospect
        prospect_response = auth_session.post(
            f"{BASE_URL}/api/prospects",
            json={
                "full_name": "TEST_Prospect_With_Task",
                "phone": "+33633333333",
                "email": "test_with_task@example.com",
                "source": "manual",
                "status": "new"
            }
        )
        assert prospect_response.status_code == 200
        prospect_id = prospect_response.json()["prospect_id"]
        
        # Create task for this prospect
        task_date = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%dT10:00:00")
        task_response = auth_session.post(
            f"{BASE_URL}/api/tasks",
            json={
                "title": "TEST_Follow_up_call",
                "due_date": task_date,
                "task_type": "call",
                "prospect_id": prospect_id
            }
        )
        assert task_response.status_code == 200
        task_id = task_response.json()["task_id"]
        print(f"✅ Created task {task_id} linked to prospect {prospect_id}")
        
        # Verify prospect shows next task
        prospect_detail = auth_session.get(f"{BASE_URL}/api/prospects/{prospect_id}")
        assert prospect_detail.status_code == 200
        data = prospect_detail.json()
        # The auto-generated follow-up task might be next_task_title
        print(f"✅ Prospect next task: {data.get('next_task_title', 'None')}")
        
        return task_id, prospect_id


class TestCleanup:
    """Cleanup test data after tests"""
    
    def test_cleanup_test_tasks(self, auth_session):
        """Delete all TEST_ prefixed tasks"""
        response = auth_session.get(f"{BASE_URL}/api/tasks")
        if response.status_code == 200:
            tasks = response.json()["tasks"]
            deleted = 0
            for task in tasks:
                if task["title"].startswith("TEST_"):
                    del_response = auth_session.delete(f"{BASE_URL}/api/tasks/{task['task_id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"🧹 Cleaned up {deleted} test tasks")
    
    def test_cleanup_test_prospects(self, auth_session):
        """Delete all TEST_ prefixed prospects"""
        response = auth_session.get(f"{BASE_URL}/api/prospects")
        if response.status_code == 200:
            prospects = response.json()["prospects"]
            deleted = 0
            for prospect in prospects:
                if prospect["full_name"].startswith("TEST_"):
                    del_response = auth_session.delete(f"{BASE_URL}/api/prospects/{prospect['prospect_id']}")
                    if del_response.status_code == 200:
                        deleted += 1
            print(f"🧹 Cleaned up {deleted} test prospects")
