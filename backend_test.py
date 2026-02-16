import requests
import sys
from datetime import datetime

class KoloAPITester:
    def __init__(self, base_url="https://kolo-checkout-flow.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if headers:
            test_headers.update(headers)
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            print(f"   Status: {response.status_code}")
            success = response.status_code == expected_status
            
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_json = response.json()
                    print(f"   Response: {response_json}")
                    return True, response_json
                except:
                    print(f"   Response: {response.text[:200]}")
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_response = response.json()
                    print(f"   Error: {error_response}")
                except:
                    print(f"   Error text: {response.text[:200]}")
                return False, {}

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timeout")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_root_endpoint(self):
        """Test the root API endpoint"""
        success, response = self.run_test(
            "Root API Endpoint",
            "GET",
            "api/",
            200
        )
        if success and response.get('message') == 'KOLO API v1.0.0':
            print("   ✓ Correct API version message")
            return True
        else:
            print(f"   ❌ Expected 'KOLO API v1.0.0', got: {response.get('message')}")
            return False

    def test_geo_endpoint(self):
        """Test the geo pricing endpoint"""
        success, response = self.run_test(
            "Geo Pricing Endpoint",
            "GET",
            "api/geo",
            200
        )
        
        if not success:
            return False
        
        # Check required fields
        required_fields = ['country', 'currency', 'amount', 'symbol', 'locale']
        missing_fields = [field for field in required_fields if field not in response]
        
        if missing_fields:
            print(f"   ❌ Missing required fields: {missing_fields}")
            return False
        
        # Check pricing structure
        if response.get('amount') != 9.99:
            print(f"   ❌ Expected amount 9.99, got: {response.get('amount')}")
            return False
        
        # Check valid currency
        valid_currencies = ['EUR', 'GBP', 'USD']
        if response.get('currency') not in valid_currencies:
            print(f"   ❌ Invalid currency: {response.get('currency')}")
            return False
        
        print("   ✓ Correct pricing structure")
        return True

    def test_geo_with_country_param(self):
        """Test geo endpoint with specific country parameter"""
        test_cases = [
            ('US', 'USD', '$'),
            ('GB', 'GBP', '£'),
            ('FR', 'EUR', '€'),
            ('DE', 'EUR', '€')
        ]
        
        for country, expected_currency, expected_symbol in test_cases:
            success, response = self.run_test(
                f"Geo Endpoint - {country}",
                "GET",
                f"api/geo?country={country}",
                200
            )
            
            if not success:
                return False
            
            if response.get('currency') != expected_currency:
                print(f"   ❌ Expected currency {expected_currency} for {country}, got: {response.get('currency')}")
                return False
            
            if response.get('symbol') != expected_symbol:
                print(f"   ❌ Expected symbol {expected_symbol} for {country}, got: {response.get('symbol')}")
                return False
        
        print("   ✓ All country-specific pricing correct")
        return True

    def test_create_checkout(self):
        """Test creating a checkout session"""
        success, response = self.run_test(
            "Create Checkout Session",
            "POST",
            "api/payments/create-checkout",
            200,
            data={
                "origin_url": "https://kolo-checkout-flow.preview.emergentagent.com",
                "locale": "en-US",
                "country": "US"
            }
        )
        
        if success and 'url' in response and 'session_id' in response:
            print("   ✓ Checkout session created successfully")
            self.checkout_session_id = response.get('session_id')
            return True
        else:
            print(f"   ❌ Missing url or session_id in response")
            return False

    def test_notifications_subscribe_endpoint(self):
        """Test push notifications subscribe endpoint - CRITICAL REQUIREMENT"""
        print("\n🔍 Testing Push Notifications Subscribe Endpoint (CRITICAL REQUIREMENT)...")
        
        # Test without authentication (should work with user_id)
        test_subscription = {
            "subscription": {
                "endpoint": "https://fcm.googleapis.com/fcm/send/test",
                "keys": {
                    "p256dh": "test_p256dh_key",
                    "auth": "test_auth_key"
                }
            },
            "user_id": "test_user_123"
        }
        
        success, response = self.run_test(
            "Push Notifications Subscribe", 
            "POST", 
            "api/notifications/subscribe", 
            200, 
            data=test_subscription
        )
        
        if success:
            print("   ✅ Push notifications subscribe endpoint is working")
        else:
            print("   ❌ Push notifications subscribe endpoint failed")
            
        return success

    def test_tasks_today_endpoint(self):
        """Test today tasks endpoint - requires authentication"""
        print("\n🔍 Testing Tasks Today Endpoint (Authentication Required)...")
        success, response = self.run_test(
            "Tasks Today (No Auth)", 
            "GET", 
            "api/tasks/today", 
            401  # Should fail without authentication
        )
        
        if success:
            print("   ✅ Tasks today endpoint properly requires authentication")
        else:
            print("   ❌ Tasks today endpoint authentication check failed")
            
        return success

    def test_cors_headers(self):
        """Test CORS headers are present"""
        url = f"{self.base_url}/api/"
        try:
            response = requests.options(url, timeout=10)
            cors_headers = {
                'access-control-allow-origin',
                'access-control-allow-methods',
                'access-control-allow-headers'
            }
            
            present_headers = set(header.lower() for header in response.headers.keys())
            missing_cors = cors_headers - present_headers
            
            if missing_cors:
                print(f"❌ Missing CORS headers: {missing_cors}")
                return False
            
            print("✅ CORS headers present")
            return True
            
        except Exception as e:
            print(f"❌ CORS test failed: {e}")
            return False

def main():
    print("🚀 Starting KOLO API Testing...")
    print("=" * 50)
    
    # Setup
    tester = KoloAPITester()
    all_tests_passed = True
    
    # Test critical endpoints mentioned in requirements
    test_results = []
    
    # Test root endpoint
    result = tester.test_root_endpoint()
    test_results.append(('Root API Endpoint', result))
    if not result:
        all_tests_passed = False
    
    # Test geo endpoint
    result = tester.test_geo_endpoint()
    test_results.append(('Geo Pricing Endpoint', result))
    if not result:
        all_tests_passed = False
    
    # Test geo with country parameters
    result = tester.test_geo_with_country_param()
    test_results.append(('Geo Country-specific Pricing', result))
    if not result:
        all_tests_passed = False
    
    # Test checkout creation
    result = tester.test_create_checkout()
    test_results.append(('Create Checkout Session', result))
    if not result:
        all_tests_passed = False
    
    # Test critical PWA features - REQUIREMENTS
    result = tester.test_notifications_subscribe_endpoint()
    test_results.append(('Push Notifications Subscribe (CRITICAL)', result))
    if not result:
        all_tests_passed = False
    
    # Test tasks today endpoint (for "Onglet Aujourd'hui" requirement)
    result = tester.test_tasks_today_endpoint()
    test_results.append(('Tasks Today Endpoint', result))
    if not result:
        all_tests_passed = False
    
    # Test CORS
    result = tester.test_cors_headers()
    test_results.append(('CORS Headers', result))
    if not result:
        all_tests_passed = False
    
    # Print results summary
    print("\n" + "=" * 50)
    print("📊 TEST SUMMARY")
    print("=" * 50)
    
    for test_name, passed in test_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} {test_name}")
    
    print(f"\n📈 Overall: {tester.tests_passed}/{tester.tests_run} tests passed")
    
    if all_tests_passed:
        print("🎉 All critical API endpoints working correctly!")
        return 0
    else:
        print("⚠️ Some API tests failed - check logs above")
        return 1

if __name__ == "__main__":
    sys.exit(main())