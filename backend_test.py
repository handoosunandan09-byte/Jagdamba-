#!/usr/bin/env python3
"""
Backend API Test Suite for Saathi Safety App
Tests all backend endpoints at REACT_APP_BACKEND_URL/api
"""

import requests
import json
import sys
from typing import Dict, Any

# Backend URL from frontend/.env
BACKEND_URL = "https://deploy-check-110.preview.emergentagent.com/api"

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_test(name: str):
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST: {name}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")

def print_pass(msg: str):
    print(f"{Colors.GREEN}✓ PASS: {msg}{Colors.RESET}")

def print_fail(msg: str):
    print(f"{Colors.RED}✗ FAIL: {msg}{Colors.RESET}")

def print_info(msg: str):
    print(f"{Colors.YELLOW}ℹ INFO: {msg}{Colors.RESET}")

# Track test results
test_results = {
    "passed": 0,
    "failed": 0,
    "errors": []
}

def test_root_endpoint():
    """Test GET /api/ - should return 200 with a message"""
    print_test("GET /api/ - Root endpoint")
    
    try:
        response = requests.get(f"{BACKEND_URL}/", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if "message" in data:
                print_pass("Root endpoint returns 200 with message")
                test_results["passed"] += 1
                return True
            else:
                print_fail("Response missing 'message' field")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/ - missing 'message' field")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/ - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/ - Exception: {str(e)}")
        return False

def test_chat_endpoint():
    """Test POST /api/chat - Gemini integration with multi-turn memory"""
    print_test("POST /api/chat - Gemini chat with multi-turn memory")
    
    session_id = "test-sess-1"
    
    # Test 1: First message - safety scenario
    print_info("Test 1: Sending first message about safety concern")
    try:
        payload = {
            "session_id": session_id,
            "message": "Someone is following me on my way home, I'm scared"
        }
        response = requests.post(f"{BACKEND_URL}/chat", json=payload, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if "reply" in data and "session_id" in data:
                if data["session_id"] == session_id and data["reply"].strip():
                    print_pass("Chat returns 200 with non-empty reply and correct session_id")
                    print_info(f"Reply preview: {data['reply'][:200]}...")
                    test_results["passed"] += 1
                else:
                    print_fail("Reply is empty or session_id mismatch")
                    test_results["failed"] += 1
                    test_results["errors"].append("POST /api/chat - empty reply or session_id mismatch")
                    return False
            else:
                print_fail("Response missing 'reply' or 'session_id' field")
                test_results["failed"] += 1
                test_results["errors"].append("POST /api/chat - missing required fields")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/chat - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception on first message: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/chat (first message) - Exception: {str(e)}")
        return False
    
    # Test 2: Second message - test multi-turn memory
    print_info("\nTest 2: Sending second message to test conversation memory")
    try:
        payload = {
            "session_id": session_id,
            "message": "What was the first thing you told me to do?"
        }
        response = requests.post(f"{BACKEND_URL}/chat", json=payload, timeout=30)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text[:500]}")
        
        if response.status_code == 200:
            data = response.json()
            if "reply" in data and data["reply"].strip():
                # Check if reply references prior context (basic heuristic)
                reply_lower = data["reply"].lower()
                has_context = any(word in reply_lower for word in ["told", "said", "suggested", "advised", "mentioned", "first", "earlier"])
                
                if has_context:
                    print_pass("Multi-turn memory works - reply references prior context")
                    print_info(f"Reply preview: {data['reply'][:200]}...")
                    test_results["passed"] += 1
                else:
                    print_fail("Reply doesn't seem to reference prior context")
                    print_info(f"Reply: {data['reply']}")
                    test_results["failed"] += 1
                    test_results["errors"].append("POST /api/chat - multi-turn memory may not be working")
                    return False
            else:
                print_fail("Second message reply is empty")
                test_results["failed"] += 1
                test_results["errors"].append("POST /api/chat (second message) - empty reply")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/chat (second message) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception on second message: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/chat (second message) - Exception: {str(e)}")
        return False
    
    # Test 3: Empty message validation
    print_info("\nTest 3: Testing empty message validation")
    try:
        payload = {
            "session_id": "test-sess-2",
            "message": "   "
        }
        response = requests.post(f"{BACKEND_URL}/chat", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 400:
            print_pass("Empty message correctly returns 400")
            test_results["passed"] += 1
            return True
        else:
            print_fail(f"Expected 400 for empty message, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/chat (empty message) - returned {response.status_code} instead of 400")
            return False
    except Exception as e:
        print_fail(f"Exception on empty message test: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/chat (empty message) - Exception: {str(e)}")
        return False

def test_reports_endpoint():
    """Test POST /api/reports and GET /api/reports"""
    print_test("POST /api/reports - Create civic report")
    
    # Test 1: Create a report
    print_info("Test 1: Creating a civic report")
    try:
        payload = {
            "category": "streetlight",
            "description": "Street light broken near 5th block junction",
            "location": "Koramangala, Bengaluru"
        }
        response = requests.post(f"{BACKEND_URL}/reports", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["ticket", "id", "status"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                # Verify ticket is 5-digit string
                ticket = data["ticket"]
                if len(ticket) == 5 and ticket.isdigit():
                    print_pass(f"Report created with 5-digit ticket: {ticket}")
                else:
                    print_fail(f"Ticket '{ticket}' is not a 5-digit string")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/reports - ticket format incorrect: {ticket}")
                    return False
                
                # Verify status is "Submitted"
                if data["status"] == "Submitted":
                    print_pass("Report status is 'Submitted'")
                else:
                    print_fail(f"Expected status 'Submitted', got '{data['status']}'")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/reports - status is '{data['status']}' not 'Submitted'")
                    return False
                
                test_results["passed"] += 1
                report_id = data["id"]
            else:
                print_fail(f"Response missing fields: {missing_fields}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/reports - missing fields: {missing_fields}")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/reports - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception creating report: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/reports - Exception: {str(e)}")
        return False
    
    # Test 2: Get all reports and verify the created report is in the list
    print_info("\nTest 2: Getting all reports and verifying created report")
    try:
        response = requests.get(f"{BACKEND_URL}/reports", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_pass(f"GET /api/reports returns list with {len(data)} reports")
                
                # Check if our created report is in the list
                found = any(r.get("id") == report_id for r in data)
                if found:
                    print_pass("Created report found in the list")
                    test_results["passed"] += 1
                    return True
                else:
                    print_fail("Created report not found in the list")
                    test_results["failed"] += 1
                    test_results["errors"].append("GET /api/reports - created report not in list")
                    return False
            else:
                print_fail("Response is not a list")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/reports - response is not a list")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/reports - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception getting reports: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/reports - Exception: {str(e)}")
        return False

def test_sos_endpoint():
    """Test POST /api/sos with coordinates and without"""
    print_test("POST /api/sos - Emergency SOS")
    
    # Test 1: SOS with coordinates
    print_info("Test 1: Creating SOS with coordinates")
    try:
        payload = {
            "lat": 12.9352,
            "lng": 77.6245,
            "contact_name": "Mom"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["maps_link", "contact_name", "id", "shared_at"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                # Verify maps_link contains coordinates
                maps_link = data["maps_link"]
                if "12.9352" in maps_link and "77.6245" in maps_link and "google.com/maps" in maps_link:
                    print_pass(f"Maps link contains coordinates: {maps_link}")
                else:
                    print_fail(f"Maps link doesn't contain expected coordinates: {maps_link}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/sos - maps_link incorrect: {maps_link}")
                    return False
                
                # Verify contact_name
                if data["contact_name"] == "Mom":
                    print_pass("Contact name is correct: Mom")
                else:
                    print_fail(f"Expected contact_name 'Mom', got '{data['contact_name']}'")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/sos - contact_name is '{data['contact_name']}' not 'Mom'")
                    return False
                
                test_results["passed"] += 1
            else:
                print_fail(f"Response missing fields: {missing_fields}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos - missing fields: {missing_fields}")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception creating SOS with coordinates: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos (with coords) - Exception: {str(e)}")
        return False
    
    # Test 2: SOS without coordinates (null coords)
    print_info("\nTest 2: Creating SOS with null coordinates")
    try:
        payload = {
            "contact_name": "Mom"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            maps_link = data.get("maps_link", "")
            
            # Should have fallback maps link
            if "google.com/maps" in maps_link:
                print_pass(f"Fallback maps link provided: {maps_link}")
                test_results["passed"] += 1
                return True
            else:
                print_fail(f"No valid fallback maps link: {maps_link}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos (null coords) - invalid fallback maps_link: {maps_link}")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (null coords) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception creating SOS without coordinates: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos (null coords) - Exception: {str(e)}")
        return False

def print_summary():
    """Print test summary"""
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}TEST SUMMARY{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}")
    
    total = test_results["passed"] + test_results["failed"]
    print(f"\nTotal Tests: {total}")
    print(f"{Colors.GREEN}Passed: {test_results['passed']}{Colors.RESET}")
    print(f"{Colors.RED}Failed: {test_results['failed']}{Colors.RESET}")
    
    if test_results["errors"]:
        print(f"\n{Colors.RED}ERRORS:{Colors.RESET}")
        for error in test_results["errors"]:
            print(f"  - {error}")
    
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    return test_results["failed"] == 0

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}Saathi Safety Backend API Test Suite{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Run all tests
    test_root_endpoint()
    test_chat_endpoint()
    test_reports_endpoint()
    test_sos_endpoint()
    
    # Print summary
    success = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
