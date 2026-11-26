#!/bin/bash
cp -rn /data/. /home/claude/ 2>/dev/null
chown -R claude:claude /home/claude
exec su claude -c "claude --dangerously-skip-permissions"
