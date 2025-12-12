#!/bin/bash
# Fast iOS Command Sender - assumes WDA is already running
# Usage: ./send_command_fast.sh <device_name> <command>

DEVICE_NAME="$1"
COMMAND="$2"
WDA_PORT=8100
CONFIG_FILE="$(dirname "$0")/devices.conf"

if [ -z "$DEVICE_NAME" ] || [ -z "$COMMAND" ]; then
    echo "Usage: $0 <device_name> <command>"
    exit 1
fi

# Look up device info from config
DEVICE_HOST=""
UDID=""

if [ -f "$CONFIG_FILE" ]; then
    while IFS=',' read -r name f2 f3 rest; do
        if [ "$name" = "$DEVICE_NAME" ]; then
            IP_REGEX='^([0-9]{1,3}\.){3}[0-9]{1,3}$'
            if [[ "$f2" =~ $IP_REGEX ]]; then 
                DEVICE_HOST="$f2"; UDID="$f3"
            elif [[ "$f3" =~ $IP_REGEX ]]; then 
                UDID="$f2"; DEVICE_HOST="$f3"
            else 
                DEVICE_HOST="$f2"; UDID="$f3"
            fi
            break
        fi
    done < "$CONFIG_FILE"
fi

if [ -z "$DEVICE_HOST" ]; then
    echo "❌ Device '$DEVICE_NAME' not found in $CONFIG_FILE"
    exit 1
fi

# Quick check if WDA is reachable
STATUS_URL="http://$DEVICE_HOST:$WDA_PORT/status"
if ! curl -s -m 2 "$STATUS_URL" > /dev/null 2>&1; then
    echo "❌ WDA not reachable on $DEVICE_HOST:$WDA_PORT. Please connect first."
    exit 1
fi

# Create or get session
SESSION=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session" -H 'Content-Type: application/json' -d '{"capabilities":{},"desiredCapabilities":{}}' | python3 -c "import sys,json; print(json.load(sys.stdin)['sessionId'])" 2>/dev/null)

if [ -z "$SESSION" ]; then
    # Try to get existing session
    SESSION=$(curl -s "http://$DEVICE_HOST:$WDA_PORT/status" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('sessionId', ''))" 2>/dev/null)
fi

if [ -z "$SESSION" ]; then
    echo "❌ Could not create or find WDA session"
    exit 1
fi

# Handle special commands
case "$COMMAND" in
    ":home")
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/homescreen" -H 'Content-Type: application/json' -d '{}'
        echo "✅ Home button pressed"
        ;;
    ":lock")
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/wda/locked" -H 'Content-Type: application/json' -d '{"locked":true}'
        echo "✅ Device locked"
        ;;
    ":screenshot")
        curl -s -X GET "http://$DEVICE_HOST:$WDA_PORT/screenshot" > "/tmp/screenshot_$(date +%s).png"
        echo "✅ Screenshot saved"
        ;;
    :launch\ *)
        APP_NAME="${COMMAND#*:launch }"
        # Simple app launch attempt
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/launch" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$APP_NAME\"}"
        echo "✅ Launched: $APP_NAME"
        ;;
    :kill\ *)
        APP_NAME="${COMMAND#*:kill }"
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/apps/terminate" -H 'Content-Type: application/json' -d "{\"bundleId\":\"$APP_NAME\"}"
        echo "✅ Killed: $APP_NAME"
        ;;
    :url\ *)
        URL="${COMMAND#*:url }"
        curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/url" -H 'Content-Type: application/json' -d "{\"url\":\"$URL\"}"
        echo "✅ Opened URL: $URL"
        ;;
    *)
        # Regular text input
        TEXT="$COMMAND"
        # Remove outer quotes if present
        TEXT="${TEXT#\"}"
        TEXT="${TEXT%\"}"
        
        # Convert text to JSON array
        JSON_ARRAY=$(python3 -c "import json, sys; print(json.dumps(list(sys.argv[1])))" "$TEXT" 2>/dev/null)
        if [ $? -ne 0 ]; then
            echo "❌ Failed to process text: $TEXT"
            exit 1
        fi
        
        # Send text
        RESPONSE=$(curl -s -X POST "http://$DEVICE_HOST:$WDA_PORT/session/$SESSION/wda/keys" -H "Content-Type: application/json" -d "{\"value\":$JSON_ARRAY}")
        if echo "$RESPONSE" | grep -q '"sessionId"'; then
            echo "✅ Text sent: $TEXT"
        else
            echo "❌ Failed to send text"
            exit 1
        fi
        ;;
esac

exit 0