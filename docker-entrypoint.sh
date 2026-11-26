#!/bin/bash
# Lance claude dans une session tmux nommée "main"
tmux new-session -d -s main "claude $*"
# ttyd expose la session tmux (lecture + écriture)
ttyd -p 3000 -W tmux attach-session -t main &
# Bridge voix/agents
cd /workspace/voice-bridge && node server.js >> /tmp/voice-bridge.log 2>&1 &
# Attache le terminal courant à la session tmux (pour claude.bat session)
exec tmux attach-session -t main
