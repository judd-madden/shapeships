#!/bin/bash

# Server Endpoint Testing Script
# Tests all refactored endpoints to verify functionality

echo "🧪 Testing Refactored Server Endpoints"
echo "========================================"
echo ""

# Base URL (update for production)
BASE_URL="http://localhost:54321/functions/v1/make-server-825e19ab"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function
test_endpoint() {
    local name=$1
    local url=$2
    local method=${3:-GET}
    local data=$4
    local headers=$5
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$url" $headers)
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$url" -H "Content-Type: application/json" $headers -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n 1)
    body=$(echo "$response" | head -n -1)
    
    if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 400 ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $http_code)"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (HTTP $http_code)"
        echo "  Response: $body"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "1️⃣  Testing Health Check"
echo "------------------------"
test_endpoint "Health" "$BASE_URL/health"
echo ""

echo "2️⃣  Testing Session Creation"
echo "----------------------------"
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/session/start")
SESSION_TOKEN=$(echo $SESSION_RESPONSE | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_TOKEN" ]; then
    echo -e "${RED}❌ FAIL${NC} - Could not create session"
    ((TESTS_FAILED++))
else
    echo -e "${GREEN}✅ PASS${NC} - Session created"
    echo "  Token: ${SESSION_TOKEN:0:20}..."
    ((TESTS_PASSED++))
fi
echo ""

echo "3️⃣  Testing Game Creation"
echo "-------------------------"
if [ ! -z "$SESSION_TOKEN" ]; then
    GAME_RESPONSE=$(curl -s -X POST "$BASE_URL/create-game" \
        -H "X-Session-Token: $SESSION_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"playerName":"TestPlayer1"}')
    
    GAME_ID=$(echo $GAME_RESPONSE | grep -o '"gameId":"[^"]*"' | cut -d'"' -f4)
    
    if [ -z "$GAME_ID" ]; then
        echo -e "${RED}❌ FAIL${NC} - Could not create game"
        echo "  Response: $GAME_RESPONSE"
        ((TESTS_FAILED++))
    else
        echo -e "${GREEN}✅ PASS${NC} - Game created"
        echo "  Game ID: $GAME_ID"
        ((TESTS_PASSED++))
    fi
else
    echo -e "${YELLOW}⏭️  SKIP${NC} - No session token"
fi
echo ""

echo "4️⃣  Testing Game State Fetch"
echo "----------------------------"
if [ ! -z "$GAME_ID" ]; then
    test_endpoint "Game State" "$BASE_URL/game-state/$GAME_ID" "GET" "" "-H 'X-Session-Token: $SESSION_TOKEN'"
else
    echo -e "${YELLOW}⏭️  SKIP${NC} - No game ID"
fi
echo ""

echo "5️⃣  Testing Game Join"
echo "---------------------"
if [ ! -z "$GAME_ID" ]; then
    # Create second session
    SESSION2_RESPONSE=$(curl -s -X POST "$BASE_URL/session/start")
    SESSION2_TOKEN=$(echo $SESSION2_RESPONSE | grep -o '"sessionToken":"[^"]*"' | cut -d'"' -f4)
    
    if [ ! -z "$SESSION2_TOKEN" ]; then
        test_endpoint "Join Game" "$BASE_URL/join-game/$GAME_ID" "POST" '{"playerName":"TestPlayer2"}' "-H 'X-Session-Token: $SESSION2_TOKEN'"
    else
        echo -e "${YELLOW}⏭️  SKIP${NC} - Could not create second session"
    fi
else
    echo -e "${YELLOW}⏭️  SKIP${NC} - No game ID"
fi
echo ""

echo "6️⃣  Testing Game Action (Select Species)"
echo "----------------------------------------"
if [ ! -z "$GAME_ID" ] && [ ! -z "$SESSION_TOKEN" ]; then
    test_endpoint "Select Species" "$BASE_URL/send-action/$GAME_ID" "POST" \
        '{"actionType":"select_species","content":{"species":"human"}}' \
        "-H 'X-Session-Token: $SESSION_TOKEN'"
else
    echo -e "${YELLOW}⏭️  SKIP${NC} - Missing prerequisites"
fi
echo ""

echo "7️⃣  Testing System Diagnostics"
echo "------------------------------"
test_endpoint "System Test" "$BASE_URL/system-test"
echo ""

echo "8️⃣  Testing Intent Endpoint (Should return 501)"
echo "-----------------------------------------------"
if [ ! -z "$GAME_ID" ] && [ ! -z "$SESSION_TOKEN" ]; then
    INTENT_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/intent" \
        -H "X-Session-Token: $SESSION_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"intent":{"intentId":"test","gameId":"'$GAME_ID'","playerId":"test","type":"ACTION","phase":"build","actionType":"test","data":{}}}')
    
    INTENT_CODE=$(echo "$INTENT_RESPONSE" | tail -n 1)
    
    if [ "$INTENT_CODE" = "501" ]; then
        echo -e "${GREEN}✅ PASS${NC} - Intent returns correct 501 Not Implemented"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC} - Intent returned HTTP $INTENT_CODE (expected 501)"
        ((TESTS_FAILED++))
    fi
else
    echo -e "${YELLOW}⏭️  SKIP${NC} - Missing prerequisites"
fi
echo ""

echo "========================================"
echo "📊 Test Results Summary"
echo "========================================"
echo -e "Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Failed: ${RED}$TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All tests passed! Server is ready for deployment.${NC}"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Review errors above.${NC}"
    exit 1
fi
