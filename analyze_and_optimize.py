#!/usr/bin/env python3
"""
CapyWorlds 遊戲自動分析 + 優化腳本
流程：隨機選遊戲 → Claude API 分析 → 儲存報告 → Claude Code CLI 自動優化
"""

import json
import os
import random
import sys
from datetime import datetime
from pathlib import Path

import anthropic

# ── 設定 ──────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).parent
GAMES_INDEX = REPO_ROOT / "games" / "index.json"
REPORT_FILE = REPO_ROOT / "analysis_report.md"
MODEL       = "claude-sonnet-4-6"
MAX_HTML_CHARS = 60_000   # 超長檔案只送前 60k 字元


# ── 步驟 1：選遊戲 ────────────────────────────────────────
def load_games():
    with open(GAMES_INDEX, encoding="utf-8") as f:
        return json.load(f)


def pick_game(games, game_id=None):
    if game_id:
        matches = [g for g in games if g["id"] == game_id]
        if not matches:
            print(f"❌ 找不到 id={game_id}")
            sys.exit(1)
        game = matches[0]
    else:
        game = random.choice(games)

    print(f"\n🎮 選中遊戲：{game['name']}（{game['id']}）")
    print(f"   類型：{', '.join(game['type'])}")
    print(f"   路徑：{game['file']}\n")
    return game


# ── 步驟 2：讀取 HTML ──────────────────────────────────────
def read_html(game):
    path = REPO_ROOT / game["file"]
    if not path.exists():
        print(f"❌ 找不到檔案：{path}")
        sys.exit(1)
    content = path.read_text(encoding="utf-8")
    print(f"📄 讀取完成，{len(content):,} 字元")
    if len(content) > MAX_HTML_CHARS:
        print(f"   （超過上限，只送前 {MAX_HTML_CHARS:,} 字元）")
        content = content[:MAX_HTML_CHARS]
    return content


# ── 步驟 3：Claude API 串流分析 ───────────────────────────
ANALYSIS_PROMPT = """\
你是一位專業的遊戲設計師兼評論家，請從真實玩家視角分析以下 HTML 單頁遊戲。

遊戲名稱：{name}
遊戲類型：{types}

請依序提供：

## 整體評分
X / 10（一句話說明理由）

## 優點
- 至少 3 點，具體描述玩家的正向體驗

## 缺點 / 痛點
- 至少 3 點，具體描述玩家遇到的問題或無聊點

## 優化建議（按優先序）
1. 最重要的改進（說明為什麼優先）
2. 次要改進
3. 其他建議
...

## 總結
一段話總結現況與潛力。

請用繁體中文回答，格式清晰。

---

遊戲原始碼：

```html
{html}
```
"""


def analyze_game(game, html_content):
    client = anthropic.Anthropic()

    prompt = ANALYSIS_PROMPT.format(
        name=game["name"],
        types=", ".join(game["type"]),
        html=html_content,
    )

    print("🤖 Claude Sonnet 4.6 分析中…\n")
    print("─" * 60)

    full_response = ""
    with client.messages.stream(
        model=MODEL,
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            full_response += text

    print("\n" + "─" * 60)
    return full_response


# ── 步驟 4：儲存報告 ──────────────────────────────────────
def save_report(game, analysis):
    now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    report = f"""# 遊戲分析報告

| 欄位 | 內容 |
|------|------|
| 遊戲 | {game['name']} |
| ID | {game['id']} |
| 類型 | {', '.join(game['type'])} |
| 檔案 | {game['file']} |
| 分析時間 | {now} |
| 模型 | {MODEL} |

---

{analysis}
"""
    REPORT_FILE.write_text(report, encoding="utf-8")
    print(f"\n📝 報告已儲存：{REPORT_FILE}")
    return report


# ── 步驟 5：Claude API 自動優化 ───────────────────────────
OPTIMIZE_PROMPT = """\
請根據以下分析報告，對遊戲 HTML 原始碼進行優化改進。

{report}

遊戲原始碼：
```html
{html}
```

執行原則：
- 優先處理「優化建議」中排序靠前的項目
- 只修改遊戲邏輯/體驗，不改變遊戲的核心玩法定位
- 直接回傳完整的優化後 HTML 原始碼（不要截斷、不要加說明文字，只回傳 HTML）
- 在 HTML 最末尾加一段 HTML 註解，列出本次改動摘要，格式如下：
  <!-- 優化摘要：1. xxx  2. xxx  3. xxx -->
"""


def run_optimization(game, report):
    print(f"\n🚀 開始自動優化：{game['name']}")
    print("─" * 60)

    game_path = REPO_ROOT / game["file"]
    html_content = game_path.read_text(encoding="utf-8")
    if len(html_content) > 80_000:
        print(f"⚠️  檔案過大（{len(html_content):,} 字元），只優化前 80,000 字元")
        html_content = html_content[:80_000]

    prompt = OPTIMIZE_PROMPT.format(report=report, html=html_content)

    client = anthropic.Anthropic()
    print("🤖 Claude Sonnet 4.6 優化中…\n")

    optimized = ""
    with client.messages.stream(
        model=MODEL,
        max_tokens=16_000,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            optimized += text

    print("\n" + "─" * 60)

    # 若模型回傳有 ```html ... ``` 包裝，剝掉它
    stripped = optimized.strip()
    if stripped.startswith("```html"):
        stripped = stripped[7:]
    if stripped.startswith("```"):
        stripped = stripped[3:]
    if stripped.endswith("```"):
        stripped = stripped[:-3]
    stripped = stripped.strip()

    if stripped.startswith("<!"):
        game_path.write_text(stripped, encoding="utf-8")
        print(f"\n✅ 優化完成，已覆寫：{game_path}")
    else:
        fallback = REPO_ROOT / "optimized_output.txt"
        fallback.write_text(optimized, encoding="utf-8")
        print(f"\n⚠️  回傳內容非完整 HTML，已另存至：{fallback}")


# ── 主程式 ────────────────────────────────────────────────
def main():
    # 可選：python analyze_and_optimize.py <game_id>
    game_id = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 60)
    print("  CapyWorlds 遊戲自動分析 + 優化")
    print("=" * 60)

    games    = load_games()
    game     = pick_game(games, game_id)
    html     = read_html(game)
    analysis = analyze_game(game, html)
    report   = save_report(game, analysis)
    run_optimization(game, report)

    print("\n🎉 全流程完成！")


if __name__ == "__main__":
    main()
