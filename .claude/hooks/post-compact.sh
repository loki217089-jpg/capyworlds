#!/bin/bash
# PostCompact hook：對話壓縮後自動存摘要到 compact-log.md

SUMMARY=$(jq -r '.summary // ""' 2>/dev/null)

if [ -z "$SUMMARY" ]; then
  exit 0
fi

LOG_FILE="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/compact-log.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# 若檔案不存在，建立標頭
if [ ! -f "$LOG_FILE" ]; then
  echo "# CapyWorlds 對話壓縮記錄" > "$LOG_FILE"
  echo "" >> "$LOG_FILE"
fi

{
  echo "## $TIMESTAMP"
  echo ""
  echo "$SUMMARY"
  echo ""
  echo "---"
  echo ""
} >> "$LOG_FILE"

echo "{\"systemMessage\": \"💾 對話已壓縮，摘要存入 .claude/compact-log.md\"}"
