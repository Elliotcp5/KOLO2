#!/bin/bash
# KOLO Notification Scheduler Startup Script
# Run this script to start the notification scheduler in the background

cd /app/backend

# Check if scheduler is already running
if pgrep -f "notification_scheduler.py" > /dev/null; then
    echo "Scheduler is already running"
    exit 0
fi

# Start the scheduler in the background
nohup /root/.venv/bin/python notification_scheduler.py > /var/log/kolo_scheduler.log 2>&1 &

echo "Scheduler started with PID $!"
echo "Logs: /var/log/kolo_scheduler.log"
