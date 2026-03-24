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
- 語言：繁體中文 + 英文雙語（預設繁體中文，右上角切換按鈕「繁中 / EN」，切換後 i18n 物件全部替換文字）
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
| `space-roguelike/` | 虛空領航員 | 太空 Roguelike | ~3000 |
| `village/` | 水豚小村 | 村落模擬 | ~1655 |
| `virus/` | VIRUS.EXE 系統清除 | 駭客防禦 | ~2446 |
| `zombie-idle/` | 殭屍蔓延 Zombie Idle | 放置點擊 | ~1651 |
| `zombie-spread/` | 末日求生 | 波次生存射擊 | ~817 |

---

## 各遊戲優缺點

> **優化規則**：每次優化完成後，從該遊戲條目刪除對應的缺點。
> 若一款遊戲的缺點全部刪完（只剩優點描述），**立即停止優化**，等整個清單都清空後再重新分析一輪。

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
- 卡片技能豐富多樣（炸行/3×3炸/十字清/全場核彈），爆發感強
- 里程碑分數獎勵步數，給玩家持續動力，不易中途放棄
- 無存檔機制，一局結束金幣/卡片全清，難以累積長線成就感
- 後期缺乏難度曲線，寶石種類固定、無關卡障礙物

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
- 8 種武器（雷射/散射/重砲/導彈/波動/連射/等離子/閃電鏈），~3000 行

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
- **2026/3/23** 新增 SessionStart hook，每次開 session 自動顯示當日開發建議
- **2026/3/19** 彈幕按鈕移到右上角，配色改用主題變數
