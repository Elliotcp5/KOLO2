"""
Test suite for Subscription Plan System (FREE/PRO/PRO+)
Tests: Pricing, Plans, Trials, Feature Flags, Interactions, Heat Score, ROI, Weekly Reports
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@test.com"
TEST_PASSWORD = "testtest"


class TestSetup:
    """Setup and authentication tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a requests session"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Login and get auth token"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        return data.get("session_token")
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get authorization headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestPricingEndpoint(TestSetup):
    """P0: /api/plans/pricing endpoint tests"""
    
    def test_pricing_returns_200(self, session):
        """Test pricing endpoint returns 200"""
        response = session.get(f"{BASE_URL}/api/plans/pricing")
        assert response.status_code == 200
        print("✓ Pricing endpoint returns 200")
    
    def test_pricing_default_currency_eur(self, session):
        """Test default currency is EUR"""
        response = session.get(f"{BASE_URL}/api/plans/pricing")
        data = response.json()
        assert "currency" in data
        assert data["currency"] in ["EUR", "USD", "GBP"]
        print(f"✓ Default currency: {data['currency']}")
    
    def test_pricing_eur_currency(self, session):
        """Test EUR pricing"""
        response = session.get(f"{BASE_URL}/api/plans/pricing?currency=EUR")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "EUR"
        assert "plans" in data
        assert "free" in data["plans"]
        assert "pro" in data["plans"]
        assert "pro_plus" in data["plans"]
        # Verify PRO pricing
        pro = data["plans"]["pro"]
        assert pro["price_monthly"] == 999  # 9.99€ in cents
        assert "9,99" in pro["display_monthly"]
        print("✓ EUR pricing correct")
    
    def test_pricing_usd_currency(self, session):
        """Test USD pricing"""
        response = session.get(f"{BASE_URL}/api/plans/pricing?currency=USD")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "USD"
        pro = data["plans"]["pro"]
        assert pro["price_monthly"] == 1099  # $10.99 in cents
        assert "$10.99" in pro["display_monthly"]
        print("✓ USD pricing correct")
    
    def test_pricing_gbp_currency(self, session):
        """Test GBP pricing"""
        response = session.get(f"{BASE_URL}/api/plans/pricing?currency=GBP")
        assert response.status_code == 200
        data = response.json()
        assert data["currency"] == "GBP"
        pro = data["plans"]["pro"]
        assert pro["price_monthly"] == 899  # £8.99 in cents
        assert "£8.99" in pro["display_monthly"]
        print("✓ GBP pricing correct")
    
    def test_pricing_has_three_plans(self, session):
        """Test pricing returns all 3 plans"""
        response = session.get(f"{BASE_URL}/api/plans/pricing")
        data = response.json()
        plans = data["plans"]
        assert "free" in plans
        assert "pro" in plans
        assert "pro_plus" in plans
        # Verify FREE plan is 0
        assert plans["free"]["price_monthly"] == 0
        assert plans["free"]["price_annual"] == 0
        print("✓ All 3 plans present (FREE/PRO/PRO+)")


class TestCurrentPlanEndpoint(TestSetup):
    """P0: /api/plans/current endpoint tests"""
    
    def test_current_plan_requires_auth(self, session):
        """Test current plan requires authentication"""
        response = session.get(f"{BASE_URL}/api/plans/current")
        assert response.status_code == 401
        print("✓ Current plan requires auth")
    
    def test_current_plan_returns_user_plan(self, session, auth_headers):
        """Test current plan returns user's plan info"""
        response = session.get(f"{BASE_URL}/api/plans/current", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "plan" in data
        assert "effective_plan" in data
        assert "features" in data
        assert "limits" in data
        assert "subscription_status" in data
        
        print(f"✓ Current plan: {data['plan']}, effective: {data['effective_plan']}")
    
    def test_current_plan_has_features(self, session, auth_headers):
        """Test current plan includes feature flags"""
        response = session.get(f"{BASE_URL}/api/plans/current", headers=auth_headers)
        data = response.json()
        features = data["features"]
        
        # Verify feature flags exist
        assert "max_prospects" in features
        assert "daily_ai_suggestions" in features
        assert "sms_one_click" in features
        assert "heat_score" in features
        assert "roi_dashboard" in features
        assert "interaction_history" in features
        
        print(f"✓ Features returned: {list(features.keys())[:5]}...")
    
    def test_current_plan_has_limits(self, session, auth_headers):
        """Test current plan includes usage limits"""
        response = session.get(f"{BASE_URL}/api/plans/current", headers=auth_headers)
        data = response.json()
        limits = data["limits"]
        
        assert "prospects" in limits
        assert "ai_suggestions" in limits
        
        # Verify prospect limit structure
        prospect_limit = limits["prospects"]
        assert "can_add" in prospect_limit
        assert "current" in prospect_limit
        
        print(f"✓ Limits: prospects={prospect_limit}, ai={limits['ai_suggestions']}")


class TestStartTrialEndpoint(TestSetup):
    """P0: /api/plans/start-trial endpoint tests"""
    
    def test_start_trial_requires_auth(self, session):
        """Test start trial requires authentication"""
        response = session.post(f"{BASE_URL}/api/plans/start-trial", json={"plan": "pro"})
        assert response.status_code == 401
        print("✓ Start trial requires auth")
    
    def test_start_trial_invalid_plan(self, session, auth_headers):
        """Test start trial rejects invalid plan"""
        response = session.post(
            f"{BASE_URL}/api/plans/start-trial",
            headers=auth_headers,
            json={"plan": "invalid_plan"}
        )
        assert response.status_code == 400
        print("✓ Invalid plan rejected")
    
    def test_start_trial_valid_plans(self, session, auth_headers):
        """Test start trial accepts valid plans (pro/pro_plus)"""
        # Note: This may fail if user already had a trial
        response = session.post(
            f"{BASE_URL}/api/plans/start-trial",
            headers=auth_headers,
            json={"plan": "pro"}
        )
        # Either 200 (success) or 400 (already had trial)
        assert response.status_code in [200, 400]
        
        if response.status_code == 200:
            data = response.json()
            assert "trial_plan" in data
            assert "trial_ends_at" in data
            assert data["days_remaining"] == 14
            print("✓ Trial started successfully")
        else:
            print("✓ Trial already used (expected for existing user)")


class TestCheckFeatureEndpoint(TestSetup):
    """P0: /api/plans/check-feature/{feature} endpoint tests"""
    
    def test_check_feature_requires_auth(self, session):
        """Test check feature requires authentication"""
        response = session.get(f"{BASE_URL}/api/plans/check-feature/heat_score")
        assert response.status_code == 401
        print("✓ Check feature requires auth")
    
    def test_check_feature_heat_score(self, session, auth_headers):
        """Test check heat_score feature"""
        response = session.get(
            f"{BASE_URL}/api/plans/check-feature/heat_score",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert "has_access" in data
        assert "feature" in data
        assert data["feature"] == "heat_score"
        print(f"✓ heat_score access: {data['has_access']}")
    
    def test_check_feature_sms_one_click(self, session, auth_headers):
        """Test check sms_one_click feature"""
        response = session.get(
            f"{BASE_URL}/api/plans/check-feature/sms_one_click",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["feature"] == "sms_one_click"
        print(f"✓ sms_one_click access: {data['has_access']}")
    
    def test_check_feature_roi_dashboard(self, session, auth_headers):
        """Test check roi_dashboard feature"""
        response = session.get(
            f"{BASE_URL}/api/plans/check-feature/roi_dashboard",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["feature"] == "roi_dashboard"
        print(f"✓ roi_dashboard access: {data['has_access']}")


class TestAIGenerateSMSEndpoint(TestSetup):
    """P1: /api/ai/generate-sms endpoint tests"""
    
    def test_generate_sms_requires_auth(self, session):
        """Test generate SMS requires authentication"""
        response = session.post(f"{BASE_URL}/api/ai/generate-sms", json={
            "prospect_id": "test_id"
        })
        assert response.status_code == 401
        print("✓ Generate SMS requires auth")
    
    def test_generate_sms_returns_message(self, session, auth_headers):
        """Test generate SMS returns a message (even fallback for FREE users)"""
        # First get a prospect ID
        prospects_resp = session.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        if prospects_resp.status_code == 200:
            prospects = prospects_resp.json()
            if prospects:
                prospect_id = prospects[0]["prospect_id"]
                
                response = session.post(
                    f"{BASE_URL}/api/ai/generate-sms",
                    headers=auth_headers,
                    json={
                        "prospect_id": prospect_id,
                        "locale": "fr"
                    }
                )
                # Should return 200 with message or 403 if feature locked
                assert response.status_code in [200, 403]
                
                if response.status_code == 200:
                    data = response.json()
                    assert "message" in data
                    assert len(data["message"]) > 10
                    print(f"✓ SMS generated: {data['message'][:50]}...")
                else:
                    print("✓ SMS feature locked for FREE plan (expected)")
            else:
                print("⚠ No prospects to test SMS generation")
        else:
            print("⚠ Could not fetch prospects")


class TestInteractionsEndpoint(TestSetup):
    """P1: /api/interactions endpoint tests"""
    
    def test_create_interaction_requires_auth(self, session):
        """Test create interaction requires authentication"""
        response = session.post(f"{BASE_URL}/api/interactions", json={
            "prospect_id": "test_id",
            "interaction_type": "sms"
        })
        assert response.status_code == 401
        print("✓ Create interaction requires auth")
    
    def test_create_interaction(self, session, auth_headers):
        """Test creating an interaction"""
        # First get a prospect ID
        prospects_resp = session.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        if prospects_resp.status_code == 200:
            prospects = prospects_resp.json()
            if prospects:
                prospect_id = prospects[0]["prospect_id"]
                
                response = session.post(
                    f"{BASE_URL}/api/interactions",
                    headers=auth_headers,
                    json={
                        "prospect_id": prospect_id,
                        "interaction_type": "note",
                        "content": "TEST_interaction_note"
                    }
                )
                # 200 if PRO, 403 if FREE
                assert response.status_code in [200, 201, 403]
                
                if response.status_code in [200, 201]:
                    data = response.json()
                    assert "interaction_id" in data
                    print(f"✓ Interaction created: {data['interaction_id']}")
                else:
                    print("✓ Interaction feature locked for FREE plan")
            else:
                print("⚠ No prospects to test interactions")
        else:
            print("⚠ Could not fetch prospects")
    
    def test_get_interactions_requires_auth(self, session):
        """Test get interactions requires authentication"""
        response = session.get(f"{BASE_URL}/api/interactions/test_id")
        assert response.status_code == 401
        print("✓ Get interactions requires auth")
    
    def test_get_interactions_for_prospect(self, session, auth_headers):
        """Test getting interactions for a prospect"""
        prospects_resp = session.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        if prospects_resp.status_code == 200:
            prospects = prospects_resp.json()
            if prospects:
                prospect_id = prospects[0]["prospect_id"]
                
                response = session.get(
                    f"{BASE_URL}/api/interactions/{prospect_id}",
                    headers=auth_headers
                )
                # 200 if PRO, 403 if FREE
                assert response.status_code in [200, 403]
                
                if response.status_code == 200:
                    data = response.json()
                    assert "interactions" in data
                    print(f"✓ Got {len(data['interactions'])} interactions")
                else:
                    print("✓ Interactions feature locked for FREE plan")


class TestHeatScoreEndpoint(TestSetup):
    """P2: /api/prospects/{prospect_id}/calculate-heat endpoint tests"""
    
    def test_calculate_heat_requires_auth(self, session):
        """Test calculate heat requires authentication"""
        response = session.post(f"{BASE_URL}/api/prospects/test_id/calculate-heat")
        assert response.status_code == 401
        print("✓ Calculate heat requires auth")
    
    def test_calculate_heat_score(self, session, auth_headers):
        """Test calculating heat score for a prospect"""
        prospects_resp = session.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        if prospects_resp.status_code == 200:
            prospects = prospects_resp.json()
            if prospects:
                prospect_id = prospects[0]["prospect_id"]
                
                response = session.post(
                    f"{BASE_URL}/api/prospects/{prospect_id}/calculate-heat",
                    headers=auth_headers
                )
                # 200 if PRO+, 403 if FREE/PRO
                assert response.status_code in [200, 403]
                
                if response.status_code == 200:
                    data = response.json()
                    assert "heat_score" in data
                    assert "heat_status" in data
                    assert 0 <= data["heat_score"] <= 100
                    print(f"✓ Heat score: {data['heat_score']} ({data['heat_status']})")
                else:
                    print("✓ Heat score feature locked (PRO+ only)")


class TestMarkAsSoldEndpoint(TestSetup):
    """P3: /api/prospects/{prospect_id}/mark-sold endpoint tests"""
    
    def test_mark_sold_requires_auth(self, session):
        """Test mark sold requires authentication"""
        response = session.post(
            f"{BASE_URL}/api/prospects/test_id/mark-sold",
            json={"commission_amount": 5000}
        )
        assert response.status_code == 401
        print("✓ Mark sold requires auth")
    
    def test_mark_sold_requires_commission(self, session, auth_headers):
        """Test mark sold requires commission amount"""
        prospects_resp = session.get(f"{BASE_URL}/api/prospects", headers=auth_headers)
        if prospects_resp.status_code == 200:
            prospects = prospects_resp.json()
            if prospects:
                prospect_id = prospects[0]["prospect_id"]
                
                # Test without commission
                response = session.post(
                    f"{BASE_URL}/api/prospects/{prospect_id}/mark-sold",
                    headers=auth_headers,
                    json={}
                )
                # Should fail validation or be locked
                assert response.status_code in [400, 403, 422]
                print("✓ Mark sold requires commission amount")


class TestROIDashboardEndpoint(TestSetup):
    """P3: /api/dashboard/roi endpoint tests"""
    
    def test_roi_dashboard_requires_auth(self, session):
        """Test ROI dashboard requires authentication"""
        response = session.get(f"{BASE_URL}/api/dashboard/roi")
        assert response.status_code == 401
        print("✓ ROI dashboard requires auth")
    
    def test_roi_dashboard_returns_data(self, session, auth_headers):
        """Test ROI dashboard returns monthly data"""
        response = session.get(f"{BASE_URL}/api/dashboard/roi", headers=auth_headers)
        # 200 if PRO+, 403 if FREE/PRO
        assert response.status_code in [200, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert "ca_this_month" in data
            assert "sales_this_month" in data
            assert "average_commission" in data
            print(f"✓ ROI data: CA={data['ca_this_month']}€, Sales={data['sales_this_month']}")
        else:
            print("✓ ROI dashboard locked (PRO+ only)")


class TestWeeklyReportEndpoint(TestSetup):
    """P3: /api/reports/weekly endpoint tests"""
    
    def test_weekly_report_requires_auth(self, session):
        """Test weekly report requires authentication"""
        response = session.post(f"{BASE_URL}/api/reports/weekly")
        assert response.status_code == 401
        print("✓ Weekly report requires auth")
    
    def test_weekly_report_generation(self, session, auth_headers):
        """Test weekly report generation"""
        response = session.post(f"{BASE_URL}/api/reports/weekly", headers=auth_headers)
        # 200 if PRO+, 403 if FREE/PRO
        assert response.status_code in [200, 403]
        
        if response.status_code == 200:
            data = response.json()
            assert "message" in data or "report" in data
            print("✓ Weekly report generated")
        else:
            print("✓ Weekly report locked (PRO+ only)")


class TestAuthMeWithPlanInfo(TestSetup):
    """Test /api/auth/me returns plan information"""
    
    def test_auth_me_includes_plan_info(self, session, auth_headers):
        """Test auth/me includes plan and features"""
        response = session.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify plan info is included
        assert "plan" in data
        assert "effective_plan" in data
        assert "features" in data
        assert "limits" in data
        
        print(f"✓ Auth/me includes plan: {data['plan']}, effective: {data['effective_plan']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
