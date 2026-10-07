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

def test_contacts_endpoint():
    """Test GET /api/contacts, POST /api/contacts, and DELETE /api/contacts/{id}"""
    print_test("Contacts Management - GET, POST, DELETE /api/contacts")
    
    # Test 1: GET /api/contacts - should return seeded contacts
    print_info("Test 1: Getting all contacts (should include seeded Mom and Rahul)")
    try:
        response = requests.get(f"{BACKEND_URL}/contacts", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list):
                print_pass(f"GET /api/contacts returns list with {len(data)} contacts")
                
                # Check for seeded contacts
                contact_names = [c.get("name") for c in data]
                has_mom = "Mom" in contact_names
                has_rahul = "Rahul (Brother)" in contact_names
                
                if has_mom and has_rahul:
                    print_pass("Seeded contacts found: Mom and Rahul (Brother)")
                    test_results["passed"] += 1
                else:
                    print_fail(f"Missing seeded contacts. Found: {contact_names}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/contacts - missing seeded contacts. Found: {contact_names}")
                    return False
                
                # Verify each contact has required fields
                required_fields = ["id", "name", "phone", "created_at"]
                for contact in data:
                    missing = [f for f in required_fields if f not in contact]
                    if missing:
                        print_fail(f"Contact missing fields: {missing}")
                        test_results["failed"] += 1
                        test_results["errors"].append(f"GET /api/contacts - contact missing fields: {missing}")
                        return False
                
                print_pass("All contacts have required fields (id, name, phone, created_at)")
            else:
                print_fail("Response is not a list")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/contacts - response is not a list")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/contacts - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception getting contacts: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/contacts - Exception: {str(e)}")
        return False
    
    # Test 2: POST /api/contacts - create a new contact
    print_info("\nTest 2: Creating a new contact")
    created_contact_id = None
    try:
        payload = {
            "name": "Anita (Friend)",
            "phone": "+91 90000 11111",
            "relation": "Friend"
        }
        response = requests.post(f"{BACKEND_URL}/contacts", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["id", "name", "phone", "relation", "created_at"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if not missing_fields:
                # Verify the data matches what we sent
                if data["name"] == payload["name"] and data["phone"] == payload["phone"] and data["relation"] == payload["relation"]:
                    print_pass(f"Contact created successfully with id: {data['id']}")
                    created_contact_id = data["id"]
                    test_results["passed"] += 1
                else:
                    print_fail("Created contact data doesn't match payload")
                    test_results["failed"] += 1
                    test_results["errors"].append("POST /api/contacts - data mismatch")
                    return False
            else:
                print_fail(f"Response missing fields: {missing_fields}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/contacts - missing fields: {missing_fields}")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/contacts - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception creating contact: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/contacts - Exception: {str(e)}")
        return False
    
    # Test 3: GET /api/contacts again to verify the new contact appears
    print_info("\nTest 3: Verifying new contact appears in GET /api/contacts")
    try:
        response = requests.get(f"{BACKEND_URL}/contacts", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            contact_ids = [c.get("id") for c in data]
            
            if created_contact_id in contact_ids:
                print_pass("New contact found in the list")
                test_results["passed"] += 1
            else:
                print_fail("New contact not found in the list")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/contacts - new contact not in list")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/contacts (verify) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception verifying contact: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/contacts (verify) - Exception: {str(e)}")
        return False
    
    # Test 4: DELETE /api/contacts/{id} - delete the created contact
    print_info(f"\nTest 4: Deleting contact with id: {created_contact_id}")
    try:
        response = requests.delete(f"{BACKEND_URL}/contacts/{created_contact_id}", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("deleted") == True:
                print_pass("Contact deleted successfully")
                test_results["passed"] += 1
            else:
                print_fail("Response doesn't confirm deletion")
                test_results["failed"] += 1
                test_results["errors"].append("DELETE /api/contacts/{id} - deletion not confirmed")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"DELETE /api/contacts/{{id}} - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception deleting contact: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"DELETE /api/contacts/{{id}} - Exception: {str(e)}")
        return False
    
    # Test 5: GET /api/contacts to verify the contact is gone
    print_info("\nTest 5: Verifying deleted contact is gone")
    try:
        response = requests.get(f"{BACKEND_URL}/contacts", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            contact_ids = [c.get("id") for c in data]
            
            if created_contact_id not in contact_ids:
                print_pass("Deleted contact no longer in the list")
                test_results["passed"] += 1
            else:
                print_fail("Deleted contact still in the list")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/contacts - deleted contact still present")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/contacts (verify deletion) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception verifying deletion: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/contacts (verify deletion) - Exception: {str(e)}")
        return False
    
    # Test 6: DELETE with non-existent id - should return 404
    print_info("\nTest 6: Testing DELETE with non-existent contact id")
    try:
        fake_id = "non-existent-id-12345"
        response = requests.delete(f"{BACKEND_URL}/contacts/{fake_id}", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 404:
            print_pass("DELETE with non-existent id correctly returns 404")
            test_results["passed"] += 1
            return True
        else:
            print_fail(f"Expected 404 for non-existent id, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"DELETE /api/contacts/{{non-existent}} - returned {response.status_code} instead of 404")
            return False
    except Exception as e:
        print_fail(f"Exception testing non-existent id: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"DELETE /api/contacts/{{non-existent}} - Exception: {str(e)}")
        return False

def test_sos_endpoint():
    """Test POST /api/sos with new structure (lat, lng, channel, recipients)"""
    print_test("POST /api/sos - Emergency SOS with trusted contacts")
    
    print_info("Testing SOS with coordinates and channel")
    try:
        payload = {
            "lat": 12.9352,
            "lng": 77.6245,
            "channel": "sms"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            required_fields = ["id", "maps_link", "message", "channel", "recipients", "shared_at"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_fail(f"Response missing fields: {missing_fields}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos - missing fields: {missing_fields}")
                return False
            
            # Verify maps_link contains coordinates
            maps_link = data["maps_link"]
            if "12.9352" in maps_link and "77.6245" in maps_link and "google.com/maps" in maps_link:
                print_pass(f"Maps link contains coordinates: {maps_link}")
            else:
                print_fail(f"Maps link doesn't contain expected coordinates: {maps_link}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos - maps_link incorrect: {maps_link}")
                return False
            
            # Verify message is non-empty and contains maps_link and "SOS"
            message = data["message"]
            if message and maps_link in message and "SOS" in message:
                print_pass("Message is non-empty and contains maps_link and 'SOS'")
            else:
                print_fail(f"Message doesn't meet requirements: {message}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos - message invalid: {message}")
                return False
            
            # Verify channel
            if data["channel"] == "sms":
                print_pass("Channel is 'sms'")
            else:
                print_fail(f"Expected channel 'sms', got '{data['channel']}'")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos - channel is '{data['channel']}' not 'sms'")
                return False
            
            # Verify recipients is a non-empty list
            recipients = data["recipients"]
            if isinstance(recipients, list) and len(recipients) > 0:
                print_pass(f"Recipients is a non-empty list with {len(recipients)} entries")
                
                # Verify each recipient has name, phone, and status "sent"
                for i, recipient in enumerate(recipients):
                    required_recipient_fields = ["name", "phone", "status"]
                    missing_recipient_fields = [f for f in required_recipient_fields if f not in recipient]
                    
                    if missing_recipient_fields:
                        print_fail(f"Recipient {i} missing fields: {missing_recipient_fields}")
                        test_results["failed"] += 1
                        test_results["errors"].append(f"POST /api/sos - recipient {i} missing fields: {missing_recipient_fields}")
                        return False
                    
                    if recipient["status"] != "sent":
                        print_fail(f"Recipient {i} status is '{recipient['status']}', expected 'sent'")
                        test_results["failed"] += 1
                        test_results["errors"].append(f"POST /api/sos - recipient {i} status not 'sent'")
                        return False
                
                print_pass("All recipients have name, phone, and status 'sent'")
                test_results["passed"] += 1
                return True
            else:
                print_fail("Recipients is empty or not a list")
                test_results["failed"] += 1
                test_results["errors"].append("POST /api/sos - recipients is empty or not a list")
                return False
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception creating SOS: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos - Exception: {str(e)}")
        return False

def test_spatial_endpoint():
    """Test GET /api/spatial/building-summary - new spatial endpoint"""
    print_test("GET /api/spatial/building-summary - Spatial building data")
    
    # Test 1: Query with specific coordinates near Vydehi Hospital
    print_info("Test 1: Query building at lat=12.9754, lng=77.6096 with user at lat=12.9718, lng=77.6071")
    test1_response = None
    try:
        params = {
            "lat": 12.9754,
            "lng": 77.6096,
            "user_lat": 12.9718,
            "user_lng": 77.6071
        }
        response = requests.get(f"{BACKEND_URL}/spatial/building-summary", params=params, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            test1_response = data  # Save for determinism test
            
            # Verify required fields
            required_fields = ["name", "building_type", "levels", "height_m", "ward", "address", 
                             "distance_from_user_m", "zone_status", "nearest"]
            missing_fields = [f for f in required_fields if f not in data]
            
            if missing_fields:
                print_fail(f"Response missing fields: {missing_fields}")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary - missing fields: {missing_fields}")
                return False
            
            # Verify field types
            if not isinstance(data["name"], str):
                print_fail(f"name should be string, got {type(data['name'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - name not string")
                return False
            
            if not isinstance(data["building_type"], str):
                print_fail(f"building_type should be string, got {type(data['building_type'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - building_type not string")
                return False
            
            if not isinstance(data["levels"], int):
                print_fail(f"levels should be int, got {type(data['levels'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - levels not int")
                return False
            
            if not isinstance(data["height_m"], (int, float)):
                print_fail(f"height_m should be number, got {type(data['height_m'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - height_m not number")
                return False
            
            if not isinstance(data["ward"], str):
                print_fail(f"ward should be string, got {type(data['ward'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - ward not string")
                return False
            
            if not isinstance(data["address"], str):
                print_fail(f"address should be string, got {type(data['address'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - address not string")
                return False
            
            if not isinstance(data["distance_from_user_m"], int):
                print_fail(f"distance_from_user_m should be int, got {type(data['distance_from_user_m'])}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - distance_from_user_m not int")
                return False
            
            # Verify distance is reasonable (should be a few hundred meters)
            distance = data["distance_from_user_m"]
            if 200 <= distance <= 800:
                print_pass(f"distance_from_user_m is reasonable: {distance}m")
            else:
                print_fail(f"distance_from_user_m seems unreasonable: {distance}m (expected 200-800m)")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary - distance {distance}m seems wrong")
                return False
            
            # Verify zone_status is one of the expected values
            zone_status = data["zone_status"]
            valid_zones = ["Normal", "High Footfall", "Caution"]
            if zone_status in valid_zones:
                print_pass(f"zone_status is valid: {zone_status}")
            else:
                print_fail(f"zone_status '{zone_status}' not in {valid_zones}")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary - invalid zone_status: {zone_status}")
                return False
            
            # Verify nearest object structure
            nearest = data["nearest"]
            if not isinstance(nearest, dict):
                print_fail(f"nearest should be dict, got {type(nearest)}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary - nearest not dict")
                return False
            
            required_nearest = ["hospital", "police", "pharmacy"]
            missing_nearest = [f for f in required_nearest if f not in nearest]
            if missing_nearest:
                print_fail(f"nearest missing keys: {missing_nearest}")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary - nearest missing: {missing_nearest}")
                return False
            
            # Verify each nearest facility has name and distance_m
            for facility_type in required_nearest:
                facility = nearest[facility_type]
                if not isinstance(facility, dict):
                    print_fail(f"nearest.{facility_type} should be dict, got {type(facility)}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/spatial/building-summary - nearest.{facility_type} not dict")
                    return False
                
                if "name" not in facility or not isinstance(facility["name"], str):
                    print_fail(f"nearest.{facility_type}.name missing or not string")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/spatial/building-summary - nearest.{facility_type}.name invalid")
                    return False
                
                if "distance_m" not in facility or not isinstance(facility["distance_m"], int):
                    print_fail(f"nearest.{facility_type}.distance_m missing or not int")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/spatial/building-summary - nearest.{facility_type}.distance_m invalid")
                    return False
                
                if facility["distance_m"] < 0:
                    print_fail(f"nearest.{facility_type}.distance_m should be non-negative, got {facility['distance_m']}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/spatial/building-summary - nearest.{facility_type}.distance_m negative")
                    return False
            
            print_pass("All nearest facilities have valid name (string) and distance_m (non-negative int)")
            print_info(f"Building: {data['building_type']}, {data['levels']} levels, {data['height_m']}m")
            print_info(f"Nearest hospital: {nearest['hospital']['name']} ({nearest['hospital']['distance_m']}m)")
            print_info(f"Nearest police: {nearest['police']['name']} ({nearest['police']['distance_m']}m)")
            print_info(f"Nearest pharmacy: {nearest['pharmacy']['name']} ({nearest['pharmacy']['distance_m']}m)")
            
            test_results["passed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/spatial/building-summary (test1) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception in test 1: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/spatial/building-summary (test1) - Exception: {str(e)}")
        return False
    
    # Test 2: Query near known incident (should be "Caution" zone)
    print_info("\nTest 2: Query building at lat=12.9690, lng=77.6150 (near incident, omit user params)")
    try:
        params = {
            "lat": 12.9690,
            "lng": 77.6150
        }
        response = requests.get(f"{BACKEND_URL}/spatial/building-summary", params=params, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Verify zone_status is "Caution" (within 250m of incident at 12.9690, 77.6150)
            zone_status = data["zone_status"]
            if zone_status == "Caution":
                print_pass(f"zone_status is 'Caution' as expected (near incident)")
            else:
                print_fail(f"Expected zone_status 'Caution', got '{zone_status}'")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary (test2) - zone_status not 'Caution': {zone_status}")
                return False
            
            # Verify nearest facilities have reasonable distances
            nearest = data["nearest"]
            for facility_type in ["hospital", "police", "pharmacy"]:
                distance = nearest[facility_type]["distance_m"]
                if distance >= 0:
                    print_pass(f"nearest.{facility_type}.distance_m is non-negative: {distance}m")
                else:
                    print_fail(f"nearest.{facility_type}.distance_m should be non-negative, got {distance}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"GET /api/spatial/building-summary (test2) - nearest.{facility_type}.distance_m negative")
                    return False
            
            test_results["passed"] += 1
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/spatial/building-summary (test2) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception in test 2: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/spatial/building-summary (test2) - Exception: {str(e)}")
        return False
    
    # Test 3: Determinism check - call Test 1 again and verify building_type and levels are identical
    print_info("\nTest 3: Determinism check - calling Test 1 again to verify consistent results")
    try:
        params = {
            "lat": 12.9754,
            "lng": 77.6096,
            "user_lat": 12.9718,
            "user_lng": 77.6071
        }
        response = requests.get(f"{BACKEND_URL}/spatial/building-summary", params=params, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Compare building_type and levels with first call
            if test1_response is None:
                print_fail("Test 1 response not available for comparison")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/spatial/building-summary (test3) - test1 response missing")
                return False
            
            if data["building_type"] == test1_response["building_type"]:
                print_pass(f"building_type is deterministic: {data['building_type']}")
            else:
                print_fail(f"building_type changed: {test1_response['building_type']} -> {data['building_type']}")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary (test3) - building_type not deterministic")
                return False
            
            if data["levels"] == test1_response["levels"]:
                print_pass(f"levels is deterministic: {data['levels']}")
            else:
                print_fail(f"levels changed: {test1_response['levels']} -> {data['levels']}")
                test_results["failed"] += 1
                test_results["errors"].append(f"GET /api/spatial/building-summary (test3) - levels not deterministic")
                return False
            
            test_results["passed"] += 1
            return True
        else:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/spatial/building-summary (test3) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception in test 3: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/spatial/building-summary (test3) - Exception: {str(e)}")
        return False

def test_health_check():
    """Quick health check for previously working endpoints"""
    print_test("Health Check - Previously working endpoints")
    
    # Test 1: POST /api/sos
    print_info("Test 1: Quick check POST /api/sos")
    try:
        payload = {
            "lat": 12.97,
            "lng": 77.60,
            "channel": "sms"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if "recipients" in data and isinstance(data["recipients"], list):
                print_pass(f"POST /api/sos working - returns recipients list with {len(data['recipients'])} contacts")
                test_results["passed"] += 1
            else:
                print_fail("POST /api/sos response missing recipients list")
                test_results["failed"] += 1
                test_results["errors"].append("POST /api/sos (health check) - missing recipients")
                return False
        else:
            print_fail(f"POST /api/sos returned {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (health check) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception checking POST /api/sos: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos (health check) - Exception: {str(e)}")
        return False
    
    # Test 2: GET /api/contacts
    print_info("\nTest 2: Quick check GET /api/contacts")
    try:
        response = requests.get(f"{BACKEND_URL}/contacts", timeout=10)
        print_info(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) >= 2:
                contact_names = [c.get("name") for c in data]
                print_pass(f"GET /api/contacts working - returns {len(data)} contacts: {contact_names}")
                test_results["passed"] += 1
                return True
            else:
                print_fail(f"GET /api/contacts returned unexpected data: {data}")
                test_results["failed"] += 1
                test_results["errors"].append("GET /api/contacts (health check) - unexpected data")
                return False
        else:
            print_fail(f"GET /api/contacts returned {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"GET /api/contacts (health check) - returned {response.status_code}")
            return False
    except Exception as e:
        print_fail(f"Exception checking GET /api/contacts: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"GET /api/contacts (health check) - Exception: {str(e)}")
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

def test_sos_updated_endpoint():
    """Test UPDATED POST /api/sos with new fields: battery, network, landmark, evidence_id, nearest_police"""
    print_test("POST /api/sos - UPDATED endpoint with new fields")
    
    # Test 1: Full body with all new fields
    print_info("Test 1: POST /api/sos with full body (battery, network, landmark, evidence_id)")
    try:
        payload = {
            "lat": 12.9718,
            "lng": 77.6071,
            "channel": "sms",
            "battery": 64,
            "network": "4G",
            "landmark": "Brigade Road, Central Bengaluru",
            "evidence_id": "ev-test-123"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - returned {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify all required fields
        required_fields = ["id", "maps_link", "message", "channel", "recipients", "shared_at", "nearest_police", "battery", "network", "landmark"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_fail(f"Response missing fields: {missing_fields}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - missing fields: {missing_fields}")
            return False
        
        print_pass("All required fields present in response")
        
        # Verify maps_link contains coordinates
        maps_link = data["maps_link"]
        if "12.9718" in maps_link and "77.6071" in maps_link and "google.com/maps" in maps_link:
            print_pass(f"maps_link contains coordinates: {maps_link}")
        else:
            print_fail(f"maps_link doesn't contain expected coordinates: {maps_link}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - maps_link incorrect: {maps_link}")
            return False
        
        # Verify message is non-empty and contains "SOS"
        message = data["message"]
        if message and "SOS" in message:
            print_pass(f"message is non-empty and contains 'SOS': {message[:100]}...")
        else:
            print_fail(f"message doesn't meet requirements: {message}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - message invalid: {message}")
            return False
        
        # Verify channel
        if data["channel"] == "sms":
            print_pass("channel is 'sms'")
        else:
            print_fail(f"Expected channel 'sms', got '{data['channel']}'")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - channel is '{data['channel']}' not 'sms'")
            return False
        
        # Verify recipients is a non-empty list
        recipients = data["recipients"]
        if isinstance(recipients, list) and len(recipients) > 0:
            print_pass(f"recipients is a non-empty list with {len(recipients)} entries")
            
            # Verify each recipient has name, phone, and status "sent"
            for i, recipient in enumerate(recipients):
                required_recipient_fields = ["name", "phone", "status"]
                missing_recipient_fields = [f for f in required_recipient_fields if f not in recipient]
                
                if missing_recipient_fields:
                    print_fail(f"Recipient {i} missing fields: {missing_recipient_fields}")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/sos (full body) - recipient {i} missing fields: {missing_recipient_fields}")
                    return False
                
                if recipient["status"] != "sent":
                    print_fail(f"Recipient {i} status is '{recipient['status']}', expected 'sent'")
                    test_results["failed"] += 1
                    test_results["errors"].append(f"POST /api/sos (full body) - recipient {i} status not 'sent'")
                    return False
            
            print_pass(f"All recipients have name, phone, and status 'sent': {[r['name'] for r in recipients]}")
        else:
            print_fail("recipients is empty or not a list")
            test_results["failed"] += 1
            test_results["errors"].append("POST /api/sos (full body) - recipients is empty or not a list")
            return False
        
        # Verify nearest_police object
        nearest_police = data["nearest_police"]
        if nearest_police is None:
            print_fail("nearest_police is null (should be an object)")
            test_results["failed"] += 1
            test_results["errors"].append("POST /api/sos (full body) - nearest_police is null")
            return False
        
        if not isinstance(nearest_police, dict):
            print_fail(f"nearest_police should be dict, got {type(nearest_police)}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - nearest_police not dict")
            return False
        
        # Verify nearest_police has name, distance_m, phone
        required_police_fields = ["name", "distance_m", "phone"]
        missing_police_fields = [f for f in required_police_fields if f not in nearest_police]
        
        if missing_police_fields:
            print_fail(f"nearest_police missing fields: {missing_police_fields}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - nearest_police missing fields: {missing_police_fields}")
            return False
        
        # Verify nearest_police.name is one of the expected stations
        police_name = nearest_police["name"]
        expected_stations = ["Ashok Nagar Police Station", "Cubbon Park Police Station"]
        if police_name in expected_stations:
            print_pass(f"nearest_police.name is one of expected stations: {police_name}")
        else:
            print_fail(f"nearest_police.name '{police_name}' not in {expected_stations}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - nearest_police.name unexpected: {police_name}")
            return False
        
        # Verify distance_m is a reasonable positive integer
        distance_m = nearest_police["distance_m"]
        if isinstance(distance_m, int) and 100 <= distance_m <= 2000:
            print_pass(f"nearest_police.distance_m is reasonable: {distance_m}m")
        else:
            print_fail(f"nearest_police.distance_m should be int between 100-2000m, got {distance_m} ({type(distance_m)})")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - nearest_police.distance_m invalid: {distance_m}")
            return False
        
        # Verify phone
        if nearest_police["phone"] == "100":
            print_pass(f"nearest_police.phone is '100'")
        else:
            print_fail(f"nearest_police.phone should be '100', got '{nearest_police['phone']}'")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - nearest_police.phone not '100'")
            return False
        
        # Verify optional fields are echoed back correctly
        if data["battery"] == 64:
            print_pass("battery echoed back correctly: 64")
        else:
            print_fail(f"battery should be 64, got {data['battery']}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - battery not echoed: {data['battery']}")
            return False
        
        if data["network"] == "4G":
            print_pass("network echoed back correctly: '4G'")
        else:
            print_fail(f"network should be '4G', got '{data['network']}'")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - network not echoed: {data['network']}")
            return False
        
        if data["landmark"] == "Brigade Road, Central Bengaluru":
            print_pass("landmark echoed back correctly")
        else:
            print_fail(f"landmark should be 'Brigade Road, Central Bengaluru', got '{data['landmark']}'")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (full body) - landmark not echoed: {data['landmark']}")
            return False
        
        print_info(f"✓ Test 1 PASSED - Full body test successful")
        print_info(f"  Nearest police: {police_name} at {distance_m}m")
        test_results["passed"] += 1
        
    except Exception as e:
        print_fail(f"Exception in test 1: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos (full body) - Exception: {str(e)}")
        return False
    
    # Test 2: Backward compatibility - minimal body without optional fields
    print_info("\nTest 2: POST /api/sos with minimal body (backward compatibility)")
    try:
        payload = {
            "lat": 12.95,
            "lng": 77.62,
            "channel": "sms"
        }
        response = requests.post(f"{BACKEND_URL}/sos", json=payload, timeout=10)
        print_info(f"Status Code: {response.status_code}")
        print_info(f"Response: {response.text}")
        
        if response.status_code != 200:
            print_fail(f"Expected 200, got {response.status_code}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - returned {response.status_code}")
            return False
        
        data = response.json()
        
        # Verify required fields are present
        required_fields = ["id", "maps_link", "message", "channel", "recipients", "shared_at", "nearest_police"]
        missing_fields = [f for f in required_fields if f not in data]
        
        if missing_fields:
            print_fail(f"Response missing fields: {missing_fields}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - missing fields: {missing_fields}")
            return False
        
        print_pass("All required fields present in response")
        
        # Verify recipients is still populated
        recipients = data["recipients"]
        if isinstance(recipients, list) and len(recipients) > 0:
            print_pass(f"recipients is a non-empty list with {len(recipients)} entries")
        else:
            print_fail("recipients is empty or not a list")
            test_results["failed"] += 1
            test_results["errors"].append("POST /api/sos (minimal body) - recipients is empty or not a list")
            return False
        
        # Verify nearest_police is still calculated
        nearest_police = data["nearest_police"]
        if nearest_police is not None and isinstance(nearest_police, dict):
            if "name" in nearest_police and "distance_m" in nearest_police and "phone" in nearest_police:
                print_pass(f"nearest_police is present: {nearest_police['name']} at {nearest_police['distance_m']}m")
            else:
                print_fail(f"nearest_police missing required fields: {nearest_police}")
                test_results["failed"] += 1
                test_results["errors"].append(f"POST /api/sos (minimal body) - nearest_police incomplete: {nearest_police}")
                return False
        else:
            print_fail(f"nearest_police should be an object, got {nearest_police}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - nearest_police invalid: {nearest_police}")
            return False
        
        # Verify optional fields are null when not provided
        if data.get("battery") is None:
            print_pass("battery is null (not provided)")
        else:
            print_fail(f"battery should be null, got {data.get('battery')}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - battery should be null: {data.get('battery')}")
            return False
        
        if data.get("network") is None:
            print_pass("network is null (not provided)")
        else:
            print_fail(f"network should be null, got {data.get('network')}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - network should be null: {data.get('network')}")
            return False
        
        if data.get("landmark") is None:
            print_pass("landmark is null (not provided)")
        else:
            print_fail(f"landmark should be null, got {data.get('landmark')}")
            test_results["failed"] += 1
            test_results["errors"].append(f"POST /api/sos (minimal body) - landmark should be null: {data.get('landmark')}")
            return False
        
        print_info(f"✓ Test 2 PASSED - Backward compatibility confirmed")
        print_info(f"  Nearest police: {nearest_police['name']} at {nearest_police['distance_m']}m")
        test_results["passed"] += 1
        return True
        
    except Exception as e:
        print_fail(f"Exception in test 2: {str(e)}")
        test_results["failed"] += 1
        test_results["errors"].append(f"POST /api/sos (minimal body) - Exception: {str(e)}")
        return False

def main():
    print(f"\n{Colors.BLUE}{'='*80}{Colors.RESET}")
    print(f"{Colors.BLUE}Saathi Safety Backend API Test Suite{Colors.RESET}")
    print(f"{Colors.BLUE}Backend URL: {BACKEND_URL}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*80}{Colors.RESET}\n")
    
    # Run UPDATED SOS endpoint tests
    test_sos_updated_endpoint()
    
    # Print summary
    success = print_summary()
    
    # Exit with appropriate code
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()
