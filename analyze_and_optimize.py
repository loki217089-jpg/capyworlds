#!/usr/bin/env python3
"""
CapyWorlds 遊戲自動分析 + 優化腳本

流程：
  1. 讀取 analysis_report.md
     - 有待優化項目 → 直接跳步驟5，優化完刪掉那條，重複直到清空
     - 無待優化項目（或無報告）→ 隨機選遊戲重新分析產生新報告
"""

import json
import re
import sys
from datetime import datetime
from pathlib import Path

import anthropic

# ── 設定 ──────────────────────────────────────────────────
REPO_ROOT   = Path(__file__).parent
GAMES_INDEX = REPO_ROOT / "games" / "index.json"
REPORT_FILE = REPO_ROOT / "analysis_report.md"
MODEL       = "claude-sonnet-4-6"
MAX_HTML_CHARS = 60_000


# ── 報告解析工具 ───────────────────────────────────────────

def load_report():
    """讀取現有報告，沒有或為空回傳 None"""
    if not REPORT_FILE.exists():
        return None
    content = REPORT_FILE.read_text(encoding="utf-8")
    return content if content.strip() else None


def extract_game_id(report: str) -> str | None:
    """從報告 metadata 表格取出 game id"""
    for line in report.splitlines():
        m = re.match(r"\|\s*ID\s*\|\s*(\S+)\s*\|", line)
        if m:
            return m.group(1)
    return None


def get_pending_items(report: str) -> list[str]:
    """
    回傳「優化建議」區塊內所有尚未完成的編號項目（只取純文字）。
    格式：1. xxx 或 1. **xxx**
    """
    items = []
    in_section = False
    for line in report.splitlines():
        if re.search(r"##\s*優化建議", line):
            in_section = True
            continue
        if in_section:
            if line.startswith("##"):
                break
            m = re.match(r"^\d+\.\s+(.+)", line.strip())
            if m:
                # 去掉 markdown 粗體符號
                text = re.sub(r"\*\*(.+?)\*\*", r"\1", m.group(1)).strip()
                items.append(text)
    return items


def remove_first_item(report: str) -> str:
    """刪除「優化建議」區塊的第一個編號項目，並重新編號"""
    lines = report.splitlines()
    in_section = False
    removed = False
    result = []
    counter = 1

    for line in lines:
        if re.search(r"##\s*優化建議", line):
            in_section = True
            result.append(line)
            continue

        if in_section:
            if line.startswith("##"):
                in_section = False
                result.append(line)
                continue

            m = re.match(r"^(\d+)\.\s+(.+)", line.strip())
            if m:
                if not removed:
                    removed = True   # 跳過（刪除）第一條
                    continue
                # 其餘項目重新編號
                result.append(f"{counter}. {m.group(2)}")
                counter += 1
                continue

        result.append(line)

    return "\n".join(result)


# ── 遊戲資料 ──────────────────────────────────────────────

def load_games():
    with open(GAMES_INDEX, encoding="utf-8") as f:
        return json.load(f)


def pick_game(games, game_id=None):
    import random
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


def read_html(game) -> str:
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


def analyze_game(game, html_content) -> str:
    client = anthropic.Anthropic()
    prompt = ANALYSIS_PROMPT.format(
        name=game["name"],
        types=", ".join(game["type"]),
        html=html_content,
    )
    print("🤖 Claude Sonnet 4.6 分析中…\n")
    print("─" * 60)
    full = ""
    with client.messages.stream(
        model=MODEL, max_tokens=4096,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            full += text
    print("\n" + "─" * 60)
    return full


def save_report(game, analysis) -> str:
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


# ── 步驟 5：單項優化 ──────────────────────────────────────

SINGLE_OPTIMIZE_PROMPT = """\
請對以下遊戲 HTML 進行單項優化改進。

遊戲：{name}
本次優化任務：{item}

遊戲原始碼：
```html
{html}
```

執行原則：
- 只針對「本次優化任務」進行改進，不做無關修改
- 不改變遊戲的核心玩法定位
- 直接回傳完整的優化後 HTML 原始碼（不要截斷、不要加說明文字，只回傳 HTML）
- 在 HTML 最末尾加一段 HTML 註解說明本次改動：
  <!-- 優化：{item} → 實際做了什麼 -->
"""


def _strip_codeblock(text: str) -> str:
    s = text.strip()
    if s.startswith("```html"):
        s = s[7:]
    elif s.startswith("```"):
        s = s[3:]
    if s.endswith("```"):
        s = s[:-3]
    return s.strip()


def optimize_single_item(game, item: str):
    print(f"\n🚀 優化項目：{item}")
    print("─" * 60)

    game_path = REPO_ROOT / game["file"]
    html = game_path.read_text(encoding="utf-8")
    if len(html) > 80_000:
        print(f"⚠️  檔案過大（{len(html):,} 字元），只送前 80,000 字元")
        html = html[:80_000]

    prompt = SINGLE_OPTIMIZE_PROMPT.format(
        name=game["name"], item=item, html=html
    )

    client = anthropic.Anthropic()
    print("🤖 Claude Sonnet 4.6 優化中…\n")

    optimized = ""
    with client.messages.stream(
        model=MODEL, max_tokens=16_000,
        messages=[{"role": "user", "content": prompt}],
    ) as stream:
        for text in stream.text_stream:
            print(text, end="", flush=True)
            optimized += text

    print("\n" + "─" * 60)

    stripped = _strip_codeblock(optimized)
    if stripped.startswith("<!") or stripped.startswith("<html"):
        game_path.write_text(stripped, encoding="utf-8")
        print(f"✅ 已覆寫：{game_path}")
        return True
    else:
        fallback = REPO_ROOT / "optimized_output.txt"
        fallback.write_text(optimized, encoding="utf-8")
        print(f"⚠️  回傳內容非完整 HTML，已另存至：{fallback}")
        return False


# ── 主程式 ────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("  CapyWorlds 遊戲自動分析 + 優化")
    print("=" * 60)

    games = load_games()

    # ── 步驟 1：讀現有報告 ──────────────────────────────────
    report = load_report()

    if report:
        pending = get_pending_items(report)
        if pending:
            game_id = extract_game_id(report)
            game    = pick_game(games, game_id)
            item    = pending[0]

            print(f"📋 報告已存在，剩餘 {len(pending)} 項優化任務")
            print(f"   ▶ 本次執行：{item}\n")

            success = optimize_single_item(game, item)

            if success:
                new_report = remove_first_item(report)
                REPORT_FILE.write_text(new_report, encoding="utf-8")
                remaining = get_pending_items(new_report)
                if remaining:
                    print(f"\n📋 報告更新完成，還剩 {len(remaining)} 項待優化")
                    print("   再次執行此腳本繼續處理下一項。")
                else:
                    print("\n🎉 所有優化建議已全部完成！下次執行將重新分析。")
            return

        print("📋 報告存在但優化建議已清空，重新分析…\n")

    # ── 步驟 2–4：重新分析產生報告 ─────────────────────────
    # 可選：python analyze_and_optimize.py <game_id>
    forced_id = sys.argv[1] if len(sys.argv) > 1 else None
    game     = pick_game(games, forced_id)
    html     = read_html(game)
    analysis = analyze_game(game, html)
    report   = save_report(game, analysis)

    # ── 步驟 5：立刻執行第一項優化 ─────────────────────────
    pending = get_pending_items(report)
    if pending:
        print(f"\n📋 共 {len(pending)} 項優化建議，開始執行第一項…")
        success = optimize_single_item(game, pending[0])
        if success:
            new_report = remove_first_item(report)
            REPORT_FILE.write_text(new_report, encoding="utf-8")
            remaining = get_pending_items(new_report)
            if remaining:
                print(f"\n📋 還剩 {len(remaining)} 項，再次執行腳本繼續。")
            else:
                print("\n🎉 所有優化建議已全部完成！")

    print("\n✅ 本次執行結束")


if __name__ == "__main__":
    main()
