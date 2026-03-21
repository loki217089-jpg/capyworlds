#!/usr/bin/env python3
"""
CapyWorlds 自動品質提升腳本
流程：讀取 CLAUDE.md 優缺點 → 挑選一個遊戲問題 → 定點修復 → git commit
"""

import os
import json
import subprocess
import sys
import time
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

try:
    from google import genai
except ImportError:
    print("請先執行：pip install google-genai python-dotenv")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────────
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("錯誤：找不到 GEMINI_API_KEY，請確認 .env 檔案")
    sys.exit(1)

client = genai.Client(api_key=GEMINI_API_KEY)
MODEL = 'gemini-2.0-flash'

REPO_ROOT = Path(__file__).parent
GAMES_DIR = REPO_ROOT / 'games'
CLAUDE_MD = REPO_ROOT / 'CLAUDE.md'

# ── 工具函式 ──────────────────────────────────────────
def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write_file(path, content):
    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content)

def count_lines(path):
    with open(path, 'r', encoding='utf-8') as f:
        return sum(1 for _ in f)

def get_available_games():
    games = []
    for d in sorted(GAMES_DIR.iterdir()):
        if not d.is_dir():
            continue
        html = d / 'index.html'
        if html.exists():
            lines = count_lines(html)
            games.append({'name': d.name, 'lines': lines})
    return games

def ask_gemini(prompt, label=''):
    print(f"  → 呼叫 Gemini ({label})...")
    time.sleep(2)
    response = client.models.generate_content(
        model=MODEL,
        contents=prompt
    )
    return response.text.strip()

def parse_json_response(text):
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1]).strip()
    return json.loads(text)

# ── 主流程 ────────────────────────────────────────────
def step1_pick_target(claude_md, games):
    game_list = json.dumps(
        [f"{g['name']} ({g['lines']} 行)" for g in games],
        ensure_ascii=False
    )
    prompt = f"""你是遊戲品質優化專家。

以下是可用的遊戲清單（括號內是行數）：
{game_list}

以下是 CLAUDE.md 記錄的各遊戲優缺點分析：
---
{claude_md}
---

請挑選「一個遊戲」的「一個具體缺點」來修復。
優先選擇行數較少（≤ 900 行）的遊戲，修復成功率較高。
選的問題要是程式碼層面可以直接修改的。

回傳 JSON 格式（只回傳 JSON，不要其他文字）：
{{
  "game": "遊戲目錄名稱",
  "problem": "具體問題描述（一句話）",
  "fix_plan": "修復方式（一句話）"
}}"""
    raw = ask_gemini(prompt, '選擇目標')
    return parse_json_response(raw)

def step2_make_patch(game_code, target):
    prompt = f"""你是資深遊戲前端工程師。

遊戲：{target['game']}
問題：{target['problem']}
修復計畫：{target['fix_plan']}

以下是遊戲的完整程式碼：
---
{game_code}
---

請針對上面的問題，回傳「最小範圍」的修改。
使用 JSON 格式回傳（只回傳 JSON，不要其他文字）：
{{
  "patches": [
    {{
      "find": "要被取代的原始程式碼（必須是檔案中確實存在的文字）",
      "replace": "取代後的程式碼",
      "reason": "這個修改做了什麼"
    }}
  ],
  "summary": "本次修改摘要（一句話，用於 git commit message）"
}}

規則：find 必須完全一致出現在原始碼中，最多 3 個 patches。"""
    raw = ask_gemini(prompt, '產出修改')
    return parse_json_response(raw)

def step3_apply_patch(game_code, patch_data):
    code = game_code
    applied = []
    failed = []
    for i, patch in enumerate(patch_data['patches']):
        if patch['find'] in code:
            code = code.replace(patch['find'], patch['replace'], 1)
            applied.append(f"  ✅ Patch {i+1}: {patch['reason']}")
        else:
            failed.append(f"  ❌ Patch {i+1} 找不到目標: {patch['reason']}")
    return code, applied, failed

def step4_commit(game_path, game_name, summary):
    rel_path = game_path.relative_to(REPO_ROOT)
    subprocess.run(['git', 'add', str(rel_path)], cwd=REPO_ROOT, check=True)
    commit_msg = f"auto: [{game_name}] {summary}"
    result = subprocess.run(
        ['git', 'commit', '-m', commit_msg],
        cwd=REPO_ROOT, capture_output=True, text=True
    )
    if result.returncode == 0:
        print(f"  ✅ Commit 成功：{commit_msg}")
    else:
        print(f"  ❌ Commit 失敗：{result.stderr}")

# ── 主程式 ────────────────────────────────────────────
def main():
    print("=" * 50)
    print("CapyWorlds 自動品質提升")
    print("=" * 50)

    print("\n[1/4] 讀取 CLAUDE.md 和遊戲清單...")
    claude_md = read_file(CLAUDE_MD)
    games = get_available_games()
    print(f"  找到 {len(games)} 個遊戲")

    print("\n[2/4] 選擇優化目標...")
    target = step1_pick_target(claude_md, games)
    print(f"  遊戲：{target['game']}")
    print(f"  問題：{target['problem']}")
    print(f"  計畫：{target['fix_plan']}")

    game_path = GAMES_DIR / target['game'] / 'index.html'
    if not game_path.exists():
        print(f"  ❌ 找不到 {game_path}")
        sys.exit(1)

    game_code = read_file(game_path)
    print(f"  程式碼：{count_lines(game_path)} 行")

    print("\n[3/4] 產出定點修改...")
    patch_data = step2_make_patch(game_code, target)

    new_code, applied, failed = step3_apply_patch(game_code, patch_data)
    for msg in applied + failed:
        print(msg)

    if not applied:
        print("  ❌ 沒有 patch 成功，放棄")
        sys.exit(1)

    write_file(game_path, new_code)
    print(f"  已更新 {game_path.name}")

    print("\n[4/4] Git Commit...")
    step4_commit(game_path, target['game'], patch_data['summary'])

    print("\n" + "=" * 50)
    print("完成！執行 git log 確認，再決定是否 push。")
    print("=" * 50)

if __name__ == '__main__':
    main()
