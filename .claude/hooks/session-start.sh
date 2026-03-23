#!/bin/bash
# CapyWorlds 週開發計畫提示
# 每次開啟 Claude Code session 時自動顯示

DAY=$(date +%u)   # 1=Mon ... 7=Sun
DATE=$(date +%Y-%m-%d)
WEEKDAY_TW=("" "週一" "週二" "週三" "週四" "週五" "週六" "週日")
TODAY="${WEEKDAY_TW[$DAY]}"

echo "========================================"
echo "  CapyWorlds 開發提示 ── $DATE ($TODAY)"
echo "========================================"

case $DAY in
  1)  # 週一：新遊戲開發
    echo ""
    echo "📅 今天是【新遊戲開發日】"
    echo ""
    echo "建議流程："
    echo "  1. 說「幫我想一款遊戲」或直接提出概念"
    echo "  2. 確認風格 / 操作方式 / 是否手機版"
    echo "  3. 讓 Claude 規劃 + 執行到完成"
    echo "  4. 加入 games/index.html 卡片"
    echo ""
    echo "💡 目標：完成 1~2 款中型遊戲（各 ~800 行）"
    ;;
  2)  # 週二：輕度修改或休息
    echo ""
    echo "📅 今天是【彈性日】（可輕度工作）"
    echo ""
    echo "建議任務（擇一）："
    echo "  - 修昨天遊戲的小 bug"
    echo "  - 加一個小功能（音效、動畫、新關卡）"
    echo "  - 更新 CLAUDE.md 記錄昨天做了什麼"
    echo ""
    echo "💡 不強制開發，保留精力給週三"
    ;;
  3)  # 週三：新遊戲或強化
    echo ""
    echo "📅 今天是【開發 / 強化日】"
    echo ""
    echo "建議流程："
    echo "  A. 開發新遊戲（同週一流程）"
    echo "  B. 或強化現有遊戲："
    echo "     - hero/ 勇者傳說 → 新職業 / Boss"
    echo "     - space-roguelike/ → 更多武器種類"
    echo "     - zombie-idle/ → 更多 Prestige 循環"
    echo ""
    echo "💡 目標：完成 1 款遊戲 或 大幅強化 1 款"
    ;;
  4)  # 週四：測試 & 平衡
    echo ""
    echo "📅 今天是【測試 & 平衡日】"
    echo ""
    echo "建議任務："
    echo "  - 實際玩本週做的遊戲 10~15 分鐘"
    echo "  - 記下卡關點 / 無聊點 / bug"
    echo "  - 請 Claude 修改平衡數值 / 新增回饋感"
    echo "  - 確認手機版跑起來正常"
    echo ""
    echo "💡 品質比數量重要，這天是打磨日"
    ;;
  5)  # 週五：上架準備 & 記錄
    echo ""
    echo "📅 今天是【上架準備 & 週結算日】"
    echo ""
    echo "建議任務："
    echo "  - 確認本週遊戲已加入 games/index.html"
    echo "  - 若手機友善 → 加入 games/mobile.html"
    echo "  - 更新 CLAUDE.md（新增遊戲紀錄 + 優缺點）"
    echo "  - 準備 CrazyGames 上架素材（封面圖方向）"
    echo "  - commit & push 所有變更"
    echo ""
    echo "💡 CrazyGames 上架 SOP 在 CLAUDE.md Step 7"
    ;;
  6)  # 週六：靈感 & 規劃
    echo ""
    echo "📅 今天是【靈感 & 規劃日】（非強制開發）"
    echo ""
    echo "建議活動："
    echo "  - 玩 CrazyGames 熱門遊戲，找差異點"
    echo "  - 跟 Claude 聊遊戲概念，不用馬上做"
    echo "  - 規劃下週要做什麼類型"
    echo ""
    echo "💡 說「幫我分析 CG 上什麼類型缺競品」"
    ;;
  7)  # 週日：休息
    echo ""
    echo "📅 今天是【休息日】"
    echo ""
    echo "建議放下開發，但如果靈感來了："
    echo "  - 記下概念就好，下週一再做"
    echo "  - 或做一件小事：加個音效、修一行 bug"
    echo ""
    echo "💡 週一見！"
    ;;
esac

echo ""
echo "━━━━ 本週節奏目標（\$100 MAX 方案）━━━━"
echo "  週一/三 開發 → 週四 測試 → 週五 整理"
echo "  每月目標：6~10 款有品質的遊戲"
echo "========================================"
echo ""
