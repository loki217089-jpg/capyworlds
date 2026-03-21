#!/usr/bin/env python3
"""
CapyWorlds 自動品質提升腳本
流程：讀取 CLAUDE.md 優缺點 → 挑選一個遊戲問題 → 定點修復 → git commit
"""

import os
import json
import subprocess
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # 沒裝 python-dotenv 也可以直接設環境變數

try:
    import google.generativeai as genai
except ImportError:
    print("請先執行：pip install google-generativeai python-dotenv")
    sys.exit(1)

# ── 設定 ──────────────────────────────────────────────
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    print("錯誤：找不到 GEMINI_API_KEY")
    print("請確認 .env 檔案內有 GEMINI_API_KEY=你的Key")
    sys.exit(1)

genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel('gemini-1.5-flash-latest')

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
    """列出有 index.html 的遊戲，過濾掉超大檔案"""
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
    """呼叫 Gemini，附帶簡單錯誤處理"""
    import time
    print(f"  → 呼叫 Gemini{f' ({label})' if label else ''}...")
    time.sleep(3)  # 避免 rate limit
    response = model.generate_content(prompt)
    return response.text.strip()

def parse_json_response(text):
    """從 Gemini 回應中解析 JSON（去除 markdown code block）"""
    text = text.strip()
    if text.startswith('```'):
        lines = text.split('\n')
        # 移除第一行（```json 或 ```）和最後一行（```）
        text = '\n'.join(lines[1:-1]).strip()
    return json.loads(text)

# ── 主流程 ────────────────────────────────────────────
def step1_pick_target(claude_md, games):
    """步驟一：讓 Gemini 從優缺點清單挑一個遊戲+問題"""
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
選的問題要是程式碼層面可以直接修改的（不是需要設計師決策的）。

回傳 JSON 格式（只回傳 JSON，不要其他文字）：
{{
  "game": "遊戲目錄名稱",
  "problem": "具體問題描述（一句話）",
  "fix_plan": "修復方式（一句話，說明要改什麼程式碼）"
}}"""

    raw = ask_gemini(prompt, '選擇目標')
    return parse_json_response(raw)

def step2_make_patch(game_code, target):
    """步驟二：讓 Gemini 產出定點修改（find/replace），不重寫整個檔案"""
    prompt = f"""你是資深遊戲前端工程師。

遊戲：{target['game']}
問題：{target['problem']}
修復計畫：{target['fix_plan']}

以下是遊戲的完整程式碼：
---
{game_code}
---

請針對上面的問題，回傳「最小範圍」的修改。
使用 JSON 格式回傳修改清單（只回傳 JSON，不要其他文字）：
{{
  "patches": [
    {{
      "find": "要被取代的原始程式碼片段（必須是檔案中確實存在的文字，包含足夠上下文讓我能唯一定位）",
      "replace": "取代後的程式碼",
      "reason": "這個修改做了什麼"
    }}
  ],
  "summary": "本次修改摘要（一句話，用於 git commit message）"
}}

重要規則：
- find 的內容必須在原始程式碼中「完全一致」出現
- 每個 patch 盡量小，不要整段重寫
- 最多 3 個 patches
"""

    raw = ask_gemini(prompt, '產出修改')
    return parse_json_response(raw)

def step3_apply_patch(game_code, patch_data):
    """步驟三：套用 find/replace patches"""
    code = game_code
    applied = []
    failed = []

    for i, patch in enumerate(patch_data['patches']):
        find_str = patch['find']
        replace_str = patch['replace']

        if find_str in code:
            code = code.replace(find_str, replace_str, 1)
            applied.append(f"  ✅ Patch {i+1}: {patch['reason']}")
        else:
            failed.append(f"  ❌ Patch {i+1} 找不到目標文字：{patch['reason']}")

    return code, applied, failed

def step4_commit(game_path, game_name, summary):
    """步驟四：git add + commit"""
    rel_path = game_path.relative_to(REPO_ROOT)
    subprocess.run(['git', 'add', str(rel_path)], cwd=REPO_ROOT, check=True)

    commit_msg = f"auto: [{game_name}] {summary}"
    result = subprocess.run(
        ['git', 'commit', '-m', commit_msg],
        cwd=REPO_ROOT,
        capture_output=True, text=True
    )

    if result.returncode == 0:
        print(f"  ✅ Commit 成功：{commit_msg}")
        return True
    else:
        print(f"  ❌ Commit 失敗：{result.stderr}")
        return False

# ── 主程式 ────────────────────────────────────────────
def main():
    print("=" * 50)
    print("CapyWorlds 自動品質提升")
    print("=" * 50)

    # 讀取素材
    print("\n[1/4] 讀取 CLAUDE.md 和遊戲清單...")
    claude_md = read_file(CLAUDE_MD)
    games = get_available_games()
    print(f"  找到 {len(games)} 個遊戲")

    # 挑選目標
    print("\n[2/4] 選擇優化目標...")
    target = step1_pick_target(claude_md, games)
    print(f"  遊戲：{target['game']}")
    print(f"  問題：{target['problem']}")
    print(f"  計畫：{target['fix_plan']}")

    # 讀取遊戲程式碼
    game_path = GAMES_DIR / target['game'] / 'index.html'
    if not game_path.exists():
        print(f"  ❌ 找不到 {game_path}")
        sys.exit(1)

    game_code = read_file(game_path)
    print(f"  程式碼：{count_lines(game_path)} 行")

    # 產出修改
    print("\n[3/4] 產出定點修改...")
    patch_data = step2_make_patch(game_code, target)

    # 套用修改
    new_code, applied, failed = step3_apply_patch(game_code, patch_data)

    for msg in applied:
        print(msg)
    for msg in failed:
        print(msg)

    if not applied:
        print("  ❌ 沒有任何 patch 成功套用，放棄本次修改")
        sys.exit(1)

    # 寫回檔案
    write_file(game_path, new_code)
    print(f"  已更新 {game_path.name}")

    # Commit
    print("\n[4/4] Git Commit...")
    step4_commit(game_path, target['game'], patch_data['summary'])

    print("\n" + "=" * 50)
    print("完成！請用 git log 確認 commit，再決定是否 push。")
    print("=" * 50)

if __name__ == '__main__':
    main()
