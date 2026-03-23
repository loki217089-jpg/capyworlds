#!/usr/bin/env python3
"""
analyze_game.py — 以玩家視角分析 CapyWorlds 遊戲
用法: python3 analyze_game.py [遊戲路徑]
範例: python3 tools/analyze_game.py games/space-roguelike/index.html
"""

import sys
import os
import anthropic

SYSTEM_PROMPT = """你是一位資深遊戲設計師兼玩家，專門評估 HTML5 瀏覽器遊戲。
你會閱讀遊戲的原始碼，用「真實玩家」的角度去體驗並分析這款遊戲。

分析時請注意：
- 你能從程式碼推斷出遊戲的機制、數值平衡、玩家體驗流程
- 以玩家第一人稱描述會遇到的問題（「玩到第三關時會覺得...」）
- 不要只說技術面的問題，要說玩家感受

輸出格式（繁體中文）：

## 🎮 遊戲概述
一段話說明這是什麼遊戲、核心玩法

## ✅ 優點（玩家視角）
列點說明玩起來哪裡好，要有具體情境

## ⚠️ 問題與建議（玩家視角）
列點說明哪裡讓玩家卡關、無聊、挫折，並給出修改建議

## 🔧 優先修改項目
按重要性排序，列出 3–5 個最值得改的地方（要有具體的修改方向）

## 📊 整體評分
- 上手難易度：X/10
- 爽快感：X/10
- 耐玩度：X/10
- 整體：X/10"""


def load_game_code(game_path: str) -> str:
    abs_path = os.path.abspath(game_path)
    if not os.path.exists(abs_path):
        print(f"❌ 找不到檔案：{abs_path}")
        sys.exit(1)

    with open(abs_path, "r", encoding="utf-8") as f:
        code = f.read()

    print(f"✅ 載入遊戲：{abs_path}（{len(code):,} 字元，約 {len(code.split(chr(10))):,} 行）")
    return code


def analyze(game_path: str):
    code = load_game_code(game_path)
    game_name = os.path.basename(os.path.dirname(game_path)) or os.path.basename(game_path)

    client = anthropic.Anthropic()

    print(f"\n🤖 正在以玩家視角分析「{game_name}」...\n")
    print("=" * 60)

    with client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{
            "role": "user",
            "content": f"請分析以下遊戲的原始碼，給出玩家視角的優缺點分析：\n\n```html\n{code}\n```"
        }]
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)

    final = stream.get_final_message()
    print(f"\n{'=' * 60}")
    print(f"📊 Token 使用：輸入 {final.usage.input_tokens:,} / 輸出 {final.usage.output_tokens:,}")

    # 儲存報告
    report_path = game_path.replace("index.html", "analysis_report.md").replace(".html", "_analysis.md")
    text_content = next((b.text for b in final.content if b.type == "text"), "")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(f"# 遊戲分析報告：{game_name}\n\n")
        f.write(text_content)
    print(f"💾 報告已儲存：{report_path}\n")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # 預設分析 space-roguelike
        default_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "games", "space-roguelike", "index.html"
        )
        print(f"未指定路徑，使用預設：{default_path}")
        game_path = default_path
    else:
        game_path = sys.argv[1]

    analyze(game_path)
