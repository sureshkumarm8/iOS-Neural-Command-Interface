#!/bin/bash
# iOS Text Input (Wireless)
# Usage:
#   1) Auto mode (single device): ./send_to_ios_wireless.sh "text to send"
#   2) Provide host:              ./send_to_ios_wireless.sh <device_ip_or_mdns> "text" [UDID]
#   3) Provide UDID only:         ./send_to_ios_wireless.sh "text" <UDID>
#   4) Named device from config:  ./send_to_ios_wireless.sh -d <name> "text"
# Example: ./send_to_ios_wireless.sh -d myiphone "Hello wireless"
# Auto-starts WDA if not reachable (requires paired wireless device via Xcode).
# devices.conf format: name,host,udid OR name,udid,host (auto-detected). Examples: myiphone,10.0.0.12,00008110-AAAA... or myiphone,00008110-AAAA...,10.0.0.12

WDA_PORT=8100
ARG1="$1"
ARG2="$2"
ARG3="$3"

DEVICE_HOST=""
TEXT=""
UDID=""
DEVICE_NAME_REQUEST=""
CONFIG_FILE="$(dirname "$0")/devices.conf"

# Text history variables
HISTORY_FILE="$(dirname "$0")/.ios_text_history"
HISTORY_MAX=50
declare -a TEXT_HISTORY
HISTORY_INDEX=-1
CURRENT_INPUT=""

# Parameter interpretation
# Cases:
# 1 arg: text only -> auto detect device & host
# 2 args: host + text OR text + UDID (if second length > 30)
# 3 args: host + text + UDID
if [ -z "$ARG1" ]; then
  CONFIG_FILE="$(dirname "$0")/devices.conf"
  if [ ! -f "$CONFIG_FILE" ]; then echo "❌ No devices.conf found (expected $CONFIG_FILE)"; exit 1; fi
  echo "📱 Available devices:"; i=0
  while IFS=',' read -r name f2 f3 rest; do
    [[ "$name" =~ ^# || -z "$name" ]] && continue
    IP_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
    host=""; udid=""
    if [[ "$f2" =~ $IP_REGEX ]]; then host="$f2"; udid="$f3"; elif [[ "$f3" =~ $IP_REGEX ]]; then udid="$f2"; host="$f3"; else host="$f2"; udid="$f3"; fi
    i=$((i+1))
    printf "  %2d) %-15s %s %s\n" "$i" "$name" "$udid" "$host"
    DEVICE_NAMES[$i]="$name"
  done < "$CONFIG_FILE"
  if [ $i -eq 0 ]; then echo "❌ No devices listed in $CONFIG_FILE"; exit 1; fi
  echo "Enter number or name (q to quit): "
  read -r SELECTION
  if [[ "$SELECTION" == "q" || "$SELECTION" == "quit" ]]; then echo "👋 Aborted"; exit 0; fi
  if [[ "$SELECTION" =~ ^[0-9]+$ ]]; then
    if [ -z "${DEVICE_NAMES[$SELECTION]}" ]; then echo "❌ Invalid selection"; exit 1; fi
    DEVICE_NAME_REQUEST="${DEVICE_NAMES[$SELECTION]}"
  else
    DEVICE_NAME_REQUEST="$SELECTION"
  fi
  # Lookup chosen device
  MATCH_LINE=$(grep -i "^$DEVICE_NAME_REQUEST," "$CONFIG_FILE" | head -1)
  if [ -z "$MATCH_LINE" ]; then echo "❌ Device '$DEVICE_NAME_REQUEST' not found"; exit 1; fi
  IFS=',' read -r _ f2 f3 _ <<<"$MATCH_LINE"; unset IFS
  IP_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
  if [[ "$f2" =~ $IP_REGEX ]]; then DEVICE_HOST="$f2"; UDID="$f3"; elif [[ "$f3" =~ $IP_REGEX ]]; then UDID="$f2"; DEVICE_HOST="$f3"; else DEVICE_HOST="$f2"; UDID="$f3"; fi
  TEXT="" # blank initial text
  echo "✅ Selected device: $DEVICE_NAME_REQUEST ($DEVICE_HOST)"
  # Proceed without normal arg parsing
fi

# Handle -d <name>
if [ "$ARG1" = "-d" ]; then
  DEVICE_NAME_REQUEST="$ARG2"; TEXT="$ARG3"
  # Allow missing text when using -d (blank initial text)
  if [ -z "$DEVICE_NAME_REQUEST" ]; then
    echo "❌ Usage: $0 -d <name> [text]"; exit 1
  fi
  if [ -f "$CONFIG_FILE" ]; then
    # Find line starting with name,
    IFS=','
    while IFS=',' read -r name f2 f3 rest; do
      if [ "$name" = "$DEVICE_NAME_REQUEST" ]; then
        IP_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
        if [[ "$f2" =~ $IP_REGEX ]]; then DEVICE_HOST="$f2"; UDID="$f3"; elif [[ "$f3" =~ $IP_REGEX ]]; then UDID="$f2"; DEVICE_HOST="$f3"; else DEVICE_HOST="$f2"; UDID="$f3"; fi
        break
      fi
    done < "$CONFIG_FILE"
    unset IFS
    if [ -z "$DEVICE_HOST" ]; then
      echo "❌ Device name '$DEVICE_NAME_REQUEST' not found in $CONFIG_FILE"; exit 1
    fi
  else
    echo "❌ Config file not found: $CONFIG_FILE"; exit 1
  fi
elif [ -n "$ARG1" ] && [ -z "$ARG2" ]; then
  # Single arg -> text auto mode
  TEXT="$ARG1"
elif [ -n "$ARG1" ] && [ -n "$ARG2" ] && [ -z "$ARG3" ]; then
  IP_OR_MDNS_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
  if [ ${#ARG2} -gt 30 ] && [[ "$ARG2" == *-* ]]; then
    # Treat ARG2 as UDID
    TEXT="$ARG1"; UDID="$ARG2"
  elif [[ "$ARG1" =~ $IP_OR_MDNS_REGEX || "$ARG1" == *.local ]]; then
    DEVICE_HOST="$ARG1"; TEXT="$ARG2"
  elif [[ "$ARG2" =~ $IP_OR_MDNS_REGEX || "$ARG2" == *.local ]]; then
    DEVICE_HOST="$ARG2"; TEXT="$ARG1"
  else
    DEVICE_HOST="$ARG1"; TEXT="$ARG2"
  fi
elif [ -n "$ARG1" ] && [ -n "$ARG2" ] && [ -n "$ARG3" ]; then
  DEVICE_HOST="$ARG1"; TEXT="$ARG2"; UDID="$ARG3"
fi

# Auto-detect UDID if not provided
# Try parsing DerivedData for wireless devices (Xcode stores device logs)
DERIVED_DATA="$HOME/Library/Developer/Xcode/DerivedData"
LOG_HINT=""
if [ -z "$UDID" ] && [ -d "$DERIVED_DATA" ]; then
  # Look for recent WebDriverAgent logs containing 'Test Case' lines with a device identifier
  LOG_HINT=$(grep -RhoE "[A-F0-9]{8}-[A-F0-9]{16}" "$DERIVED_DATA"/Logs/Test 2>/dev/null | head -1)
  if [[ "$LOG_HINT" =~ ^[A-F0-9]{8}-[A-F0-9]{16}$ ]]; then
    UDID="$LOG_HINT"
  fi
fi
if [ -z "$UDID" ]; then
  UDID=$(xcrun xctrace list devices 2>/dev/null | grep -E "\(.*\)" | grep -i "iphone" | head -1 | sed -E 's/.*\(([A-F0-9\-]+)\).*/\1/' )
fi

if [ -z "$UDID" ]; then
  echo "❌ Could not detect any paired devices (xcrun xctrace). Provide UDID manually."
  exit 1
fi

# Auto-derive host if not provided
if [ -z "$DEVICE_HOST" ]; then
  DEVICE_NAME=$(xcrun xctrace list devices 2>/dev/null | grep "$UDID" | sed -E 's/\s*([^\(]+)\(.*/\1/' | sed 's/[[:space:]]*$//')
  HOST_CANDIDATES=()
  if [ -n "$DEVICE_NAME" ]; then
    n1=$(echo "$DEVICE_NAME" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
    n2=$(echo "$DEVICE_NAME" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
    HOST_CANDIDATES+=("$n1.local" "$n2.local")
  fi
  HOST_CANDIDATES+=("$UDID.local")
  for h in "${HOST_CANDIDATES[@]}"; do
    if curl -s -m 2 "http://$h:$WDA_PORT/status" >/dev/null 2>&1; then DEVICE_HOST="$h"; break; fi
  done
fi

if [ -z "$DEVICE_HOST" ]; then
  echo "ℹ️ Unable to resolve device host via mDNS. Attempting pairing & log hints, then subnet scan..."
  # Attempt to parse network logs from lockdown cache (libimobiledevice)
  LOCK_DIR="$HOME/Library/Lockdown"
  if [ -d "$LOCK_DIR" ]; then
    POSSIBLE_IP=$(grep -RhoE '"WiFiAddress" = "([0-9]{1,3}\.){3}[0-9]{1,3}"' "$LOCK_DIR" 2>/dev/null | head -1 | sed -E 's/.*"([0-9]{1,3}(\.[0-9]{1,3}){3})".*/\1/')
    if [[ "$POSSIBLE_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
      DEVICE_HOST="$POSSIBLE_IP"; echo "→ Lockdown hint IP: $DEVICE_HOST"
    fi
  fi
  LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  if [[ "$LOCAL_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
    NET_PREFIX=${LOCAL_IP%.*}
    for last in $(seq 1 254); do
      TARGET="${NET_PREFIX}.${last}"
      STATUS_URL_CAND="http://${TARGET}:${WDA_PORT}/status"
      if curl -s -m 0.4 "$STATUS_URL_CAND" | grep -q '"state"'; then
        DEVICE_HOST="$TARGET"
        echo "✅ Found WDA at $DEVICE_HOST"
        break
      fi
    done
  fi
  if [ -z "$DEVICE_HOST" ]; then
    echo "ℹ️ Subnet scan did not find WDA. Trying WiFiAddress via ideviceinfo..."
    WIFI_IP=$(ideviceinfo -u "$UDID" -k WiFiAddress 2>/dev/null)
    if [[ "$WIFI_IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
      DEVICE_HOST="$WIFI_IP"
      echo "→ Falling back to WiFiAddress: $DEVICE_HOST"
    fi
  fi
fi

# Allow blank initial text (skip send)
# if [ -z "$TEXT" ]; then echo "❌ Missing text argument."; exit 1; fi

if [ -z "$DEVICE_HOST" ]; then
  echo "❌ Could not determine device host/IP. Provide explicitly as first argument."; exit 1
fi

cleanup() {
    echo ""; echo "→ Cleaning up (this instance)..."
    # Close WebDriver session gracefully
    if [ -n "$SESSION" ]; then
        echo "→ Closing WebDriver session: ${SESSION:0:8}"
        curl -s -X DELETE "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION" >/dev/null 2>&1 || true
    fi
    # DON'T kill WDA process for wireless connections - let it keep running
    # This prevents Xcode from disconnecting the wireless pairing
    if [ -n "$WDA_PID" ] && ps -p $WDA_PID >/dev/null 2>&1; then
        echo "→ Leaving WDA process running (PID: $WDA_PID) to maintain wireless connection"
        echo "  Use 'pkill -f WebDriverAgentRunner' to manually stop WDA if needed"
    fi
    # Clean up temp files only
    rm -f /tmp/wda_output.log 2>/dev/null
    echo "✅ Cleanup complete - wireless connection preserved"
    exit 0
}
trap cleanup INT TERM

STATUS_URL="http://$DEVICE_HOST:$WDA_PORT/status"

# Derive a display name if not from -d
[ -z "$DEVICE_NAME_REQUEST" ] && DEVICE_NAME=$(xcrun xctrace list devices 2>/dev/null | grep "$UDID" | sed -E 's/\s*([^\(]+)\(.*/\1/' | sed 's/[[:space:]]*$//')
echo "Device UDID: $UDID"
echo "Host: $DEVICE_HOST"
echo "Checking WDA on $DEVICE_HOST:$WDA_PORT ..."
# Quick pre-flight: verify host reachable
if ! ping -c1 -W1 "$DEVICE_HOST" >/dev/null 2>&1; then
  echo "⚠️ Host $DEVICE_HOST not pingable (firewall or ICMP blocked). Continuing anyway."
fi
if curl -s -m 2 "$STATUS_URL" > /dev/null 2>&1; then
    echo "✅ WDA reachable"
else
    echo "ℹ️ WDA not reachable"
    if [ -z "$UDID" ]; then
        echo "❌ Cannot start WDA without UDID. Provide UDID as third argument if you want auto-start."
        exit 1
    fi
    echo "→ Starting WDA wirelessly (UDID: $UDID) (session-based)..."
WDA_PATH="$HOME/Downloads/WebDriverAgent-10.2.1"
if [ ! -d "$WDA_PATH" ]; then echo "❌ WebDriverAgent path not found: $WDA_PATH"; exit 1; fi
# Reset log
: > /tmp/wda_output.log
# Start build/test in background for this session
(
  cd "$WDA_PATH" || exit 1
  xcodebuild -quiet -project WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -destination "platform=iOS,id=$UDID" build-for-testing >/dev/null 2>&1 || exit 1
  xcodebuild -quiet -project WebDriverAgent.xcodeproj -scheme WebDriverAgentRunner -destination "platform=iOS,id=$UDID" test-without-building > /tmp/wda_output.log 2>&1 || exit 1
) & WDA_PID=$!
echo "→ Waiting for WDA to become reachable..."
for i in {1..120}; do
  if curl -s -m 2 "$STATUS_URL" | grep -q '"state"'; then echo "✅ WDA started wirelessly"; break; fi
  if grep -q "Failing tests:" /tmp/wda_output.log 2>/dev/null; then echo "❌ WDA test failure detected"; exit 1; fi
  sleep 1
  # Progress ping every 15s
  if [ $((i % 15)) -eq 0 ]; then echo "   • Waiting... $i s"; fi
done
    if ! curl -s -m 2 "$STATUS_URL" > /dev/null 2>&1; then
        # Attempt extraction ONLY if host was auto-detected (not user-specified)
        if [ "$ARG1" != "$DEVICE_HOST" ]; then
          LOG_IP=$(grep -oE 'ServerURLHere->http://([0-9]{1,3}(\.[0-9]{1,3}){3}):8100<-ServerURLHere' /tmp/wda_output.log 2>/dev/null | head -1 | sed -E 's/.*http:\/\/([0-9\.]+):8100.*/\1/')
          if [ -n "$LOG_IP" ] && [ "$LOG_IP" != "$DEVICE_HOST" ]; then
            echo "→ Detected WDA server log IP: $LOG_IP (switching from $DEVICE_HOST)"
            DEVICE_HOST="$LOG_IP"; STATUS_URL="http://$DEVICE_HOST:$WDA_PORT/status"
            for j in {1..15}; do
              if curl -s -m 2 "$STATUS_URL" > /dev/null 2>&1; then
                echo "✅ WDA reachable after IP switch"; break
              fi; sleep 1
            done
          fi
        fi
    fi
    if ! curl -s -m 2 "$STATUS_URL" > /dev/null 2>&1; then
        echo "❌ WDA failed to start."
        echo "⚠️ Tips: Ensure device is unlocked, on same WiFi, and WDA built once manually via Xcode (trust cert)."
        exit 1
    fi
fi

# Create session with Settings app bundle ID
SESSION=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session" \
    -H "Content-Type: application/json" \
    -d '{"capabilities":{"alwaysMatch":{"bundleId":"com.apple.Preferences"}}}' 2>/dev/null | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId','') or d.get('value',{}).get('sessionId',''))" 2>/dev/null)

if [ -z "$SESSION" ]; then 
    echo "❌ Failed to create session"
    # Debug: show actual response
    echo "→ Debugging session creation..."
    RESPONSE=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session" \
        -H "Content-Type: application/json" \
        -d '{"capabilities":{"alwaysMatch":{"bundleId":"com.apple.Preferences"}}}')
    echo "Response: $RESPONSE"
    exit 1
fi

# Settings app should already be launched via session bundle ID, but ensure it's active
curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/activate" -H 'Content-Type: application/json' -d '{"bundleId":"com.apple.Preferences"}' >/dev/null 2>&1

TRIMMED=$(echo "$TEXT" | tr -d '[:space:]')
if [ -z "$TRIMMED" ]; then
    echo "ℹ️ No initial text provided (blank). Skipping initial send."
else
    JSON_ARRAY=$(python3 -c "import json, sys; print(json.dumps(list(sys.argv[1])))" "$TEXT")
    echo "→ Sending text to device: ${DEVICE_NAME_REQUEST:-${DEVICE_NAME:-Unknown}} (host: $DEVICE_HOST)"
    RESPONSE=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/keys" \
        -H "Content-Type: application/json" \
        -d "{\"value\":$JSON_ARRAY}")
    if echo "$RESPONSE" | grep -q '"sessionId"'; then
        echo "✅ Text sent: $TEXT"
    else
        echo "❌ Failed to send text"; echo "$RESPONSE"; exit 1
    fi
fi

# Text history variables
HISTORY_FILE="$(dirname "$0")/.ios_text_history"
APPS_PRESETS_FILE="$(dirname "$0")/apps_presets.conf"

# Disable bash history to avoid showing shell commands
set +o history
unset HISTFILE



# Load existing text history from file
load_text_history() {
    # Ensure history file exists and is clean
    if [ ! -f "$HISTORY_FILE" ]; then
        touch "$HISTORY_FILE"
    fi
}

# Function to resolve app name to bundle ID
resolve_app_bundle() {
    local input="$1"
    local bundle_id=""
    
    # If it looks like a bundle ID already, return as-is
    if [[ "$input" == *"."* ]] && [[ "$input" != *" "* ]]; then
        echo "$input"
        return
    fi
    
    # Look up in presets file
    if [ -f "$APPS_PRESETS_FILE" ]; then
        # Convert input to lowercase for case-insensitive matching
        local input_lower=$(echo "$input" | tr '[:upper:]' '[:lower:]')
        while IFS=',' read -r name bundle rest; do
            # Skip comments and empty lines
            [[ "$name" =~ ^# ]] || [[ -z "$name" ]] && continue
            
            # Case-insensitive comparison
            if [ "$(echo "$name" | tr '[:upper:]' '[:lower:]')" = "$input_lower" ]; then
                echo "$bundle"
                return
            fi
        done < "$APPS_PRESETS_FILE"
    fi
    
    # If not found in presets, return original input
    echo "$input"
}

# Add text to history
add_to_history() {
    local text="$1"
    # Skip empty text, commands, and special keys
    if [ -z "$text" ] || [[ "$text" == /* ]] || [[ "$text" == "{*}" ]] || [[ "$text" == "\\n" ]] || [[ "$text" == "quit" ]] || [[ "$text" == "exit" ]] || [[ "$text" == "q" ]]; then
        return
    fi
    
    # Add to history file (remove duplicates and keep last 50)
    grep -v "^$(printf '%s\n' "$text" | sed 's/[[\.*^$()+?{|]/\\&/g')$" "$HISTORY_FILE" > "${HISTORY_FILE}.tmp" 2>/dev/null || true
    echo "$text" >> "${HISTORY_FILE}.tmp"
    tail -n 50 "${HISTORY_FILE}.tmp" > "$HISTORY_FILE"
    rm -f "${HISTORY_FILE}.tmp"
}
# Load history at startup
load_text_history



SHOW_MENU_ONCE=1
while true; do
    if [ "$SHOW_MENU_ONCE" -eq 1 ]; then
        echo "──── iOS Wireless Console ────"
        echo "Device: ${DEVICE_NAME_REQUEST:-${DEVICE_NAME:-Unknown}}  Host: $DEVICE_HOST  Session: ${SESSION:0:8}"
        echo "Type /commands to show this menu again. Use ↑/↓ arrows for text history."
        echo "────────────────────────────────"
        SHOW_MENU_ONCE=0
    fi
    TS=$(date +"%H:%M")
    PROMPT_DEVICE="${DEVICE_NAME_REQUEST:-${DEVICE_NAME:-device}}"
    
    # Enable readline for this input with custom history
    set -o history
    HISTFILE="$HISTORY_FILE"
    HISTSIZE=50
    HISTFILESIZE=50
    
    # Load history from file for this session
    if [ -f "$HISTORY_FILE" ]; then
        history -r "$HISTORY_FILE"
        # Debug: show how many history entries loaded
        HIST_COUNT=$(history | wc -l)
#        if [ "$HIST_COUNT" -gt 0 ] && [ "$SHOW_MENU_ONCE" -eq 0 ]; then
#            echo "   (Loaded $HIST_COUNT history entries)"
#        fi
    fi
    
    read -e -p "📝 [$TS] $PROMPT_DEVICE > " INPUT_TEXT
    
    # Add any non-empty input to history (except quit commands)
    if [ -n "$INPUT_TEXT" ] && [[ "$INPUT_TEXT" != "quit" ]] && [[ "$INPUT_TEXT" != "exit" ]] && [[ "$INPUT_TEXT" != "q" ]]; then
        add_to_history "$INPUT_TEXT"
    fi
    
    # Disable history again to avoid shell command pollution
    set +o history
    unset HISTFILE
    if [[ "$INPUT_TEXT" == "quit" || "$INPUT_TEXT" == "exit" || "$INPUT_TEXT" == "q" ]]; then
        echo "👋 Goodbye"; cleanup
    fi
    [ -z "$INPUT_TEXT" ] && continue
    if [[ "$INPUT_TEXT" == "/commands" || "$INPUT_TEXT" == "/help" ]]; then
        echo "──── Commands ────"
        echo " url <https://..>          Open URL"
        echo " launch <name|bundleId>    Launch/activate app (e.g., 'go' or 'com.example.app')"
        echo " kill <name|bundleId>      Terminate app"
        echo " install <ipa_path>        Install IPA"
        echo " uninstall <name|bundleId> Uninstall app"
        echo " screenshot                Capture screenshot"
        echo " home                      Go to home screen"
        echo " restart                   Restart device"
        echo " /apps                     List preset app names"

        echo " text <chars>              Send raw text"
        echo " quit / exit               Close session"
        echo "────────────────────"
        continue
    elif [[ "$INPUT_TEXT" == "/apps" ]]; then
        echo "──── Preset Apps ────"
        if [ -f "$APPS_PRESETS_FILE" ]; then
            echo "Available app shortcuts:"
            while IFS=',' read -r name bundle rest; do
                # Skip comments and empty lines
                [[ "$name" =~ ^# ]] || [[ -z "$name" ]] && continue
                printf "  %-12s → %s\n" "$name" "$bundle"
            done < "$APPS_PRESETS_FILE"
        else
            echo "❌ No apps_presets.conf file found"
        fi
        echo "You can also use direct bundle IDs for any app."
        echo "────────────────────"
        continue

    fi
    # Command handlers
    if [[ "$INPUT_TEXT" == :url* || "$INPUT_TEXT" == url* ]]; then
        URL_VAL=${INPUT_TEXT#*:url }; URL_VAL=${URL_VAL#url };
        if [ -z "$URL_VAL" ]; then echo "   ⚠️ Provide URL"; continue; fi
        # Normalise URL (remove trailing spaces, add scheme if missing)
        URL_VAL=$(echo "$URL_VAL" | tr -d '\r' | sed 's/[[:space:]]*$//')
        if ! echo "$URL_VAL" | grep -qiE '^[a-z]+://'; then URL_VAL="https://$URL_VAL"; fi
        echo "   ↪️ Normalized URL: $URL_VAL"
        echo "   🌐 Opening URL: $URL_VAL"
        # Try global deeplink endpoint first (no session prefix) then session form
        R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/deeplink" -H 'Content-Type: application/json' -d "{\"url\":\"$URL_VAL\"}" -m 5)
        if echo "$R" | grep -q 'unknown command'; then
          R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL_VAL\"}" -m 8)
        fi
        #echo "   ↩️ Response: $R"
        HAS_ERROR=$(echo "$R" | python3 -c "import sys,json; raw=sys.stdin.read(); exec('try:\n d=json.loads(raw)\nexcept:\n print(\"yes\"); raise SystemExit\nval=d.get(\"value\",{})\nprint(\"yes\" if isinstance(val,dict) and val.get(\"error\") else \"no\")')")
        if [ "$HAS_ERROR" = "yes" ]; then
            echo "   ↪️ Deep link endpoint error; trying Safari navigation fallback..."
            SAFARI_SESSION=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session" -H 'Content-Type: application/json' -d '{"capabilities":{"alwaysMatch":{"bundleId":"com.apple.mobilesafari"}}}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('sessionId') or d.get('value',{}).get('sessionId',''))")
            if [ -n "$SAFARI_SESSION" ]; then
                # First try deeplink in Safari session
                R2=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/deeplink" -H 'Content-Type: application/json' -d "{\"url\":\"$URL_VAL\"}" -m 5)
                if echo "$R2" | grep -q 'unknown command'; then
                  R2=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SAFARI_SESSION/url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL_VAL\"}" -m 8)
                fi
                echo "   ↩️ Safari deeplink response: $R2"
                HAS_ERROR2=$(echo "$R2" | python3 -c "import sys,json; exec('try:\n d=json.load(sys.stdin); val=d.get(\"value\",{}); print(\"yes\" if isinstance(val,dict) and val.get(\"error\") else \"no\")\nexcept Exception: print(\"yes\")')")
                if [ "$HAS_ERROR2" = "yes" ]; then
                    # Fallback to Selenium /url endpoint
                    R3=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SAFARI_SESSION/url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL_VAL\"}" -m 8)
                    echo "   ↩️ Safari /url response: $R3"
                    if echo "$R3" | grep -q '"status":0'; then echo "   ✅ URL loaded (Safari /url)"; else echo "   ❌ Failed URL via /url"; echo "   ↩️ Raw /url response: $R3"; fi
                else
                    echo "   ✅ URL launched (Safari deeplink)"
                fi
            else
                echo "   ❌ Could not create Safari session"
            fi
        else
            echo "   ✅ URL launched (deeplink)"
        fi
        continue
    elif [[ "$INPUT_TEXT" == :launch* || "$INPUT_TEXT" == launch* || "$INPUT_TEXT" == :activate* ]]; then
        RAW=${INPUT_TEXT#*:launch }; RAW=${RAW#launch }; RAW=${RAW#*:activate };
        RAW=$(echo "$RAW" | sed -E 's/^[[:space:]]+//' | sed -E 's/[[:space:]]+$//')
        if [ -z "$RAW" ]; then echo "   ⚠️ Provide app name or bundleId"; continue; fi
        if [ "$RAW" = "devicemanagement" ]; then
            echo "   🚀 Running DeviceManagement shortcut"
            R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/deeplink" -H 'Content-Type: application/json' -d "{\"url\":\"shortcuts://run-shortcut?name=DeviceManagement\"}" -m 5)
            if echo "$R" | grep -q '"value"'; then echo "   ✅ Shortcut launched"; else echo "   ❌ Shortcut failed"; fi
            continue
        fi
        BUNDLE=$(resolve_app_bundle "$RAW")
        if [ "$BUNDLE" != "$RAW" ]; then
            echo "   🚀 Launching app: $RAW → $BUNDLE"
        else
            echo "   🚀 Launching app: $BUNDLE"
        fi
        # Try session-scoped activate first
        R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/activate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$BUNDLE\"}")
        #echo "   ↩️ Response (session activate): $R"
        if ! echo "$R" | grep -q '"value"'; then
            R2=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/activate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$BUNDLE\"}")
            #echo "   ↩️ Response (global activate): $R2"
            if echo "$R2" | grep -q '"value"'; then echo "   ✅ App activated (global)"; else echo "   ❌ Failed launch"; fi
        else
            echo "   ✅ App activated (session)"
        fi
        continue
    elif [[ "$INPUT_TEXT" == :install* || "$INPUT_TEXT" == install* ]]; then
        IPA=${INPUT_TEXT#*:install }; IPA=${IPA#install };
        if [ ! -f "$IPA" ]; then echo "   ❌ IPA not found: $IPA"; continue; fi
        echo "   📦 Installing (WDA + devicectl + verify): $IPA"
        SUCCESS=0
        # Try WDA session
        R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/install" -H 'Content-Type: application/json' -d "{\"app\":\"$IPA\"}")
        if echo "$R" | grep -q '"value"'; then SUCCESS=1; echo "   ✅ WDA session accepted"; fi
        # Try WDA global if session not accepted
        if [ $SUCCESS -ne 1 ]; then
          R2=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/install" -H 'Content-Type: application/json' -d "{\"app\":\"$IPA\"}")
          if echo "$R2" | grep -q '"value"'; then SUCCESS=1; echo "   ✅ WDA global accepted"; fi
        fi
        # Derive bundle id from IPA for verification
        BUNDLE_ID=$(python3 - "$IPA" <<'PY'
import sys,zipfile,plistlib
ipa=sys.argv[1]
bid=''
try:
  with zipfile.ZipFile(ipa) as z:
    plist_paths=[n for n in z.namelist() if n.startswith('Payload/') and n.endswith('.app/Info.plist')]
    if plist_paths:
      with z.open(plist_paths[0]) as f:
        pl=plistlib.load(f)
        bid=pl.get('CFBundleIdentifier','')
except Exception as e:
  pass
print(bid)
PY)
        [ -n "$BUNDLE_ID" ] && echo "   ℹ️ BundleId: $BUNDLE_ID"
        # Always attempt devicectl physical install
        if command -v xcrun >/dev/null 2>&1; then
          DC_OUT=$(xcrun devicectl device install app --device "$UDID" "$IPA" 2>&1)
          if echo "$DC_OUT" | grep -qi 'completed\|success'; then echo "   ✅ devicectl install success"; SUCCESS=1; else echo "   ⚠️ devicectl install failed"; fi
        else
          echo "   ⚠️ devicectl not available (skipped)"
        fi
        # Verification loop: try to activate app (max 60s)
        if [ -n "$BUNDLE_ID" ]; then
          echo "   🔍 Verifying installation (activate attempts)..."
          for t in {1..30}; do
            ACT=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/activate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$BUNDLE_ID\"}")
            if echo "$ACT" | grep -q '"value"'; then echo "   ✅ App activation succeeded (installed)"; SUCCESS=1; break; fi
            sleep 2
            [ $((t % 5)) -eq 0 ] && echo "     … waiting ($((t*2))s)"
          done
        fi
        if [ $SUCCESS -eq 1 ]; then echo "   ✅ Install confirmed"; else echo "   ❌ Install not confirmed"; fi
        continue
    elif [[ "$INPUT_TEXT" == :kill* || "$INPUT_TEXT" == kill* ]]; then
        RAW=${INPUT_TEXT#*:kill }; RAW=${RAW#kill };
        RAW=$(echo "$RAW" | sed -E 's/^[[:space:]]+//' | sed -E 's/[[:space:]]+$//')
        if [ -z "$RAW" ]; then echo "   ⚠️ Provide app name or bundleId"; continue; fi
        BUNDLE=$(resolve_app_bundle "$RAW")
        if [ "$BUNDLE" != "$RAW" ]; then
            echo "   🛑 Killing app: $RAW → $BUNDLE"
        else
            echo "   🛑 Killing app: $BUNDLE"
        fi
        # Try session terminate then global fallback
        R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/terminate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$BUNDLE\"}")
        if echo "$R" | grep -q 'unknown command'; then
          R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/terminate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$BUNDLE\"}")
        fi
        if echo "$R" | grep -q 'true'; then echo "   ✅ App terminated"; else echo "   ❌ Terminate failed"; fi
        continue
    elif [[ "$INPUT_TEXT" == :screenshot* || "$INPUT_TEXT" == screenshot* ]]; then
        OUT="/tmp/ios_wireless_screenshot_$(date +%H%M%S).png"
        R=$(curl -s -X GET "http://$DEVICE_HOST:$WDA_PORT/screenshot" -H 'Content-Type: application/json')
        python3 - <<'PY'
import sys,base64,json,os
raw=sys.stdin.read().strip()
if not raw:
  print('   ❌ Screenshot failed (empty response)'); sys.exit(0)
try:
  j=json.loads(raw)
except Exception as e:
  print('   ❌ Screenshot JSON decode failed'); sys.exit(0)
img_b64=j.get('value') or (j.get('value',{}) if isinstance(j.get('value'),dict) else None)
if isinstance(img_b64,dict):
  img_b64=img_b64.get('value')
if not img_b64:
  print('   ❌ Screenshot failed (no image data)'); sys.exit(0)
open(os.environ.get('OUT'),'wb').write(base64.b64decode(img_b64))
print(f"   ✅ Screenshot saved: {os.environ.get('OUT')}")
PY
        continue
    elif [[ "$INPUT_TEXT" == :home || "$INPUT_TEXT" == home ]]; then
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/homescreen" -H 'Content-Type: application/json' -d '{}' >/dev/null 2>&1 && echo "   ✅ Went to Home" || echo "   ❌ Home press failed"
        continue
    elif [[ "$INPUT_TEXT" == :restart || "$INPUT_TEXT" == restart ]]; then
        echo "   🔄 Restarting device..."
        echo "   ⚠️ This will close all sessions and restart the device"
        read -p "   Continue? (y/N): " confirm
        if [[ "$confirm" == "y" || "$confirm" == "Y" ]]; then
            # Try devicectl first (most reliable for wireless)
            if command -v xcrun >/dev/null 2>&1 && [ -n "$UDID" ]; then
                echo "   → Attempting restart via devicectl..."
                DC_OUT=$(xcrun devicectl device reboot --device "$UDID" 2>&1)
                if echo "$DC_OUT" | grep -qi "restart\|reboot\|success" || [ $? -eq 0 ]; then
                    echo "   ✅ Device restart initiated (devicectl)"
                    cleanup
                else
                    echo "   ❌ devicectl restart failed: $DC_OUT"
                    echo "   → Trying WDA restart endpoint..."
                    R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/device/restart" -H 'Content-Type: application/json' -d '{}' -m 10)
                    if echo "$R" | grep -q '"value"'; then
                        echo "   ✅ Device restart initiated (WDA)"
                        cleanup
                    else
                        echo "   ❌ WDA restart also failed"
                        echo "   ℹ️ Try manually: Settings → General → Shut Down, then power on"
                    fi
                fi
            else
                echo "   ❌ devicectl not available, trying WDA..."
                R=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/device/restart" -H 'Content-Type: application/json' -d '{}' -m 10)
                if echo "$R" | grep -q '"value"'; then
                    echo "   ✅ Device restart initiated (WDA)"
                    cleanup
                else
                    echo "   ❌ Restart not available via WDA"
                    echo "   ℹ️ Try manually: Settings → General → Shut Down, then power on"
                fi
            fi
        else
            echo "   ℹ️ Restart cancelled"
        fi
        continue
    elif [[ "$INPUT_TEXT" == :uninstall* || "$INPUT_TEXT" == uninstall* ]]; then
        RAW=${INPUT_TEXT#*:uninstall }; RAW=${RAW#uninstall };
        RAW=$(echo "$RAW" | sed -E 's/^(uninstall[[:space:]]+)+//' | sed -E 's/^[[:space:],]+//' | sed -E 's/[[:space:],]+$//')
        if [ -z "$RAW" ]; then echo "   ⚠️ Provide app name or bundleId"; continue; fi
        BUNDLE=$(resolve_app_bundle "$RAW")
        if [ "$BUNDLE" != "$RAW" ]; then
            echo "   🗑️ Uninstalling: $RAW → $BUNDLE"
        else
            echo "   🗑️ Uninstalling: $BUNDLE"
        fi
        PAYLOAD="{\"bundleId\":\"$BUNDLE\"}"
        RG=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/uninstall" -H 'Content-Type: application/json' -d "$PAYLOAD")
        if echo "$RG" | grep -E '"error"|unknown command'; then
          RS=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/uninstall" -H 'Content-Type: application/json' -d "$PAYLOAD")
          if echo "$RS" | grep -E '"error"|unknown command'; then
            curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/terminate" -H 'Content-Type: application/json' -d "$PAYLOAD" >/dev/null 2>&1
            RG2=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/apps/uninstall" -H 'Content-Type: application/json' -d "$PAYLOAD")
            if echo "$RG2" | grep -E '"error"|unknown command'; then
              if command -v xcrun >/dev/null 2>&1; then
                DC_OUT=$(xcrun devicectl device uninstall app --device "$UDID" "$BUNDLE" 2>&1)
                if echo "$DC_OUT" | grep -qi 'completed\|success'; then echo "   ✅ devicectl uninstall success"; else echo "   ❌ devicectl uninstall failed"; fi
              else
                echo "   ❌ Uninstall unsupported (WDA build)"
              fi
            else
              echo "   ✅ Uninstall (retry global)"
            fi
          else
            echo "   ✅ Uninstall (session)"
          fi
        else
          echo "   ✅ Uninstall (global)"
        fi
        continue
    fi
    # Plain text input
    case "$INPUT_TEXT" in
        "\\n"|"{enter}") SEND_VALUE="\\n"; LABEL="Enter" ;; 
        "{tab}") SEND_VALUE="\\t"; LABEL="Tab" ;; 
        *) SEND_VALUE="$INPUT_TEXT"; LABEL="Text" ;; 
    esac
    JSON_ARRAY=$(python3 -c "import json, sys; print(json.dumps(list(sys.argv[1])))" "$SEND_VALUE")
    RESPONSE=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/keys" -H "Content-Type: application/json" -d "{\"value\":$JSON_ARRAY}")
    if echo "$RESPONSE" | grep -q '"sessionId"'; then
        echo "   ✅ Sent [$LABEL]"
        # Add text to history if it was successfully sent
        if [ "$LABEL" = "Text" ]; then
            add_to_history "$INPUT_TEXT"
        fi
        # Auto-press Enter after sending text (but not for special keys)
        if [ "$LABEL" = "Text" ]; then
            sleep 0.5  # Small delay
            ENTER_ARRAY=$(python3 -c "import json; print(json.dumps(['\\n']))")
            ENTER_RESPONSE=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/keys" -H "Content-Type: application/json" -d "{\"value\":$ENTER_ARRAY}")
#            if echo "$ENTER_RESPONSE" | grep -q '"sessionId"'; then
#                echo "   ✅ Auto-pressed Enter"
#            else
#                echo "   ⚠️ Auto-Enter failed"
#            fi
        fi
    else
        echo "   ❌ Failed"
    fi
    echo ""
done
