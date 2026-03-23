# CapyWorlds — Claude 開發指引（2026/3/22 更新）

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
  worker/index.js        Cloudflare Worker 後端（留言/排行榜/彈幕）
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

---

## 提示框 / 通知 / 彈窗安全規則

所有 `position:fixed/absolute` 的提示框必須不超出可視範圍：

1. **頂部留白**：有 header+ticker → `top: 80px`；只有 header → `top: 56px`；無 header → `top: 20px`
2. **橫向不溢出**：`max-width: min(400px, calc(100vw - 32px))`
3. **彈窗高度**：`max-height: 88vh; overflow-y: auto`
4. **tooltip** 要用 JS 確認不超出 viewport（getBoundingClientRect 檢查）

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
- 使用繁體中文 UI
- 視覺風格跟隨現有設計（深色背景、金色/青色強調色）
- 手機遊戲：Canvas 必須用 JS 縮放填滿螢幕
- `touch-action: none` 只加在 canvas 元素，不加在 body
- 遊戲存檔用 localStorage，跨遊戲連動也用 localStorage

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

資料庫：Cloudflare D1（`capyworlds-comments`）

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

## 現有遊戲清單（2026/3/22 同步）

| 目錄 | 遊戲名稱 | 類型 | 行數 |
|------|---------|------|------|
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
| `space-roguelike/` | 虛空領航員 | 太空 Roguelike | ~2565 |
| `village/` | 水豚小村 | 村落模擬 | ~1655 |
| `virus/` | VIRUS.EXE 系統清除 | 駭客防禦 | ~2446 |
| `zombie-idle/` | 殭屍蔓延 Zombie Idle | 放置點擊 | ~1651 |
| `zombie-spread/` | 末日求生 | 波次生存射擊 | ~817 |

---

## 各遊戲優缺點

### 節拍戰士 `beat-warrior/`
- 節奏判定清晰（Perfect/Good/Miss）、真實 sprite 動畫、螢幕震動回饋
- 戰場畫面單調，音符 pattern 後期重複

### 戰鬥陀螺 `beyblade/`
- 模組化陀螺組裝、物理碰撞流暢、隨機環境事件（磁力/冰面/風暴）
- 玩家操作感弱、CPU 無狀態策略

### 機甲蟲蟲危機 `bug-crisis/`
- 3 線道設計清楚、5 種兵種各有定位
- 部署後無法升級、後期平衡感不足

### 水豚跑酷 `capy-runner/`（2026/3/22）
- 直式手機跑酷、Canvas 縮放填滿螢幕、滑動觸控控制
- 護盾/磁鐵道具、速度漸增、5 種障礙物
- **注意**：touch-action:none 只加 canvas，button 需同時綁 ontouchend + click

### 每日一題 RPG `daily-quiz-rpg/`（2026/3/22）
- 答題換經驗值、角色升級、技能解鎖
- 手機直式設計

### Deep Diggers `deep-diggers.html`
- 500 行縱向地城、5 種生物群系、7 升級樹
- 鑽探方向單一（只能往下）

### 地球再生 `earth-civilization/`
- 5 時代進程、與太空 Roguelike 跨遊戲連動
- 後期被動收入過慢

### 農場三消 `farm-match/`
- Gacha 元素、N/R/SR/SSR 稀有度、連擊系統
- 尚待深度測試

### FPS 射擊 `fps/`
- 完整光線追蹤引擎、爆頭機制、3 種武器
- 敵人 AI 會卡牆、地圖固定

### 勇者傳說 `hero/`
- 完整 RPG：職業/技能/裝備/天賦/地城/Boss
- 3369 行，修改需特別謹慎分塊

### 進化蚊子 `mosquito/`
- 吸血點擊升級、進化路線、Boss 戰
- 點擊疲勞感（放置元素不足）

### 虛空領航員 `space-roguelike/`
- 太空探索+採礦、燃料管理、Meta 升級
- ~2565 行，武器種類偏少

### 水豚小村 `village/`
- 收集/採集冷卻、行為日誌系統
- 缺乏長期目標

### VIRUS.EXE `virus/`
- 賽博朋克視覺風格、VT323 字型、多層防禦
- ~2446 行，學習曲線陡

### 殭屍蔓延 Zombie Idle `zombie-idle/`
- 點擊 + 放置雙核心、DNA Prestige 系統
- 後期缺乏更多循環目標

### 末日求生 `zombie-spread/`
- PostApocalypse 素材包、3 種殭屍 sprite、波次系統
- 地圖背景較簡單

---

## 使用者電腦環境（素材上傳路徑）

### 辨認方式
```cmd
echo %COMPUTERNAME%
```

### 筆電（已確認）
- Git repo：`C:\Users\User\capyworlds`
- 素材落地：`C:\Users\User\Desktop\capyworlds\assets\`

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

## 歷史對話重點紀錄

- **2026/3/22** 新增每日一題 RPG `daily-quiz-rpg/`（手機答題養成）
- **2026/3/22** 新增手遊專區 `games/mobile.html`，首頁加入 📱 導航卡片
- **2026/3/22** 新增水豚跑酷 `capy-runner/`（直式手機跑酷）
  - 修復：Canvas 改為全螢幕響應式縮放
  - 修復：touch-action:none 移至 canvas，修復按鈕 tap 失效問題
  - 新增：護盾/磁鐵道具、速度感特效、油桶障礙物
- **2026/3/19** 節拍戰士 bug 修：第二關「繼續」按鈕 overlay 不消失 -> 已修 showOverlay
- **2026/3/19** 節拍戰士音效：從 WebAudio 合成改為素材庫真實音效
- **2026/3/19** 彈幕按鈕移到右上角，配色改用主題變數
