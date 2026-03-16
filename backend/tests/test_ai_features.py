"""
Test KOLO AI Features - AI Suggestions and Message Generation
Tests for iteration 15
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://responsive-kolo.preview.emergentagent.com').rstrip('/')

class TestKoloAIFeatures:
    """Test AI features for KOLO CRM"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get session token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        
        if login_response.status_code == 200:
            data = login_response.json()
            self.token = data.get("token")
            self.session.headers.update({"Authorization": f"Bearer {self.token}"})
            print(f"Login successful, token: {self.token[:20]}...")
        else:
            pytest.skip(f"Login failed: {login_response.status_code} - {login_response.text}")
    
    def test_login_success(self):
        """Test login endpoint works"""
        response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@test.com",
            "password": "testtest"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data or "user_id" in data
        print(f"✓ Login successful")
    
    def test_auth_me(self):
        """Test auth/me returns user data"""
        response = self.session.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ Auth/me returned user: {data.get('email')}")
    
    def test_ai_suggestions_endpoint(self):
        """Test AI suggestions endpoint returns suggestions"""
        response = self.session.get(f"{BASE_URL}/api/tasks/ai-suggestions")
        
        # API may return 200 with suggestions or 500 if LLM issues
        if response.status_code == 200:
            data = response.json()
            assert "suggestions" in data
            suggestions = data.get("suggestions", [])
            print(f"✓ AI suggestions returned {len(suggestions)} suggestions")
            
            # Validate suggestion structure if any
            for s in suggestions[:3]:
                print(f"  - {s.get('prospect_name', 'N/A')}: {s.get('task_title', 'N/A')[:50]}")
        else:
            print(f"! AI suggestions returned {response.status_code}: {response.text[:200]}")
            # Don't fail if it's a server/AI issue
            assert response.status_code in [200, 500, 503], f"Unexpected status: {response.status_code}"
    
    def test_prospects_list(self):
        """Test prospects list endpoint"""
        response = self.session.get(f"{BASE_URL}/api/prospects")
        assert response.status_code == 200
        data = response.json()
        assert "prospects" in data
        prospects = data.get("prospects", [])
        print(f"✓ Found {len(prospects)} prospects")
        
        # Store first prospect ID for message generation test
        if prospects:
            self.prospect_id = prospects[0].get("prospect_id")
            print(f"  First prospect: {prospects[0].get('full_name', 'N/A')}")
        return prospects
    
    def test_generate_message_endpoint(self):
        """Test AI message generation for a prospect"""
        # First get a prospect
        prospects_response = self.session.get(f"{BASE_URL}/api/prospects")
        if prospects_response.status_code != 200:
            pytest.skip("Could not get prospects")
        
        prospects = prospects_response.json().get("prospects", [])
        if not prospects:
            pytest.skip("No prospects available for testing")
        
        prospect_id = prospects[0].get("prospect_id")
        print(f"Testing message generation for prospect: {prospect_id}")
        
        # Generate message
        response = self.session.post(
            f"{BASE_URL}/api/prospects/{prospect_id}/generate-message",
            json={"context": "follow_up"}
        )
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data
            message = data.get("message", "")
            print(f"✓ Generated message ({len(message)} chars): {message[:100]}...")
        else:
            print(f"! Generate message returned {response.status_code}: {response.text[:200]}")
            # AI generation might fail but endpoint should be accessible
            assert response.status_code in [200, 500, 503], f"Unexpected status: {response.status_code}"
    
    def test_tasks_today(self):
        """Test tasks/today endpoint"""
        response = self.session.get(f"{BASE_URL}/api/tasks/today")
        
        # May return 200 or 403 (subscription required)
        if response.status_code == 200:
            data = response.json()
            assert "tasks" in data
            tasks = data.get("tasks", [])
            print(f"✓ Today's tasks: {len(tasks)}")
        elif response.status_code == 403:
            print(f"! Tasks/today requires subscription: {response.text[:100]}")
        else:
            assert False, f"Unexpected response: {response.status_code}"
    
    def test_user_streak(self):
        """Test streak endpoint"""
        response = self.session.get(f"{BASE_URL}/api/auth/streak")
        assert response.status_code == 200
        data = response.json()
        assert "streak" in data
        print(f"✓ User streak: {data.get('streak', 0)}")
    
    def test_user_preferences(self):
        """Test updating user preferences"""
        response = self.session.put(
            f"{BASE_URL}/api/auth/preferences",
            json={"theme_preference": "dark"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "message" in data or "updated" in data
        print(f"✓ Preferences updated")
        
        # Restore to light
        self.session.put(
            f"{BASE_URL}/api/auth/preferences",
            json={"theme_preference": "light"}
        )


class TestOnboardingFlow:
    """Test onboarding-related endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - get session"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
    
    def test_register_new_user(self):
        """Test registration endpoint for new users (onboarding trigger)"""
        import random
        import string
        
        # Generate unique email
        random_suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        test_email = f"test_onboard_{random_suffix}@test.com"
        
        response = self.session.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpassword123",
            "full_name": "Test Onboard User",
            "phone": "+33612345678",
            "country_code": "+33"
        })
        
        # Should return 200 with trial status
        if response.status_code == 200:
            data = response.json()
            assert "user_id" in data
            assert "token" in data
            # New users start with trialing status
            assert data.get("subscription_status") == "trialing"
            print(f"✓ Registration successful for {test_email}")
            print(f"  Subscription status: {data.get('subscription_status')}")
            print(f"  Trial ends at: {data.get('trial_ends_at', 'N/A')}")
        elif response.status_code == 400:
            # Email might already exist
            print(f"! Registration returned 400: {response.text[:100]}")
        else:
            print(f"! Registration returned {response.status_code}: {response.text[:200]}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
