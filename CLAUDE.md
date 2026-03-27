# CapyWorlds — Claude 開發指引（2026/3/25 更新）

## 分支策略規則（最優先執行）

**判斷要不要開分支：**

| 情境 | 做法 |
|------|------|
| 小修改（修 bug、調 UI、更新 CLAUDE.md、加遊戲卡片）預估 < 50 行 | 直接在 main 改，`git push origin main` |
| 新遊戲 / 新功能 / 預估 > 50 行 | 開 `claude/` 分支，**同一 session 結束前合回 main** |
| 跨 session 的大型工作 | 每次開 session 先 `git rebase origin/main`，結束前 push |

**黃金規則**：任何 `claude/` 分支不得跨 session 存活超過 24 小時。Session 結束前必須合回 main。

---

## Push 衝突預防規則（最優先執行）

**每次 `git push` 到任何分支之前**，Claude 必須先執行預檢：

```bash
# 1. 取得最新 main
git fetch origin main

# 2. 乾跑合併，確認有無衝突（不真正 commit）
git merge --no-commit --no-ff origin/main 2>&1
git merge --abort 2>/dev/null   # 不管成不成功，都立刻中止
```

**判斷與處理：**

| 結果 | 行動 |
|------|------|
| 無衝突 | 直接 push，不需告知 |
| 有衝突（Merge conflict） | **先 rebase** → 解決衝突 → push，事後告知「已預先解決衝突 ✅」 |
| origin/main 落後於 HEAD | 無衝突風險，直接 push |

**強制順序**（缺一不可）：

```
fetch origin main
  → 乾跑 merge 確認衝突
    → 若有衝突 → rebase + 解決
      → git push
```

**不需要問**：全程自動執行，只有遇到無法自動解決的衝突才暫停報告。

---

## Push 後自動衝突檢查規則（最優先執行）

**每次 `git push` 到 `claude/` 分支後**，Claude 必須立即執行以下流程：

1. **檢查 PR 是否有衝突**：
   ```bash
   git fetch origin main
   git merge-base --is-ancestor origin/main HEAD
   # 若回傳非 0 → 表示 main 有新 commit，需要 rebase
   ```
2. **若有衝突**：
   - `git rebase origin/main`
   - 逐一解決 conflict（保留雙方有意義的改動）
   - `git push --force-with-lease origin <branch>`
3. **不需要問**：直接執行，事後報告「已解決衝突並重新推送 ✅」
4. **若 rebase 過程失敗**：報告具體衝突檔案，請使用者確認解法

---

## Push 到 main 後殘留 PR 清理規則（最優先執行）

**每次 `git push origin main` 成功後**，Claude 必須立即執行以下流程：

1. **列出所有 Open 狀態的 PR**：
   - 用 GitHub MCP 工具 `list_pull_requests` 查詢 state=open
2. **對每個 Open PR 判斷**：
   - 若 PR 的 `head` 分支變更**已全部包含在 main** → 直接**關閉** PR
   - 若 PR 的 `head` 分支有 main 沒有的新 commit → **更新分支**（rebase onto main），解決衝突後 push
3. **不需要問**：直接執行，事後報告：
   - 「已關閉過時 PR #XX ✅」
   - 「已更新 PR #XX 分支（rebase + 解決衝突）✅」
4. **這確保**：不會有殘留的衝突 PR 卡在 GitHub 上

---

## 新 Session 自動合併規則（最優先執行）

**每次開新 session 時**，Claude 必須主動執行以下流程：

1. **檢查是否有未合併的 `claude/` 分支**：
   ```bash
   git branch -r --no-merged origin/main | grep "origin/claude/"
   ```
2. **若有未合併分支**：
   - 先 `git fetch origin main` 取得最新 main
   - 切換到該分支，嘗試 `git merge origin/main`
   - 若有 conflict → 自動解決（保留雙方有意義的改動）
   - 合併後 push 到該分支
   - 用 GitHub MCP 工具合併 PR 到 main（若 PR 存在）
   - 若無 PR，直接 `git checkout main && git merge <branch> && git push origin main`
3. **合併完成後告知使用者**：「已把 `claude/xxx` 合併進 main ✅」
4. **不需要問**：直接執行，事後報告即可

---

## Context 壓縮保護規則（最優先執行）

**問題根因**：對話過長時，系統會自動壓縮舊訊息，設計討論細節會消失。

### 強制流程：設計討論 → 立即存檔

1. **每次遊戲設計討論結束後**，Claude 必須主動說：「要把這次討論存進設計文件嗎？」
2. **有新遊戲開發時**，在 `games/<name>/DESIGN.md` 存設計草稿
3. **重要決策確認後**，立即 append 進該遊戲的 DESIGN.md，不等到最後
4. **不需要問**：若討論中出現 Boss 機制、升級樹、核心玩法變更等重要細節，直接存，事後告知

### 各遊戲設計文件位置

| 遊戲 | 設計文件 |
|------|---------|
| 世界航道 | `games/sea-route/DESIGN.md` |
| （新遊戲依此格式新增） | |

---

## 大型檔案寫入規則（最優先執行）

**問題根因**：`Write` 工具或 Agent 的單次輸出有 token 上限（約 21,000 tokens）。
當需要產生的檔案超過這個上限時，工具會觸發 `max_tokens` 錯誤並進入重試迴圈，導致浪費大量時間卻沒有產出。

### 強制規則：讀完規格 → 先切分，再動手

任何預估超過 **400 行**的新檔案，**必須**按以下流程處理：

```
1. 讀完規格 / 釐清需求
2. 規劃所有區塊，確認每塊 <= 200 行
3. 建立空白檔（或寫入第一個區塊）
4. 用 Bash cat >> file 依序 append 後續區塊
5. 每個區塊寫完後確認行數，再繼續下一塊
```

### 區塊切法參考

| 檔案類型 | 建議切分點 |
|----------|-----------|
| 單頁 HTML 遊戲 | HTML/CSS -> 常數/工具函式 -> 世界生成 -> 玩家/敵人 -> 渲染 -> HUD/UI -> 主迴圈 |
| 長 JS 模組 | imports -> types/constants -> 各功能函式群 -> exports |
| 長 CSS | reset/vars -> layout -> components -> animations |

### 禁止事項

- 不可用單一 Write 工具呼叫寫超過 400 行的內容
- 不可啟動背景 Agent 去「一口氣」寫整個大型檔案
- 發現 max_tokens 錯誤後不可重試相同的 Write 呼叫

---

## 專案結構

```
/                        根目錄
  index.html             首頁（928行）— 導航、水豚吉祥物、主題切換、AdSense
  about.html / blog.html / books.html / tools.html
  games.html             重新導向到 games/index.html
  wrangler.jsonc         Cloudflare Workers 主設定（active）
  wrangler.toml          Workers 舊設定（legacy）
  games/
    index.html           遊戲清單頁（卡片式列表，~717行）
    mobile.html          手遊專區（觸控優化精選，~318行）
    deep-diggers.html    單檔遊戲（例外）
    <game-name>/index.html  每款遊戲的唯一入口
  worker/index.js        Cloudflare Worker 後端（留言/排行榜/彈幕/流量追蹤）
  .github/workflows/deploy.yml  CI/CD 自動部署（push main → wrangler deploy）
  analytics/index.html   流量分析儀表板（需 ADMIN_KEY 登入）
  assets/                素材庫（~180 MB，~10,600 檔）
    PostApocalypse_AssetPack_v1.1.2/
    sfx/                 GameSFX0~3 四個子資料夾
    JDSherbert Minigame Music/
    Sunnyside World/     74 MB 農村素材
    Pixel Art Gem Pack - Animated/
    instruments/
```

---

## 遊戲新增流程

1. 在 `games/<game-name>/` 建立目錄 + `index.html`
   - **必須加隱私權連結**（`</body>` 前）：
     ```html
     <div style="position:fixed;bottom:4px;left:8px;z-index:9999;opacity:0.4;font-size:10px"><a href="/privacy.html" target="_blank" style="color:#888;text-decoration:none">Privacy Policy</a></div>
     ```
   - **必須有 localStorage 存檔**（如果遊戲有進度/升級/分數）
   - **必須有簡易新手教學**：首次進入顯示教學覆蓋層（3~5 步驟，icon + 標題 + 說明），用 localStorage 記住已看過。教學內容需雙語。
2. 在 `games/index.html` 加入遊戲卡片（參考現有格式）
3. 若為觸控友善遊戲，同步加入 `games/mobile.html`
4. commit -> push 到指定 `claude/` 分支

### 遊戲卡片標準格式（games/index.html）

```html
<a class="game-card" href="<game-name>/"
   style="--card-accent:#XXXXXX; --banner-bg:#XXXXXX; --banner-glow:rgba(R,G,B,0.28);">
  <div class="card-banner">
    <div class="game-emoji">emoji</div>
  </div>
  <div class="card-body">
    <div class="game-title">遊戲名稱</div>
    <div class="game-desc">2~3 行說明文字</div>
    <div class="tags">
      <span class="tag" style="color:#X;border-color:rgba(R,G,B,0.4);background:rgba(R,G,B,0.1);">標籤</span>
    </div>
  </div>
  <div class="card-footer">
    <span class="play-btn" style="color:#XXXXXX;">▶ 開始遊戲</span>
  </div>
</a>
```

### 各遊戲配色參考

| 遊戲 | emoji | --card-accent | 風格 |
|------|-------|---------------|------|
| 水豚小村 | 🦫 | #f0c040 | 暖金 |
| 水豚跑酷 | 🦫 | #ffd700 | 亮金 |
| 每日一題RPG | 📚 | #00e5ff | 青 |
| 進化蚊子 | 🦟 | #e8a020 | 橘 |
| Deep Diggers | ⛏️ | #f5a623 | 橘 |
| 地球再生 | 🌍 | #44ee88 | 翠綠 |
| 殭屍蔓延 Idle | 🧟 | #3ddc58 | 綠 |
| 末日求生 | ☣ | #44ff88 | 螢光綠 |
| VIRUS.EXE | 🦠 | #00e060 | 青綠 |
| 虛空領航員 | 🚀 | #4af8ff | 青 |
| 勇者傳說 | ⚔️ | #9060ff | 紫 |
| 節拍戰士 | ⚔ | #a060ff | 紫 |
| 戰鬥陀螺 | 🌀 | #aa44ff | 藍紫 |
| 機甲蟲蟲危機 | 🐛 | #60d040 | 綠 |
| 農場三消 | 🌾 | #f5a623 | 橘 |
| FPS 射擊 | 🔫 | #ff4444 | 紅 |
| 斬魔忍者 | ⚔️ | #ff6644 | 橘紅 |

---

## 提示框 / 通知 / 彈窗安全規則

所有 `position:fixed/absolute` 的提示框必須不超出可視範圍：

1. **頂部留白**：有 header+ticker → `top: 80px`；只有 header → `top: 56px`；無 header → `top: 20px`
2. **橫向不溢出**：`max-width: min(400px, calc(100vw - 32px))`
3. **彈窗高度**：`max-height: 88vh; overflow-y: auto`
4. **tooltip** 要用 JS 確認不超出 viewport（getBoundingClientRect 檢查）

---

## Sprite Sheet 裁切規則（最優先執行）

**問題根因**：Claude 無法開瀏覽器，用估算座標切 sprite 必定出錯。

### 強制流程：量測 → 定位 → 驗證

1. **先用 `file` 指令取得圖片實際尺寸**（`file assets/xxx.png` → 得到 `1536 x 1024`）
2. **用 Read 工具看圖片**，對照尺寸估算每個 sprite 的中心座標 (cx, cy)
3. **寫完定位函式後，必須用 Read 重新看圖片**，人眼確認座標合理
4. **不可用百分比猜測定位**（`background-position: 24.5% 38%` 這種寫法禁止）

### 正確做法：像素級定位公式

```javascript
// 圓形頭像裁切（從合圖裁出一個角色）
function getCharPortraitStyle(c, displaySize) {
  const cropR = 110; // 要顯示的源圖半徑（像素）
  const scale = displaySize / (cropR * 2);
  const bgW = Math.round(sheetW * scale);
  const bgH = Math.round(sheetH * scale);
  const bgX = Math.round(-(c.cx - cropR) * scale);
  const bgY = Math.round(-(c.cy - cropR) * scale);
  return `background-image:url('sheet.png');`
    + `background-size:${bgW}px ${bgH}px;`
    + `background-position:${bgX}px ${bgY}px;`;
}
```

### 場景背景裁切

| 情境 | 做法 |
|------|------|
| 場景佔圖片的一個象限 | `background-size:cover; background-position:75% 20%`（用百分比指向象限中心） |
| 場景排成一列（如 4 格） | 計算精確 `background-size` 和 `background-position`，用 px 值 |

### 禁止事項

- **不可**用估算座標直接 push，必須先 Read 圖片目視確認
- **不可**用 `background-size:560%` 這種放大倍率猜測
- **不可**混用百分比和像素（選一種，整個專案統一）
- 發現裁切錯誤後**不可**微調 ±5px 試運氣，要重新看圖量測

---

## 音效規範

- **即時動作音效 <= 300ms**（撿道具、升級、購買、射擊、受傷等一瞬間的動作）
- 加入音效時，若音檔時長超過 300ms，必須傳入截斷毫秒數（maxMs）
  - 例：`audio.play('pickup', 0.7, 1, 220)` -> 只播前 220ms
- 背景音樂、爆炸長尾音、環境音不受此限制

---

## 技術約束

- 所有遊戲都是純前端，無外部依賴（無 npm、無框架）
- 每款遊戲只有一個 `index.html`（CSS 與 JS 全部 inline）
- 語言：繁體中文 + 英文雙語（**預設英文**，右上角切換按鈕「繁中 / EN」，切換後 i18n 物件全部替換文字）
  - **⚠️ CrazyGames 強制要求英文為預設語言**（2026/3/27 被拒教訓）
  - `let lang = localStorage.getItem('xxxLang') || 'en'` — 必須 fallback 到 `'en'`
  - HTML 初始內容也必須是英文（applyLang 會覆蓋，但 CG 審核看的是初始載入畫面）
- **⚠️ 雙語文字出框**：英文通常比中文長 1.5～2 倍，製作或修改 UI 時兩種語言都要確認
  - **視覺舒適度優先**：優先調大容器或改排版，其次縮短文案，最後才用壓縮（`fillText maxWidth` / CSS truncate）
  - 壓縮後若文字明顯變形，就該改排版，不是硬塞
- 視覺風格跟隨現有設計（深色背景、金色/青色強調色）
- 手機遊戲：Canvas 必須用 JS 縮放填滿螢幕
- `touch-action: none` 只加在 canvas 元素，不加在 body
- 遊戲存檔用 localStorage，跨遊戲連動也用 localStorage
- **⚠️ 新遊戲必須有 localStorage 存檔**：任何有進度/升級/分數的遊戲，必須在建立時就加入 `localStorage.setItem` 存檔 + `localStorage.getItem` 讀取，不可事後補。CrazyGames 上架需要選擇存檔方式。

### 各遊戲存檔狀態（2026/3/26 掃描）

| 遊戲 | 存檔 | 備註 |
|------|------|------|
| mosquito | ✅ 14 refs | Prestige + 升級 + 血量 + 成就 |
| hero | ✅ 6 refs | 角色/裝備/技能 |
| space-roguelike | ✅ 5 refs | Meta 升級 |
| sunnyside-farm | ✅ 7 refs | 農場 + 生態 + 升級 |
| village | ✅ 3 refs | 村民 + 裝飾 |
| virus | ✅ 4 refs | 進度 |
| sea-route | ✅ 4 refs | 航線 + 升級 |
| zombie-idle | ✅ 2 refs | DNA + 分數 |
| capy-runner | ✅ 4 refs | 高分 |
| daily-quiz-rpg | ✅ 2 refs | 角色 |
| farm-match | ✅ 2 refs | 卡片 |
| beat-warrior | ❌ 缺 | **需補**：關卡進度 |
| beyblade | ❌ 缺 | **需補**：零件收集 |
| deep-diggers | ❌ 缺 | **需補**：升級樹 |
| earth-civilization | ⚠️ 只有 get | **需補**：缺 setItem |
| bug-crisis | ❌ 缺 | 每局獨立，可選 |
| fps | ❌ 缺 | 每局獨立，可選 |

---

## 手機遊戲 UI 佈局規則（最優先執行）

> **問題根因**：固定定位的按鈕（返回/靜音/語言/暫停）各自 `position:fixed`，在不同手機尺寸下會重疊、遮住 HUD。

### 強制規則：使用 Flexbox 三段式佈局

所有手機 Canvas 遊戲 **必須** 使用以下佈局結構：

```html
<body style="display:flex;flex-direction:column;height:100vh;height:100dvh">
  <!-- 1. 頂部工具列 -->
  <div class="top-bar" style="position:relative;z-index:200;flex-shrink:0">
    <a href="../">← 返回</a>
    <div class="btn-group">
      <button>繁中/EN</button>
      <button id="pause-btn">⏸</button>
      <button id="mute-btn">🔊</button>
    </div>
  </div>
  <!-- 2. 遊戲區域 -->
  <div class="game-area" style="flex:1;overflow:hidden;min-height:0">
    <canvas id="game"></canvas>
  </div>
  <!-- 3. 底部操作列 -->
  <div class="action-bar" style="position:relative;z-index:200;flex-shrink:0">...</div>
</body>
```

### 必做事項（缺一個就會出 bug）

| 項目 | 做法 | 不做的後果 |
|------|------|-----------|
| **body 高度** | `height:100vh;height:100dvh`（兩行，dvh 覆蓋 vh） | 手機網址列佔空間，底部按鈕被切掉 |
| **top-bar / action-bar** | `position:relative; z-index:200; flex-shrink:0` | Canvas 的 touch 事件攔截按鈕，按不了 |
| **game-area** | `flex:1; min-height:0; overflow:hidden` | Canvas 溢出撐開頁面，底部被推出螢幕 |
| **Canvas resize** | 基於 `.game-area` 的 `clientWidth/clientHeight` | 用 `window.innerHeight` 會包含被工具列佔的空間 |
| **Canvas touch-action** | `touch-action:none` 只加在 `<canvas>` | 加在 body 會讓所有按鈕 tap 失效 |

### 禁止事項

- **不可**對返回/靜音/語言/暫停按鈕使用 `position:fixed`（會重疊）
- **不可**對 Canvas 使用 `position:absolute; top:0`（會被工具列遮住）
- **不可**用 `100vh` 不加 `100dvh`（手機瀏覽器網址列會導致溢出）
- **不可**省略 top-bar/action-bar 的 `z-index`（Canvas touch 會攔截按鈕）
- **不可**省略 game-area 的 `min-height:0`（flex 子元素不會正確收縮）

### Canvas 定位規則（踩坑教訓）

> **Claude 無法開瀏覽器測試**，所以手機觸控問題必須第一次就寫對，不能靠來回修正。

- Canvas **必須**用 `position:absolute; top:50%; left:50%; transform:translate(-50%,-50%)` 定位在 game-area 內
- **必須**加 `max-width:100%; max-height:100%` — 防止 Canvas 溢出 game-area 攔截按鈕觸控
- resize 函式也要 `Math.min(w, availW)` / `Math.min(h, availH)` 做 clamp
- **不可**讓 Canvas 作為 flex 子元素參與佈局（會撐大 game-area，擠壓 action-bar 的觸控區域）
- **不可**在 body 加 `user-select:none`（某些 Android Chrome 會阻擋 button 觸控）
- 按鈕事件用 JS `addEventListener` 綁定，不用 inline `ontouchend`（某些手機瀏覽器不可靠）

> ⚠️ **`overflow:hidden` 陷阱**：`overflow:hidden` 只隱藏視覺渲染，**不會阻擋觸控事件**。Canvas 即使被裁切看不到，溢出部分仍然會攔截 touch/click 事件，導致底部按鈕按不了。所以**必須**用 `max-width/max-height` 從 DOM 層面限制尺寸。

### 字體規則

- **不可**使用 VT323 作為主字體（英文像素字體，中文會 fallback 到系統字體，兩種風格混搭不協調）
- 正確字體：`'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif`
- Canvas 內的 `ctx.font` 也用 `sans-serif`（不是 `VT323`）
- 中文字體最小 12px，英文最小 11px，低於此尺寸在手機上難以閱讀

### Canvas HUD 字體大小參考

| 用途 | 大小 | 粗細 |
|------|------|------|
| 遊戲標題 | 24-28px | bold |
| HUD 數值（分數、天數） | 14-16px | bold |
| 資源列（木材、石頭等） | 13-14px | normal |
| 小提示 / 說明文字 | 12-13px | normal |
| 通知訊息 | 14-16px | normal |

### 預設 UI 結構參考（商業手遊標準）

> 以下為手機遊戲的 **預設畫面結構**，新遊戲優先採用此佈局。
> 參考來源：主流手遊（Idle RPG / 放置類 / 關卡制）共通的 UI 框架。

#### 五層結構（由上而下）

```
┌─────────────────────────────────┐
│ ① 頂部 HUD 列                   │  固定，flex-shrink:0
│  [頭像+名字+戰力] [體力|金幣|寶石] │  左=玩家資訊，右=資源列
├─────────────────────────────────┤
│                                 │
│ ② 主內容區（flex:1）              │  關卡選擇 / Boss 展示 / 地圖
│    關卡名稱 + WAVE 標籤           │  左右箭頭切換關卡
│    怪物/Boss 立繪（置中聚光）      │
│    獎勵預覽 icon（寶箱/金袋）      │
│                                 │
├─────────────────────────────────┤
│ ③ 行動資訊條                     │  獎勵摘要（如「通關獎勵：💎×50」）
├─────────────────────────────────┤
│ ④ CTA 大按鈕                    │  黃色/亮色，佔寬 80%，文字大
│    「⚡5  開始冒險」              │  顯示消耗資源 + 動作文字
├─────────────────────────────────┤
│ ⑤ 底部 Tab 導航列                │  固定，flex-shrink:0
│  [技能] [裝備] [戰鬥] [抽卡] [商店]│  5 個 icon+文字，當前頁高亮
│  紅點通知（有未領獎勵時顯示）       │
└─────────────────────────────────┘
```

#### 各層實作要點

| 層 | 高度建議 | 關鍵 CSS / 做法 |
|----|---------|----------------|
| ① 頂部 HUD | 48-56px | `flex-shrink:0; z-index:200;` 背景半透明深色 |
| ② 主內容區 | `flex:1; min-height:0` | 可滾動或固定，視遊戲類型決定 |
| ③ 行動資訊條 | 40-48px | 深色半透明底，左 icon 右文字 |
| ④ CTA 按鈕 | 56-64px | 圓角大按鈕，`width:80%; margin:0 auto;` 亮色背景 |
| ⑤ 底部 Tab | 56-64px | `flex-shrink:0; z-index:200;` 均分 5 欄，icon 上文字下 |

#### CTA 按鈕設計規範

- 背景色用 **高對比亮色**（黃 `#FFD700` / 橘 `#FF8C00` / 綠 `#44DD66`）
- 左側顯示消耗資源 icon + 數量，右側顯示動作文字
- 按鈕高度 ≥ 52px，文字 ≥ 18px bold
- 點擊回饋：scale(0.95) + 0.1s transition

#### 底部 Tab 導航規範

- 固定 5 個 tab（可依遊戲調整：主頁/角色/戰鬥/商店/設定）
- 當前 tab 用 accent 色高亮 + 放大 icon
- 紅點通知：`position:absolute; top:2px; right:2px; width:8px; height:8px; background:red; border-radius:50%;`
- icon 用 emoji 或 Canvas 繪製，不依賴外部圖片

#### 頂部 HUD 資源列規範

- 資源 icon 在左，數字在右，間距 4px
- 常見資源排列：體力（綠）→ 金幣（黃）→ 寶石（藍/紫）
- 玩家頭像 40×40px，圓角或圓形，帶等級 badge
- 戰力/分數用較小字體放在名字下方

#### 適用遊戲類型

| 類型 | 是否適用 | 調整方式 |
|------|---------|---------|
| 放置 RPG / Idle | 最適合 | 直接套用 |
| 關卡制動作 | 適合 | ② 改為關卡地圖 |
| 跑酷 / 即時動作 | 部分適用 | 進入關卡後隱藏 ③④⑤，全螢幕 Canvas |
| 經營模擬 | 部分適用 | ② 改為經營畫面，⑤ 改為功能 tab |
| 純 Canvas 街機 | 不適用 | 維持原有三段式佈局 |

---

## 手機遊戲開發要點

**Canvas 縮放模板：**
```javascript
function resizeAll() {
  const SCALE = Math.min(window.innerWidth/GW, window.innerHeight/GH);
  canvas.style.width  = GW * SCALE + 'px';
  canvas.style.height = GH * SCALE + 'px';
  canvas.style.left   = (window.innerWidth  - GW*SCALE)/2 + 'px';
  canvas.style.top    = (window.innerHeight - GH*SCALE)/2 + 'px';
}
window.addEventListener('resize', resizeAll);
```

**觸控規則：**
- `touch-action: none` 只加在 canvas 元素（加在 body 會讓按鈕 tap 失效）
- 按鈕同時加 `ontouchend="handler(event)"` 和 `addEventListener('click', ...)`
- 滑動判斷用 touchstart/touchend delta
- Overlay/UI 元素需用 JS 同步設定 position/size，與 canvas 對齊

---

## 主題系統

三種主題，所有頁面都支援，用 `data-theme` attribute 切換：

```css
:root {                     /* 深色（預設）*/
  --bg: #13100c;  --bg2: #1e1812;  --accent: #c8a456;
  --text: #e8ddd0;  --h1: #ffffff;
}
[data-theme="light"] { --bg: #f5f0e8;  --accent: #9a6e1e;  --text: #2a1e0e; }
[data-theme="pink"]  { --bg: #1a0810;  --accent: #e060a8;  --text: #f8d8ec; }
```

JS: `document.documentElement.setAttribute('data-theme', t)` + `localStorage.setItem('theme', t)`

---

## 後端 API（Cloudflare Worker）

| 端點 | 方法 | 說明 |
|------|------|------|
| `/comments` | GET/POST/DELETE | 留言系統（name<=50, content<=500） |
| `/leaderboard/:game` | GET/POST | 排行榜前 10 |
| `/danmaku` | GET/POST | 彈幕（text<=40, color: hex） |
| `/t` | POST | 流量追蹤（自動收集 path/referrer/UA/country/screen/sid） |
| `/t/data` | GET | 流量查詢 API（需 Bearer ADMIN_KEY，支援 q=overview/daily/hourly/pages/countries/devices/referrers/languages） |

資料庫：Cloudflare D1（`capyworlds-comments`）

### CI/CD 自動部署

- **GitHub Actions workflow**：`.github/workflows/deploy.yml`
- **觸發條件**：push to `main`
- **動作**：自動執行 `wrangler deploy`
- **所需 Secret**（已設定 ✅）：
  - `CLOUDFLARE_API_TOKEN` — Cloudflare API 權杖（Edit Workers 權限）
  - `CLOUDFLARE_ACCOUNT_ID` — Cloudflare 帳戶 ID
- **效果**：合併 PR 或 push to main 後，不需要手動跑 `npx wrangler deploy`

---

## 素材庫總覽

| 資料夾 | 用途 |
|--------|------|
| `PostApocalypse_AssetPack_v1.1.2/` | 末日：主角（Idle/Run/Death/Punch）、殭屍3種、物件/Tile/音效/音樂 |
| `sfx/GameSFX0~3/` | 分類音效庫（撿道具、升級、爆炸、UI 音等） |
| `JDSherbert Minigame Music/` | 背景音樂迴圈 |
| `Sunnyside World/` | 農村/村落素材 74MB（tile、NPC、建築） |
| `Pixel Art Gem Pack - Animated/` | 10 種寶石動畫 + 火花效果 |
| `instruments/` | 樂器取樣音源 |
| `Robot Warfare Asset Pack/` | 機甲：Soldiers×7、Robots×5、Effects、Projectiles |
| `Pixel Crawler Free Pack 2.0.4/` | 地城：怪物 sprite、地板、效果 |

---

## 新遊戲建置：素材配置清單

> 開一款新遊戲時，先從這張表決定要用哪些素材，路徑都以 `../../assets/` 為根目錄。

---

### 🎵 背景音樂（BGM）配置

| 遊戲氛圍 | 推薦音樂包 | 代表曲目 | 格式 |
|----------|-----------|---------|------|
| 輕鬆 / 休閒 / 農村 | `JDSherbert - Minigame Music Pack [FREE]/` | Beach Vibes, Refreshing Dawn | .ogg |
| 奇幻 / RPG | `Fantasy RPG Music Pack Vol.3/Loops/ogg/` | Action 1~5 Loop, Ambient 1~10 Loop | .ogg |
| 中世紀 / 冒險 | `Medieval Vol. 2/ogg/` | Medieval Vol. 2 1~8.ogg | .ogg |
| 環境 / 海洋 / 放置 | `10 Ambient RPG Tracks/ogg/` | Ambient 1~10.ogg | .ogg |
| 賽博龐克 / 現代 | `Urban Modern/` | urban-light-bed-loop, modern-electronic-waves | .mp3 |
| 恐怖 / 末日 | `retroindiejosh_mp06-horror_ogg/` | — | .ogg |
| 🎹 鋼琴輕音樂 | `Game Piano Music/` | — | — |
| 科幻 / 太空 | ❌ **缺少** | 需補充 | — |
| 節日 / 歡慶 | ❌ **缺少** | 需補充 | — |
| 戰鬥 / Action | ❌ **缺少**（目前只有 RPG 循環） | 需補充 | — |

**BGM 使用模板：**
```javascript
// 遊戲路徑：games/<game>/index.html → 素材根：../../assets/
startBGM('../../assets/music/JDSherbert - Minigame Music Pack [FREE]/JDSherbert - Minigame Music Pack - Beach Vibes.ogg');
```

---

### 🔊 音效（SFX）配置

> 規則：即時動作音效 ≤ 300ms，超過需傳 maxMs 截斷

#### 常見事件對應表

| 觸發事件 | 推薦音效檔 | 路徑 | maxMs |
|----------|-----------|------|-------|
| 撿道具 / 收集 | `coin_collect.wav` | `sfx/400 Sounds Pack/Items/` | 280 |
| 稀有道具 / 手動收集 | `gem_collect.wav` | `sfx/400 Sounds Pack/Items/` | 280 |
| 購買 / 確認 | `synth_confirmation.wav` | `sfx/400 Sounds Pack/UI/` | 260 |
| 取消 / 返回 | `cancel.wav` | `sfx/400 Sounds Pack/UI/` | 200 |
| 錯誤 / 不可操作 | `8_bit_negative.wav` | `sfx/400 Sounds Pack/Musical Effects/` | 300 |
| 升級 / 強化 | `Retro PowerUP 09.wav` | `sfx/GameSFX3/PowerUp/` | 280 |
| 進度上升提示 | `Retro Ascending Short 20.wav` | `sfx/GameSFX0/Ascending/` | 250 |
| 跳躍 | `Retro Jump 01.wav` | `sfx/GameSFX1/Bounce Jump/` | 200 |
| 攻擊 / 受傷 | `Retro Impact Punch 07.wav` | `sfx/GameSFX2/Impact/` | 200 |
| 射擊 | `Retro Gun SingleShot 04.wav` | `sfx/GameSFX3/Weapon/` | 200 |
| 魔法技能 | `Retro Magic 06.wav` | `sfx/GameSFX2/Magic/` | 250 |
| 爆炸 | `（GameSFX1/Explosion/ 內取用）` | `sfx/GameSFX1/Explosion/` | 不截斷 |
| 關卡完成 / 通關 | `brass_level_complete.wav` | `sfx/400 Sounds Pack/Musical Effects/` | 不截斷 |
| 解鎖新內容 | `8_bit_level_complete.wav` | `sfx/400 Sounds Pack/Musical Effects/` | 不截斷 |
| Boss 擊中 | `vibraphone_chime_positive.wav` | `sfx/400 Sounds Pack/Musical Effects/` | 200 |
| Boss 失誤 | `8_bit_negative.wav` | `sfx/400 Sounds Pack/Musical Effects/` | 300 |
| UI 按鈕 hover | `select_1.wav` | `sfx/400 Sounds Pack/UI/` | 150 |
| Popup 開啟 | `JDSherbert - Ultimate UI SFX Pack - Popup Open - 1.ogg` | `sfx/JDSherbert - Ultimate UI SFX Pack (FREE)/…/Stereo/ogg/` | 不截斷 |
| Popup 關閉 | `JDSherbert - Ultimate UI SFX Pack - Popup Close - 1.ogg` | 同上 | 不截斷 |

**SFX 使用模板（複製進新遊戲）：**
```javascript
const AUDIO_CTX = new (window.AudioContext||window.webkitAudioContext)();
const AUDIO_BUFS = {};
let audioMuted = (localStorage.getItem('<game>Muted')==='1');
let bgmSource = null, bgmGain = null, bgmLoaded = false;

function loadAudio(name, url){
  fetch(url).then(r=>r.arrayBuffer()).then(ab=>AUDIO_CTX.decodeAudioData(ab))
    .then(buf=>{ AUDIO_BUFS[name]=buf; }).catch(()=>{});
}
function playAudio(name, vol=0.7, rate=1, maxMs=0){
  if(audioMuted) return;
  const buf=AUDIO_BUFS[name]; if(!buf) return;
  if(AUDIO_CTX.state==='suspended') AUDIO_CTX.resume();
  const src=AUDIO_CTX.createBufferSource();
  src.buffer=buf; src.playbackRate.value=rate;
  const gain=AUDIO_CTX.createGain(); gain.gain.value=vol;
  src.connect(gain); gain.connect(AUDIO_CTX.destination);
  src.start(0,0,maxMs>0?maxMs/1000:buf.duration);
}
function startBGM(url){
  if(bgmLoaded||audioMuted) return; bgmLoaded=true;
  fetch(url).then(r=>r.arrayBuffer()).then(ab=>AUDIO_CTX.decodeAudioData(ab)).then(buf=>{
    if(AUDIO_CTX.state==='suspended') AUDIO_CTX.resume();
    bgmSource=AUDIO_CTX.createBufferSource();
    bgmSource.buffer=buf; bgmSource.loop=true;
    bgmGain=AUDIO_CTX.createGain(); bgmGain.gain.value=0.22;
    bgmSource.connect(bgmGain); bgmGain.connect(AUDIO_CTX.destination);
    bgmSource.start();
  }).catch(()=>{});
}
function toggleMute(){
  audioMuted=!audioMuted;
  if(bgmGain) bgmGain.gain.value=audioMuted?0:0.22;
  document.getElementById('mute-btn').textContent=audioMuted?'🔇':'🔊';
  localStorage.setItem('<game>Muted',audioMuted?'1':'0');
  if(!audioMuted&&!bgmLoaded) startBGM(BGM_URL);
}
// 在 init() 裡加：
// if(audioMuted) document.getElementById('mute-btn').textContent='🔇';
// const startOnce=()=>{ startBGM(BGM_URL); document.removeEventListener('click',startOnce); document.removeEventListener('touchend',startOnce); };
// document.addEventListener('click',startOnce); document.addEventListener('touchend',startOnce);
```

---

### 🎨 圖片 / Sprite 配置

| 遊戲類型 | 推薦素材包 | 路徑 | 內容 |
|----------|-----------|------|------|
| 農場 / 村落 | Sunnyside World | `images/Sunnyside World/` | 建築、NPC、地板、植物、農業 |
| 末日 / 生存 | PostApocalypse | `packs/PostApocalypse_AssetPack_v1.1.2/` | 主角、殭屍3種、廢墟 tile |
| 機甲 / 戰爭 | Robot Warfare | `packs/Robot Warfare Asset Pack 24-11-21/` | 士兵×7、機器人×5、子彈、爆炸 |
| RPG / 地城 | Pixel Crawler | `images/Pixel Crawler - Free Pack 2.0.4/` | 怪物、地板、效果 |
| 奇幻角色 | Tiny RPG Character | `images/Tiny RPG Character Asset Pack v1.03b…/` | 士兵、獸人 spritesheet |
| 農夫 / 人物 | Mana Seed Farmer | `images/Mana Seed Farmer Sprite Free Sample/` | 農夫動畫 |
| 森林 / 奇幻環境 | mystic_woods | `images/mystic_woods_free_2.2/` | 樹木、灌木、環境 |
| Roguelike 綜合 | 32rogues | `images/32rogues-1/` `images/32rogues-2/` | 多樣素材 |
| 小動物 | critters | `images/critters/` | 動物 sprite |
| 寶石 / 礦物 | Pixel Art Gem Pack | `Pixel Art Gem Pack - Animated/` | 10種×8色寶石動畫 + 火花 |
| 物品圖標（商店用） | Pixel_Mart | `Pixel_Mart/` | 150個物品 PNG |
| UI 通用圖標 | Icons_Essential | `images/Icons_Essential/Icons/` | 80個像素 icon（Coin, Book, Chest…） |
| 魔法 / 技能特效 | Free Pixel Effects | `images/Free Pixel Effects Pack/` | 22種特效 spritesheet |
| 天氣特效 | Weather Elements | `images/Weather Elements Freebie/` | 雨、雪、雷 |
| 等距地板 | isometric tileset | `images/isometric tileset/` | 等距視角地板 |
| 海洋 / 航海 | ❌ **缺少** | 需補充 | 海浪、船隻、港口 |
| 太空 / 科幻 | ❌ **缺少** | 需補充 | 太空背景、星球、飛船 |
| 水豚角色 sprite | ❌ **缺少** | 需補充 | 吉祥物動畫 spritesheet |

---

### 🖼️ UI 元件配置

| UI 元件 | 現有做法 | 素材 | 狀態 |
|---------|---------|------|------|
| 按鈕 / 面板 | 純 CSS（border-radius + backdrop-filter） | — | ✅ CSS 即可 |
| 血條 / 進度條 | 純 CSS div + width 動畫 | — | ✅ CSS 即可 |
| 道具 / 通用圖標 | Icons_Essential / Pixel_Mart PNG | `images/Icons_Essential/Icons/` | ✅ 現有 |
| 金幣圖示 | `Coin.png` / `Coin2.png` | `images/Icons_Essential/Icons/` | ✅ 現有 |
| 寶箱 / 稀有物 | `ChestTreasure.png` | `images/Icons_Essential/Icons/` | ✅ 現有 |
| 特效動畫 | Free Pixel Effects spritesheet | `images/Free Pixel Effects Pack/` | ✅ 現有 |
| 字型（像素風） | Google Fonts CDN（VT323 / Press Start 2P） | — | ⚠️ 靠 CDN，無本地檔 |
| 9-slice 面板框 | ❌ 缺少，目前全靠 CSS | 需補充 | ❌ 缺 |
| 虛擬搖桿（手機） | Canvas 繪製圓形 | — | ⚠️ 無圖片，靠 canvas |
| 對話框 / 氣泡框 | 純 CSS | — | ✅ CSS 即可 |

---

### ❗ 目前素材庫缺少（需補充）

| 優先 | 類型 | 說明 | 建議來源 |
|------|------|------|---------|
| 🔴 高 | 字型檔（本地） | 目前靠 CDN，離線環境或 CrazyGames 上架可能失效 | Google Fonts 下載 .woff2（VT323, Press Start 2P, Noto Sans TC） |
| 🔴 高 | 戰鬥 / Action BGM | 現有音樂全是環境/RPG 迴圈，缺乏激烈戰鬥感 | itch.io 免費音樂包 |
| 🔴 高 | 科幻 / 太空 BGM | 虛空領航員等太空遊戲無合適 BGM | itch.io: synthwave/space music |
| 🟡 中 | 海洋 / 航海 Sprite | 世界航道全靠 canvas 畫，沒有真實船隻/海浪素材 | OpenGameArt.org 搜 "ocean tileset" |
| 🟡 中 | 水豚角色 sprite | 吉祥物有 emoji 但沒有動畫 spritesheet | 自製或委外像素藝術師 |
| 🟡 中 | 節日 / 歡慶 BGM | 節日活動缺 BGM | itch.io 免費 |
| 🟢 低 | 9-slice UI 面板 | 現在 CSS 夠用，但像素風遊戲有面板更有質感 | Kenney.nl UI Pack |
| 🟢 低 | 太空 / 科幻 Sprite | 虛空領航員星空全靠 canvas 繪製 | Kenney.nl Space Shooter |
| 🟢 低 | 虛擬搖桿圖片 | 目前用 canvas 畫圓，無圖片質感 | Kenney.nl Game Input |

---

## 現有遊戲清單（2026/3/22 同步）

| 目錄 | 遊戲名稱 | 類型 | 行數 |
|------|---------|------|------|
| `sea-route/` | 世界航道 Sea Route | 放置 Idle + 探索 | ~1091 |
| `beat-warrior/` | 節拍戰士 | 節奏 RPG | ~795 |
| `beyblade/` | 戰鬥陀螺 BURST ARENA | 物理對戰 | ~1084 |
| `bug-crisis/` | 機甲蟲蟲危機 | 塔防 | ~709 |
| `capy-runner/` | 水豚跑酷 | 手機跑酷 | ~718 |
| `daily-quiz-rpg/` | 每日一題 RPG | 答題養成 | ~700 |
| `deep-diggers.html` | Deep Diggers | 挖礦 Roguelike | ~750 |
| `earth-civilization/` | 地球再生 Earth Reborn | 放置文明 | ~944 |
| `farm-match/` | 農場三消 | 消除 Gacha | ~1079 |
| `fps/` | FPS 射擊遊戲 | 第一人稱射擊 | ~930 |
| `hero/` | 勇者傳說 | 放置 RPG | ~3369 |
| `mosquito/` | 進化蚊子 | 放置進化 | ~1546 |
| `space-roguelike/` | 虛空領航員 | 太空 Roguelike | ~3000 |
| `village/` | 水豚小村 | 村落模擬 | ~1655 |
| `virus/` | VIRUS.EXE 系統清除 | 駭客防禦 | ~2446 |
| `zombie-idle/` | 殭屍蔓延 Zombie Idle | 放置點擊 | ~1651 |
| `zombie-spread/` | 末日求生 | 波次生存射擊 | ~817 |
| `slash-monsters/` | 斬魔忍者 Slash Monsters | 動作 RPG（水果忍者風） | ~625 |

---

## 各遊戲優缺點

> **優化規則**：每次優化完成後，從該遊戲條目刪除對應的缺點。
> 若一款遊戲的缺點全部刪完（只剩優點描述），**立即停止優化**，等整個清單都清空後再重新分析一輪。

### 遊戲分析 & 優化標準流程

當使用者說「分析 XX 遊戲」或「幫我優化 XX」時，Claude 必須按以下流程執行：

```
Step 1｜深度閱讀
  - 讀完整份遊戲原始碼（分段讀，不跳過）
  - 記錄行數、架構、核心迴圈位置

Step 2｜六維度分析（每個維度至少列 2 點）
  ① 效能       — 記憶體洩漏、每幀重複運算、粒子/陣列爆炸
  ② 平衡性     — 數值曲線、難度斷層、後期崩壞的機制
  ③ UX / 回饋  — 缺少視覺/音效提示、狀態不明確、新手引導缺漏
  ④ 手機相容   — 觸控事件、按鈕尺寸、響應式、touch-action
  ⑤ 缺失功能   — 排行榜、成就、統計、音量控制、暫停恢復
  ⑥ Bug / 程式 — 空指標、未清理資源、邊界條件

Step 3｜產出優先修復清單
  - 列表格：修改項 | 問題 | 影響 | 預估行數
  - 按影響力排序，優先修體驗感受最強的項目
  - 單次更新控制在 5~8 項，不貪多

Step 4｜執行修復
  - 每修一項就標記完成
  - 修完 commit + push

Step 5｜更新本文件
  - 從下方遊戲條目刪除已修的缺點
  - 若有新發現的優點，補充進去
```

### 節拍戰士 `beat-warrior/`
- 節奏判定清晰（Perfect/Good/Miss）、真實 sprite 動畫、螢幕震動回饋
- 各關卡氛圍動畫（森林/烈焰/血雨）、擊中粒子爆發效果、54 種音符 pattern + anti-repeat 記憶最近 4 個

### 戰鬥陀螺 `beyblade/`
- 模組化陀螺組裝、物理碰撞流暢、隨機環境事件（磁力/冰面/風暴）
- 玩家操控力提升（moveF+40%）、移動方向箭頭指示、方向粒子噴射
- CPU 新增 cautious（低血量躲避）/ pressure（玩家低轉速猛攻）狀態，偵測玩家防禦自動撤退

### 機甲蟲蟲危機 `bug-crisis/`
- 3 線道設計清楚、5 種兵種各有定位

### 水豚跑酷 `capy-runner/`（2026/3/22）
- 直式手機跑酷、Canvas 縮放填滿螢幕、滑動觸控控制
- 護盾/磁鐵道具、速度漸增、5 種障礙物
- **注意**：touch-action:none 只加 canvas，button 需同時綁 ontouchend + click

### 每日一題 RPG `daily-quiz-rpg/`（2026/3/22）
- 答題換經驗值、角色升級、技能解鎖
- 手機直式設計

### Deep Diggers `deep-diggers.html`
- 500 行縱向地城、5 種生物群系、7 升級樹

### 地球再生 `earth-civilization/`
- 5 時代進程、與太空 Roguelike 跨遊戲連動（研究院×3、發電廠數值已調整）

### 農場三消 `farm-match/`
- Gacha 元素、N/R/SR/SSR 稀有度、連擊系統
- 卡片技能豐富多樣（炸行/3×3炸/十字清/全場核彈），爆發感強
- 里程碑分數獎勵步數，給玩家持續動力，不易中途放棄

### FPS 射擊 `fps/`
- 完整光線追蹤引擎、爆頭機制、3 種武器

### 勇者傳說 `hero/`
- 完整 RPG：職業/技能/裝備/天賦/地城/Boss
- 3369 行，修改需特別謹慎分塊

### 進化蚊子 `mosquito/`
- 吸血點擊升級、進化路線、Boss 戰、血流加速被動升級（Lv1-3 自動血珠）

### 虛空領航員 `space-roguelike/`
- 太空探索+採礦、燃料管理、Meta 升級
- 8 種武器（雷射/散射/重砲/導彈/波動/連射/等離子/閃電鏈），~3000 行

### 水豚小村 `village/`
- 收集/採集冷卻、行為日誌系統、村民故事線（每人 4 個節點 friendship 25/50/75/100）

### VIRUS.EXE `virus/`
- 賽博朋克視覺風格、VT323 字型、多層防禦
- ~2446 行，學習曲線需引導

### 殭屍蔓延 Zombie Idle `zombie-idle/`
- 點擊 + 放置雙核心、DNA Prestige 系統

### 末日求生 `zombie-spread/`
- PostApocalypse 素材包、3 種殭屍 sprite、波次系統

---

## 使用者電腦環境（素材上傳路徑）

### 辨認方式
```cmd
echo %COMPUTERNAME%
echo %USERPROFILE%
```

### 筆電（已確認）
- COMPUTERNAME：`USER`（推測）
- Git repo：`C:\Users\User\capyworlds`
- 素材落地：`C:\Users\User\Desktop\capyworlds\assets\`

### 桌機 ALICE（已確認 2026/3/24）
- COMPUTERNAME：`ALICE`
- Git repo：`C:\Users\alice\OneDrive\桌面\capyworlds`
- wrangler deploy 指令：
  ```cmd
  cd C:\Users\alice\OneDrive\桌面\capyworlds
  git pull origin main
  npx wrangler deploy
  ```

### 手機
- 路徑待確認（第一次使用時補充）

### ACER 主機（路徑待確認）
第一次用 ACER 時請先跑 `echo %COMPUTERNAME%` 和 `echo %USERPROFILE%`

---

## 素材上傳 SOP（Windows CMD）

```cmd
xcopy "C:\Users\User\Desktop\capyworlds\assets\<資料夾名稱>" "C:\Users\User\capyworlds\assets\<資料夾名稱>\" /E /I /Y
cd C:\Users\User\capyworlds
git add "assets\<資料夾名稱>"
git commit -m "Add <資料夾名稱>"
git push origin main
```

**常見錯誤：** `pathspec did not match any files` → 複製沒成功，先確認 `git status`

---

## 好遊戲上架 SOP（2026/3/23 制定）

> 適用平台：CrazyGames（Web）為主，可延伸至 itch.io / Steam / 手機

### Step -1｜競品研究（動手前必做）

> **規則**：使用者提供競品網址（如 CrazyGames / itch.io 連結），Claude 用 WebFetch 抓取頁面資訊進行分析。

```
1. 抓取競品頁面
   - 用 WebFetch 讀取遊戲頁面（標題、描述、標籤、評分、玩家數）
   - 若有多款競品，逐一分析

2. 分析競品成功之處（至少列 5 點）
   - 核心玩法為什麼有趣？（一句話總結 hook）
   - 美術風格 / 視覺吸引力
   - 上手難度 / 新手引導設計
   - 留存機制（解鎖、成就、每日獎勵）
   - 社交/分享機制（排行榜、多人）

3. 分析競品不足之處（至少列 3 點）
   - 缺少什麼功能？玩家評論抱怨什麼？
   - UI/UX 哪裡不順？
   - 手機體驗如何？

4. 產出差異化策略
   - 我們的版本要保留競品哪些優點？
   - 要改進哪些缺點？
   - 獨特賣點是什麼？（一句話能講清楚）

5. 輸出設計文件草稿
   - 存入 games/<game-name>/DESIGN.md
   - 包含：競品分析摘要 + 核心玩法 + 差異化 + 技術規劃
```

```
Step 0｜IP 授權 & 合規確認（開工前）
  - 確認所有素材（圖、音、字型）授權允許商業用途
  - 若用 AI 生圖，確認平台政策（CG 目前接受）
  - 建立 credits.txt 記錄所有第三方素材來源

Step 1｜核心玩法鑽石
  - 一句話說清楚：「玩家做 X，感受 Y」
  - 先做最小可玩版本（30 分鐘內能玩完的 demo）
  - 玩法不有趣 → 不往下走
  - **語言預設：繁體中文 + 英文雙語**（方案 A：右上角「繁中/EN」切換按鈕，i18n 物件儲存所有文字）

Step 2｜市場定位
  - 找 3 款相似遊戲：我的差異是什麼？
  - 目標平台鎖定：Web（CrazyGames / itch.io）/ iOS / Android / Steam
  - 目標受眾：核心玩家 / 輕度玩家 / 學生？
  - 商業模式在這裡決定（不是最後才加）：
    Web → CrazyGames revenue share / AdSense
    手機 → 內購（道具/皮膚）/ 訂閱 / 買斷
    Steam → 買斷 $2.99~$9.99 甜蜜帶

Step 3｜美術風格鎖定
  - 選定 1 種視覺語言（像素藝術 / 扁平 / 2.5D）
  - 確認素材來源（自製 / 素材包授權 / 外包）
  - 建立 palette（4~6 色）+ 統一字型
  - 確定 Icon 設計方向（1024×1024 主視覺）

Step 4｜音效 & 音樂
  - 核心動作音效（擊打/撿取/升級）<= 300ms
  - 背景音樂迴圈（授權或自製，注意 loop point 無縫）
  - 音效品質是第一印象關鍵，不能省

Step 5｜核心迴圈打磨（Juice & Balance）
  - 每個動作加回饋：粒子、震動、聲音、數字跳出
  - 進度感：升級樹 / 解鎖 / 排行榜
  - 至少找 5 個真實玩家測試，觀察卡關點
  - 加入教學/新手引導（前 60 秒體驗決定留存）

Step 6｜效能 & 相容性測試
  - 目標：中低階手機/電腦也能跑 60fps
  - 測試瀏覽器：Chrome / Firefox / Safari / Edge
  - 手機測試：iOS Safari + Android Chrome
  - 確認無記憶體洩漏（長時間開著不爆）

Step 7｜上架素材準備（以 CrazyGames 為模板）
  封面圖（3 尺寸，皆需含遊戲名稱）：
    - 1920×1080（橫版主視覺）
    - 800×1200（直版，手機清單用）
    - 800×800（正方形，縮圖用）
  宣傳影片：
    - 30 秒，前 5 秒必須有最精彩畫面
    - 無需語音，字幕說明即可
    - 解析度 1920×1080，MP4
  文案：
    - 標題（<30 字）/ 副標 / 關鍵字 5~10 個
    - 遊戲說明（操作方式 + 核心玩法，<200 字）
  法務：
    - 隱私政策頁（手機 & CG 必要）
    - 年齡分級（CG 自填）

Step 8｜發布 & 社群曝光
  - 先 soft launch（小範圍測試 1 週）
  - 收 review → 修 bug → 發版本更新
  - 曝光管道：Reddit（r/WebGames / r/indiegaming）/ Twitter / Discord
  - 追蹤核心指標：留存率 Day1/7/30、平均遊玩時長、廣告點擊率

Step 9｜迭代 & 長尾運營
  - 每 2~4 週發內容更新（新關卡/角色/活動）
  - 節日活動（聖誕/農曆新年/萬聖節）刷曝光
  - 收集玩家反饋決定是否值得繼續投入
  - 若留存良好 → 移植手機版本擴大受眾
```

### 各平台素材規格速查

| 平台 | 封面尺寸 | 影片長度 | 特殊要求 |
|------|---------|---------|---------|
| CrazyGames | 1920×1080 / 800×1200 / 800×800 | 30s | 需嵌入頁面可玩 |
| itch.io | 630×500（封面）| 可 YouTube 連結 | 支援自訂頁面 HTML |
| Steam | 460×215（主圖）/ 1232×706（截圖）| 30s~90s MP4 | 需 Steamworks 審核 |
| Google Play | 512×512（icon）/ 1024×500（feature）| 30s | 需 privacy policy URL |
| App Store | 1024×1024（icon）/ 6.5" 截圖 | 30s | 需 Apple 開發者帳號 |

---

## CrazyGames 上架表單內容（英文版）

> 封面產生器：`tools/cover-gen.html`（本地打開，3種尺寸一鍵下載）
> 每次上架前把下方對應遊戲的內容複製貼入 CG 表單即可。

### 表單欄位說明

| 欄位 | 字數限制 | 說明 |
|------|---------|------|
| Category | — | 單選，從 CG 清單選 |
| Tags | 最多 5 個 | 從 CG 標籤庫選 |
| Description | 無 HTML | 遊戲說明，純文字 |
| Controls | 無 HTML | 操作說明，純文字 |

---

### 🦫 Capy Village（水豚小村）
- **Category:** Idle
- **Tags:** `1 Player` `Mouse` `Animal` `Village` `Clicker`
- **Description:**
  Build and grow your very own capybara village! Assign villagers to gather wood, stone, and food. Unlock new buildings, discover villager stories, and watch your cozy settlement thrive. Each capybara has a unique personality revealed through friendship milestones.
- **Controls:**
  Mouse – Click to collect resources and interact with villagers. Click buildings to assign tasks. Use the upgrade panel to improve your village.

---

### 🦫 Capy Runner（水豚跑酷）
- **Category:** Running
- **Tags:** `1 Player` `Mobile` `Animal` `Endless Runner` `Swipe`
- **Description:**
  Guide your capybara through an endless obstacle course! Swipe up to jump, swipe down to slide. Collect coins, grab power-ups like shields and magnets, and see how far you can run before the barrels and walls stop you. Speed increases over time!
- **Controls:**
  Mobile – Swipe up to jump, swipe down to slide.
  Desktop – Arrow Up / W to jump, Arrow Down / S to slide.

---

### 📚 Daily Quiz RPG（每日一題 RPG）
- **Category:** Trivia
- **Tags:** `1 Player` `Mobile` `Educational` `RPG` `Daily Challenge`
- **Description:**
  Answer daily trivia questions to power up your hero! Every correct answer earns XP and gold. Level up your character, unlock new skills, and battle monsters using knowledge as your weapon. A new question arrives every day — keep your streak going!
- **Controls:**
  Mouse / Tap – Select your answer. Click skill buttons to use abilities in battle.

---

### 🦟 Mosquito Evolution（進化蚊子）
- **Category:** Clicker
- **Tags:** `1 Player` `Animal` `Mouse` `Idle` `Evolution`
- **Description:**
  Click to swat evolving mosquitoes before they drain your blood! As you survive, mosquitoes grow stronger and smarter — upgrade your reflexes, unlock passive abilities, and discover evolution branches that change how the swarm behaves. How long can you last?
- **Controls:**
  Mouse – Click mosquitoes to swat them. Click upgrade buttons to spend coins. Passive upgrades activate automatically.

---

### ⛏️ Deep Diggers（深地探掘者）
- **Category:** Idle
- **Tags:** `1 Player` `Mouse` `Mining` `Roguelike` `Upgrade`
- **Description:**
  Dig deeper into the earth, discover rare ores, and battle underground creatures! Explore 5 distinct biomes as you descend. Spend gems on 7 upgrade trees to enhance your drill speed, inventory, and combat power. How deep can you go?
- **Controls:**
  Mouse – Click to drill. Click upgrade panels to spend resources. Hover over items for details.

---

### 🌍 Earth Reborn（地球再生）
- **Category:** Idle
- **Tags:** `1 Player` `Mouse` `Civilization` `Strategy` `Idle`
- **Description:**
  Rebuild civilization from scratch after the apocalypse! Progress through 5 eras — from Stone Age to Space Age — by gathering resources, researching technologies, and constructing wonders. Connects with Void Navigator: research from Earth powers your space fleet!
- **Controls:**
  Mouse – Click to collect resources. Click buildings to produce goods. Use the tech tree to unlock new eras.

---

### 🧟 Zombie Idle（殭屍蔓延）
- **Category:** Idle
- **Tags:** `1 Player` `Mouse` `Zombie` `Clicker` `Idle`
- **Description:**
  Spread your zombie horde across the city! Click to infect survivors, place auto-spreading units, and unlock DNA upgrades through Prestige resets. Each prestige run makes your horde exponentially stronger. Can you infect the entire world?
- **Controls:**
  Mouse – Click the map to spread infection. Click upgrade buttons to evolve your horde. Use the Prestige button to reset and multiply your power.

---

### ☣ Last Stand（末日求生）
- **Category:** Shooter
- **Tags:** `1 Player` `Keyboard` `Zombie` `Survival` `Wave Defense`
- **Description:**
  Survive endless waves of the undead in a post-apocalyptic wasteland! Face 3 types of zombies — walkers, runners, and tanks — with authentic pixel art sprites. Earn points per wave to buy weapons and upgrades. How many waves can you endure?
- **Controls:**
  WASD – Move. Mouse – Aim. Left Click – Shoot. R – Reload. 1/2/3 – Switch weapon. Space – Dash.

---

### 🦠 VIRUS.EXE（系統清除）
- **Category:** Strategy
- **Tags:** `1 Player` `Mouse` `Hacker` `Tower Defense` `Cyberpunk`
- **Description:**
  Your system is under attack — deploy firewalls, launch counter-viruses, and purge malware before it corrupts your core files! Master 3 layers of defense in a neon cyberpunk interface. Each virus type requires a different strategy. Can you keep your system clean?
- **Controls:**
  Mouse – Click to place defense nodes. Right-click to sell. Click virus nodes to target manually. Use hotkeys 1–5 for quick deploy.

---

### 🚀 Void Navigator（虛空領航員）
- **Category:** Space
- **Tags:** `1 Player` `Keyboard` `Space` `Roguelike` `Exploration`
- **Description:**
  Navigate the void between stars, mine asteroid fields, and battle alien fleets in this deep-space roguelike! Manage fuel, choose your route through 8 star systems, and unlock 8 weapon types — from laser beams to plasma chains. Meta upgrades persist between runs.
- **Controls:**
  WASD / Arrow Keys – Fly. Mouse – Aim. Left Click – Fire. Tab – Map. E – Interact. Esc – Pause.

---

### ⚔️ Hero Legend（勇者傳說）
- **Category:** RPG
- **Tags:** `1 Player` `Mouse` `RPG` `Fantasy` `Idle`
- **Description:**
  Embark on an epic RPG adventure! Choose your class, master skills, forge equipment, and conquer multi-floor dungeons. Face challenging boss encounters, unlock talent trees, and build the ultimate hero. A full RPG experience in your browser — no download needed.
- **Controls:**
  Mouse – Click to attack, select skills, and navigate menus. Hotkeys 1–6 to use skills in battle. Auto-battle toggle available.

---

### ⚔ Beat Warrior（節拍戰士）
- **Category:** Music
- **Tags:** `1 Player` `Keyboard` `Rhythm` `RPG` `Music`
- **Description:**
  Fight enemies to the beat! Time your attacks with the music for Perfect hits that deal massive damage. Miss the rhythm and your defense crumbles. Progress through stages, level up your warrior, and face rhythm-based bosses with unique attack patterns.
- **Controls:**
  Z / X / C or Arrow Keys – Hit notes in time with the beat. Space – Special skill. Esc – Pause.

---

### 🌀 Burst Arena（戰鬥陀螺）
- **Category:** Sports
- **Tags:** `1 Player` `2 Players` `Physics` `Battle` `Arena`
- **Description:**
  Customize your spinning top and battle opponents in the arena! Combine Attack, Defense, and Stamina parts for unique builds. Random environmental events — magnetic fields, ice floors, and wind storms — shake up every match. First to knock the opponent out wins!
- **Controls:**
  Mouse – Drag to aim and release to launch. Click ability buttons during battle. Press Space to activate special move.

---

### 🐛 Bug Crisis（機甲蟲蟲危機）
- **Category:** Strategy
- **Tags:** `1 Player` `Mouse` `Tower Defense` `Mech` `Sci-Fi`
- **Description:**
  Command your mech army across 3 battle lanes to stop the mutant insect invasion! Deploy 5 unit types — each with distinct roles — before the bugs overwhelm your base. Earn scraps to upgrade your units and unlock powerful support abilities. Survive 20 waves!
- **Controls:**
  Mouse – Click a unit card then click a lane to deploy. Click the upgrade button to strengthen units in the field.

---

### 🌾 Farm Match（農場三消）
- **Category:** Puzzle
- **Tags:** `1 Player` `Mouse` `Match 3` `Farm` `Gacha`
- **Description:**
  Match colorful crops to earn points and summon rare farm helpers! With N / R / SR / SSR rarity tiers, every gacha pull is exciting. Build combos to trigger chain reactions and unlock helper abilities. How many SSR cards can you collect?
- **Controls:**
  Mouse – Click or drag to swap adjacent tiles. Click Gacha button to spend coins on summons.

---

### 🔫 FPS Shooter（FPS 射擊）
- **Category:** Shooting
- **Tags:** `1 Player` `Keyboard` `FPS` `Shooter` `Action`
- **Description:**
  A browser-based first-person shooter with a full raycasting engine! Explore maze-like maps, score headshots for bonus damage, and switch between 3 weapons. Enemies patrol and chase on detection. Survive as long as possible or clear every enemy to win.
- **Controls:**
  WASD – Move. Mouse – Look. Left Click – Shoot. R – Reload. 1/2/3 – Switch weapon. Shift – Sprint.

---

### ⛵ Sea Route（世界航道）
- **Category:** Idle
- **Tags:** `1 Player` `Mouse` `Nautical` `Idle` `Exploration`
- **Description:**
  Set sail and discover the world's great trade routes! Upgrade your fleet, unlock 10 nation ports, and automate cargo collection for passive income. Encounter sea events and time-limited boss ships for rare rewards. The ocean is yours to conquer!
- **Controls:**
  Mouse – Click to collect cargo, select routes, and upgrade your ship. Toggle auto-collect for hands-free sailing.

---

## CrazyGames 上架前檢查清單（2026/3/25 制定）

> **強制規則**：每款遊戲在提交 CrazyGames 前，Claude 必須逐項跑完此清單並回報結果。
> 源自進化蚊子被拒經驗，避免重複犯錯。

### 🔴 瀏覽器相容性（必過，否則直接被拒）

| 檢查項 | 說明 | 修正方式 |
|--------|------|---------|
| `roundRect()` | Firefox/Safari 不支援 | 加 polyfill（arcTo 替代） |
| `replaceAll()` | 舊瀏覽器不支援 | 用 `split().join()` 或 `replace(/x/g, y)` |
| `structuredClone()` | Safari 15.3 以下不支援 | 用 `JSON.parse(JSON.stringify())` |
| `?.` optional chaining | IE 不支援（CG 不管 IE，但注意） | — |
| WebAudio API | 需 `webkitAudioContext` fallback | `new (window.AudioContext\|\|window.webkitAudioContext)()` |
| Canvas API 新方法 | `reset()`, `roundRect()` 等 | 一律加 polyfill 或用替代寫法 |

**檢查指令**：在檔案中搜尋 `roundRect`、`replaceAll`、`structuredClone`、`at(` 等新 API。

### 🔴 功能完整性（缺一項就被拒）

- [ ] **靜音按鈕** — 必須可見且隨時可用（z-index 高於所有面板）
- [ ] **暫停功能** — 遊戲中可暫停（按鈕或 [P]/[Esc]）
- [ ] **語言切換** — 至少支援英文（CG 主要用戶為歐美）
- [ ] **所有按鍵綁定都有對應 handler** — 說明書說 [F] 可引爆，就必須真的綁了 [F]
- [ ] **所有宣告的功能都有實作** — 商店列了磁鐵，就必須有 `activateMagnet()` 函式
- [ ] **遊戲不會因任何操作崩潰** — 空指標、未定義函式、除以零

### 📱 手機 / 響應式（CG 有手機玩家，必須支援）

- [ ] **Canvas touch 事件** — `touchstart` + `touchmove`，座標要乘以縮放比例
- [ ] **`touch-action: none`** — 只加在 canvas，不加在 body
- [ ] **UI 面板響應式** — `width: min(Xpx, calc(100vw - 24px))`，不用固定 px
- [ ] **按鈕可點擊** — 手機上按鈕尺寸 ≥ 44px，且不被其他元素遮擋
- [ ] **文字不溢出** — 英文比中文長 1.5~2 倍，需 `word-wrap: break-word`
- [ ] **遊戲結束按鈕** — 用相對尺寸，不用固定 px 座標

### 🎓 新手體驗（影響留存率，間接影響審核）

- [ ] **新手教學** — 首次進入顯示操作說明覆蓋層（localStorage 記住已看過）
- [ ] **前 60 秒體驗** — 不能太難也不能太無聊
- [ ] **核心機制解釋** — 特殊機制（如吸血警告）要讓玩家看得懂

### ⚡ 效能 & 品質

- [ ] **resize debounce** — `setTimeout` 100ms，避免頻繁重排
- [ ] **粒子/特效數量上限** — 長時間遊玩不能 FPS 下降
- [ ] **移除 AdSense** — CrazyGames 用自有 SDK，不能載入第三方廣告腳本
- [ ] **無 console.error** — 開 DevTools 確認無紅色錯誤

### 📦 提交前最終確認

- [ ] 在 **Chrome** 測試通過
- [ ] 在 **Firefox** 測試通過（重點：Canvas API 相容性）
- [ ] 在 **手機瀏覽器** 測試通過（觸控 + 響應式）
- [ ] 英文模式下所有 UI 文字不溢出
- [ ] 遊戲可正常結束並重新開始
- [ ] 所有快捷鍵都能正常運作

---

## 週開發節奏（$100 MAX 方案）

### 標準週排程

| 天 | 類型 | 建議任務 |
|----|------|---------|
| 週一 | 🛠 開發日 | 新遊戲 or 新軟體 → 規劃 + 執行到完成 |
| 週二 | 🔧 彈性日 | 修 bug、加小功能、更新 CLAUDE.md |
| 週三 | 🛠 開發 / 強化日 | 新作品 or 強化現有遊戲/軟體 |
| 週四 | 🧪 測試 & 平衡日 | 實際玩/用，找問題，請 Claude 修 |
| 週五 | 📦 整理 & 上架日 | commit、cards、CLAUDE.md 記錄、上架素材 |
| 週六 | 💡 靈感 & 規劃日 | 玩競品、聊概念、不強制動手 |
| 週日 | 😴 休息日 | 放下開發，靈感來了記一筆就好 |

### 每月目標（參考值）
- 遊戲：6~10 款（CrazyGames 上架為目標）
- 軟體：1~2 個社會影響工具
- 書籍：4~8 章（每週 1~2 章）
- 其他方向：按心情從下方選單挑

---

## 創作方向選單（沒靈感時對號入座）

> 直接說「我想做 X 方向，幫我發想」，Claude 會提出 3 個具體方案讓你選。

### 🎮 當你想創作

| 方向 | 做什麼 |
|------|--------|
| 互動小說 / 文字冒險 | 世界觀 + 分支劇情 + 遊戲化 |
| 劇本 / 故事板 | 短片、動畫、YouTube 腳本 |
| 歌詞 / 詩集 | 中英雙語、配合音樂風格 |
| 世界觀設定集 | 架空歷史、地圖、種族、魔法系統 |

### 🌍 當你想幫助人

| 方向 | 做什麼 |
|------|--------|
| 教育工具 | 互動學習網頁、flashcard、視覺化解釋 |
| 無障礙工具 | 幫視障/聽障/學習障礙族群的輕量 web app |
| 心理健康小工具 | 情緒日記、呼吸練習、CBT 引導 |
| 社區資源整合頁 | 某議題的資訊彙整網站 |
| 開源工具 | 發布 GitHub，讓其他開發者用 |

### 📖 當你想寫作

| 方向 | 做什麼 |
|------|--------|
| 書籍（章節） | 逐章展開，Claude 幫結構 + 潤飾 |
| 深度部落格文章 | 技術心得、觀察、論述 |
| 課程設計 | 把知識做成有結構的教學內容 |
| Newsletter | 定期主題，Claude 起草 + 潤飾 |

### 🧠 當你想思考 / 研究

| 方向 | 做什麼 |
|------|--------|
| 深度研究報告 | 某議題廣泛整理成長文 |
| 商業 / 產品分析 | 競品分析、市場切入點、MVP 規劃 |
| 個人知識庫 | 把想法/筆記整理成有結構文件 |
| 哲學 / 觀點整理 | 深度對話，思路變成可分享文章 |

### ⚙️ 當你想自動化生活

| 方向 | 做什麼 |
|------|--------|
| 個人自動化腳本 | Python/Bash 處理重複工作 |
| 資料視覺化 | 數據做成漂亮 HTML 圖表 |
| 模板庫 | 合約草稿、提案範本、Email 範本集 |

### 方向互相餵養參考

```
深度研究報告 ──→ 書籍章節
世界觀設定集 ──→ 互動小說 ──→ 遊戲
教育工具     ──→ 課程設計 ──→ Newsletter
社區資源頁   ──→ 開源工具 ──→ 部落格文章
```

---

## 首頁卡片管理規則

- 首頁 `index.html` 的 `nav-grid` 目前採用**扁平式**導航（無分類）
- **當 nav-card 數量達到 15 張時**，Claude 必須提醒用戶：「首頁卡片已達 15 張，建議新增分類區塊（遊戲 / 工具 / 創作）做整理，是否現在處理？」
- 目前卡片數：**15 張**（2026/3/25 更新）
- ⚠️ **已達 15 張門檻，建議整理分類！** 下次新增卡片前，請先與用戶討論是否改為分類式導覽（遊戲 / 工具 / 創作）

### 首頁卡片清單（按加入順序）

| # | 卡片 | href | 說明 |
|---|------|------|------|
| 1 | 🎮 Games | `games/` | 遊戲收藏 |
| 2 | 📱 手遊專區 | `games/mobile.html` | 觸控遊戲 |
| 3 | ⚔️ 對戰遊戲 | `games/battle.html` | 1v1 連線 |
| 4 | 💬 情境聊天室 | `games/chat-room/` | 配對聊天 |
| 5 | 📝 Blog | `blog.html` | 文章 |
| 6 | 🌟 每日運勢 | `fortune/` | 星座運勢 |
| 7 | 🃏 塔羅抽牌 | `tarot/` | 三牌陣 |
| 8 | 🌀 靈魂配對 | `soul-match/` | 契合度測試 |
| 9 | 📚 Books | `books.html` | 推薦清單 |
| 10 | 🛠 Tools | `tools.html` | 工具資源 |
| 11 | 🦫 About | `about.html` | 關於我 |
| 12 | 🕳️ 黑洞收割者 | `games/black-hole/` | 休閒動作遊戲 |
| 13 | 📋 租屋糾紛自救包 | `rental-rights/` | 台灣社會工具 |
| 14 | 🔍 詐騙辨識器 | `scam-detector/` | 台灣社會工具 |
| 15 | 🗳️ 議員做了什麼？ | `legislator/` | 台灣公民工具 |

---

## 歷史對話重點紀錄

- **2026/3/22** 新增每日一題 RPG `daily-quiz-rpg/`（手機答題養成）
- **2026/3/22** 新增手遊專區 `games/mobile.html`，首頁加入 📱 導航卡片
- **2026/3/22** 新增水豚跑酷 `capy-runner/`（直式手機跑酷）
  - 修復：Canvas 改為全螢幕響應式縮放
  - 修復：touch-action:none 移至 canvas，修復按鈕 tap 失效問題
  - 新增：護盾/磁鐵道具、速度感特效、油桶障礙物
- **2026/3/19** 節拍戰士 bug 修：第二關「繼續」按鈕 overlay 不消失 -> 已修 showOverlay
- **2026/3/19** 節拍戰士音效：從 WebAudio 合成改為素材庫真實音效
- **2026/3/23** 制定好遊戲上架 SOP（9步驟）+ 各平台素材規格速查表，寫入 CLAUDE.md
- **2026/3/23** 新增週開發節奏排程 + 創作方向選單（遊戲/軟體/寫作/研究/自動化）
- **2026/3/24** 新增世界航道 Sea Route `sea-route/`（放置 Idle + 探索解鎖，10 國航線）
  - 設計文件：`games/sea-route/DESIGN.md`（含 Boss 機制、4 升級樹、素材規劃）
  - v0.1：基礎航行、自動/手動蒐集、紙娃娃船、timing Boss、10 國地標
- **2026/3/24** 新增 Context 壓縮保護規則 + 設計文件流程
- **2026/3/19** 彈幕按鈕移到右上角，配色改用主題變數
- **2026/3/25** 新增黑洞收割者 `games/black-hole/`（休閒動作，Canvas，鼠標/觸控拖曳）
- **2026/3/25** 新增租屋糾紛自救包 `rental-rights/`（台灣社會工具，6 種情境，存證信函草稿）
- **2026/3/25** 新增首頁卡片管理規則（15 張提醒分類，目前 15 張 ⚠️ 已達門檻）
- **2026/3/25** 新增詐騙辨識器 `scam-detector/`（關鍵字比對，5 種示範範例，165/CIB 檢舉連結）
- **2026/3/25** 新增我的議員做了什麼 `legislator/`（示範資料 + 立院官方查詢連結彙整）
- **2026/3/27** 新增流量分析儀表板 `analytics/`（自建追蹤，8 分析角度：趨勢/頁面/地理/裝置/來源/時段/建議/追蹤碼）
  - Worker 新增 `POST /t`（收集）+ `GET /analytics-data`（查詢，需 ADMIN_KEY）
  - 42 個頁面已安裝追蹤碼
- **2026/3/27** 新增 GitHub Actions 自動部署（`.github/workflows/deploy.yml`）
  - push to main → 自動 `wrangler deploy`
  - GitHub Secrets 已設定：`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`
