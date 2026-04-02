import requests
import sys
import json
from datetime import datetime

class OpsAITester:
    def __init__(self, base_url="https://cost-control-ai.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.session = requests.Session()

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
                response = self.session.get(url, headers=test_headers)
            elif method == 'POST':
                response = self.session.post(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = self.session.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Response: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_health_check(self):
        """Test API health endpoints"""
        print("\n=== HEALTH CHECK TESTS ===")
        self.run_test("API Root", "GET", "api/", 200)
        self.run_test("Health Check", "GET", "api/health", 200)

    def test_auth_flow(self):
        """Test authentication flow"""
        print("\n=== AUTHENTICATION TESTS ===")
        
        # Test login with correct PIN
        success, response = self.run_test(
            "Login with PIN 1234",
            "POST",
            "api/auth/login",
            200,
            data={"pin": "1234"}
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            print(f"   Token received: {self.token[:20]}...")
            print(f"   User: {response.get('user', {})}")
        else:
            print("❌ Login failed - cannot continue with authenticated tests")
            return False

        # Test get current user
        self.run_test("Get Current User", "GET", "api/auth/me", 200)

        # Test login with wrong PIN
        self.run_test(
            "Login with Wrong PIN",
            "POST", 
            "api/auth/login",
            401,
            data={"pin": "9999"}
        )

        return True

    def test_dashboard(self):
        """Test dashboard endpoint"""
        print("\n=== DASHBOARD TESTS ===")
        success, response = self.run_test("Get Dashboard", "GET", "api/dashboard", 200)
        
        if success:
            required_fields = ['total_sales', 'pour_cost_pct', 'food_cost_pct', 'total_cogs_pct']
            for field in required_fields:
                if field in response:
                    print(f"   ✓ {field}: {response[field]}")
                else:
                    print(f"   ❌ Missing field: {field}")

        # Test with different periods
        self.run_test("Dashboard 14 days", "GET", "api/dashboard?days=14", 200)
        self.run_test("Dashboard 30 days", "GET", "api/dashboard?days=30", 200)

    def test_bar_inventory(self):
        """Test bar inventory endpoints"""
        print("\n=== BAR INVENTORY TESTS ===")
        
        # Get bar items
        success, items = self.run_test("Get Bar Items", "GET", "api/inventory/bar/items", 200)
        
        # Create bar item (manager/admin only)
        success, response = self.run_test(
            "Create Bar Item",
            "POST",
            "api/inventory/bar/items",
            200,
            data={
                "name": "Test Vodka",
                "category": "Spirits",
                "subcategory": "Vodka",
                "location": "Main Bar",
                "section": "Well",
                "bottle_size_ml": 750,
                "cost_per_unit": 25.00
            }
        )
        
        item_id = None
        if success and 'id' in response:
            item_id = response['id']
            print(f"   Created item ID: {item_id}")

        # Record bar count
        if item_id:
            self.run_test(
                "Record Bar Count",
                "POST",
                "api/inventory/bar/counts",
                200,
                data={"item_id": item_id, "level_percentage": 75}
            )

        # Test bulk counts
        if item_id:
            self.run_test(
                "Bulk Bar Counts",
                "POST",
                "api/inventory/bar/counts/bulk",
                200,
                data=[{"item_id": item_id, "level_percentage": 50}]
            )

        # Get items with location filter
        self.run_test("Get Bar Items by Location", "GET", "api/inventory/bar/items?location=Main%20Bar", 200)

    def test_kitchen_inventory(self):
        """Test kitchen inventory endpoints"""
        print("\n=== KITCHEN INVENTORY TESTS ===")
        
        # Get kitchen items
        self.run_test("Get Kitchen Items", "GET", "api/inventory/kitchen/items", 200)
        
        # Create kitchen item
        success, response = self.run_test(
            "Create Kitchen Item",
            "POST",
            "api/inventory/kitchen/items",
            200,
            data={
                "name": "Test Chicken",
                "unit": "lbs",
                "location": "Walk-In Cooler",
                "station": "Proteins",
                "cost_per_unit": 8.50,
                "par_level": 20.0
            }
        )
        
        item_id = None
        if success and 'id' in response:
            item_id = response['id']

        # Record kitchen count
        if item_id:
            self.run_test(
                "Record Kitchen Count",
                "POST",
                "api/inventory/kitchen/counts",
                200,
                data={"item_id": item_id, "quantity": 15.5}
            )

        # Test bulk counts
        if item_id:
            self.run_test(
                "Bulk Kitchen Counts",
                "POST",
                "api/inventory/kitchen/counts/bulk",
                200,
                data=[{"item_id": item_id, "quantity": 12.0}]
            )

    def test_menu_items(self):
        """Test menu items and costing"""
        print("\n=== MENU ITEMS TESTS ===")
        
        # Get menu items
        self.run_test("Get Menu Items", "GET", "api/menu/items", 200)
        
        # Create menu item
        success, response = self.run_test(
            "Create Menu Item",
            "POST",
            "api/menu/items",
            200,
            data={
                "name": "Test Burger",
                "category": "Entrees",
                "price": 16.99
            }
        )
        
        menu_item_id = None
        if success and 'id' in response:
            menu_item_id = response['id']

        # Add ingredient to menu item
        if menu_item_id:
            self.run_test(
                "Add Menu Ingredient",
                "POST",
                "api/menu/ingredients",
                200,
                data={
                    "menu_item_id": menu_item_id,
                    "ingredient_name": "Ground Beef",
                    "quantity_used": 0.25,
                    "unit": "lbs",
                    "cost_per_unit": 8.00
                }
            )

    def test_ai_insights(self):
        """Test AI insights endpoint"""
        print("\n=== AI INSIGHTS TESTS ===")
        
        success, response = self.run_test(
            "Generate AI Insights",
            "POST",
            "api/ai/insights",
            200,
            data={
                "include_bar": True,
                "include_kitchen": True,
                "date_range_days": 7
            }
        )
        
        if success:
            insights = response.get('insights', {})
            context = response.get('context', {})
            
            # Check insights structure
            required_fields = ['key_issues', 'likely_causes', 'recommendations', 'summary']
            for field in required_fields:
                if field in insights:
                    print(f"   ✓ {field}: {len(insights[field]) if isinstance(insights[field], list) else 'present'}")
                else:
                    print(f"   ❌ Missing insights field: {field}")

    def test_user_management(self):
        """Test user management (admin only)"""
        print("\n=== USER MANAGEMENT TESTS ===")
        
        # Get users
        self.run_test("Get Users", "GET", "api/users", 200)
        
        # Create user
        success, response = self.run_test(
            "Create User",
            "POST",
            "api/users",
            200,
            data={
                "name": "Test Manager",
                "pin": "5678",
                "role": "manager"
            }
        )
        
        user_id = None
        if success and 'id' in response:
            user_id = response['id']

        # Delete user (deactivate)
        if user_id:
            self.run_test(
                "Delete User",
                "DELETE",
                f"api/users/{user_id}",
                200
            )

    def test_sales_and_purchases(self):
        """Test sales and purchases endpoints"""
        print("\n=== SALES & PURCHASES TESTS ===")
        
        # Create sale
        self.run_test(
            "Create Sale",
            "POST",
            "api/sales",
            200,
            data={
                "date": datetime.now().isoformat(),
                "total_sales": 1250.00,
                "bar_sales": 450.00,
                "food_sales": 800.00
            }
        )
        
        # Get sales
        self.run_test("Get Sales", "GET", "api/sales", 200)
        
        # Create purchase
        self.run_test(
            "Create Purchase",
            "POST",
            "api/purchases",
            200,
            data={
                "item_name": "Test Beer Case",
                "item_type": "bar",
                "quantity": 2.0,
                "total_cost": 85.00,
                "purchase_type": "bar"
            }
        )
        
        # Get purchases
        self.run_test("Get Purchases", "GET", "api/purchases", 200)

    def run_all_tests(self):
        """Run all test suites"""
        print("🚀 Starting Ops AI Backend API Tests")
        print(f"Testing against: {self.base_url}")
        
        # Health check first
        self.test_health_check()
        
        # Auth flow - required for other tests
        if not self.test_auth_flow():
            print("\n❌ Authentication failed - stopping tests")
            return False
        
        # Core functionality tests
        self.test_dashboard()
        self.test_bar_inventory()
        self.test_kitchen_inventory()
        self.test_menu_items()
        self.test_ai_insights()
        self.test_user_management()
        self.test_sales_and_purchases()
        
        # Print final results
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    tester = OpsAITester()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())