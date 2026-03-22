# CapyWorlds — Claude 開發指引

## 大型檔案寫入規則（最優先執行）

任何預估超過 **400 行**的新檔案，**必須**分塊處理：

- ❌ 不可用單一 `Write` 工具呼叫寫超過 400 行的內容
- ❌ 不可啟動背景 Agent 去「一口氣」寫整個大型檔案
- ❌ 發現 `max_tokens` 錯誤後不可重試相同的 Write 呼叫

做法：建立空白檔後用 `cat >> file << 'EOF' ... EOF` 依序 append，每塊 ≤ 200 行。

---

## 專案結構

```
/games/          各遊戲子目錄或單 HTML 檔
/worker/         Cloudflare Worker 後端
/index.html      首頁
/games/index.html 遊戲清單頁
```

## 遊戲新增流程

1. 在 `games/<game-name>/` 建立目錄 + `index.html`
2. 在 `games/index.html` 加入遊戲卡片（參考現有格式）
3. commit → push 到指定 `claude/` 分支

---

## 素材使用規則（配置音效 / 音樂 / 圖片前必讀）

每次要加入音效、BGM、圖片，**必須先** `find /home/user/capyworlds/assets -type f` 掃描素材包，有適合的直接用；沒有則告訴使用者需要哪種類型，請他下載上傳，不要自行 WebAudio 合成。

### 音效 `assets/sfx/`

| 路徑 | 內容 |
|------|------|
| `assets/sfx/GameSFX0/` | Alarms, Animal, Ascending, Blops, Bounce, Charge, Cinematic, Descending, Electric, Explosion |
| `assets/sfx/GameSFX1/` | Electric, Electronic Burst, Events/Negative, Explosion, Impact |
| `assets/sfx/GameSFX2/` | FootStep, HiTech, Impact, Interferences, Magic, Music/Events/Success/Negative |
| `assets/sfx/GameSFX3/` | PickUp, PowerUp, Roar, Swoosh, Vehicles, Water, Weapon（Gun/Laser/Reload/Grenade/Missile/Arrow/Bomb/Plasma）, Weird, z_Various |
| `assets/sfx/400 Sounds Pack/` | 400音效全套：Combat/Gore, Environment（ambient_wind.wav、water_babbling_loop.wav）, Footsteps, Human, Items, Machines, UI, Weapons |
| `assets/sfx/JDSherbert - Ultimate UI SFX Pack (FREE)/` | UI音效：Cancel×2、Cursor×5、Error、PopupClose/Open、Select×2、Swipe×2（OGG，`Stereo/ogg/`） |

⚠️ `assets/images/Weather Elements Freebie/` 實際是 WAV 音效（雨聲/風聲/雷聲），可直接用。

### 背景音樂 `assets/music/`

| 路徑 | 適用情境 |
|------|---------|
| `JDSherbert - Minigame Music Pack [FREE]/` | 輕鬆休閒（10首OGG） |
| `retroindiejosh_mp06-horror_ogg/` | 恐怖/黑暗（5首OGG） |
| `10 Ambient RPG Tracks/ogg/` | RPG環境/探索（10首） |
| `Fantasy RPG Music Pack Vol.3/Loops/ogg/` | 戰鬥BGM（Action Loop×5）+ RPG探索（Ambient Loop×10） |
| `Fantasy RPG Music Vol. 2/ogg/` | RPG全場景（Action/Ambient/Victory/Death等） |
| `Medieval Vol. 2/ogg/` | 中世紀/奇幻（8首） |
| `Game Piano Music/ogg/` | 鋼琴/情感（8首） |
| `Urban Modern/` | 都市/現代（4首MP3） |
| `instruments/` | 程式生成音樂（多種音色） |

### 圖片素材 `assets/images/`

| 路徑 | 內容 |
|------|------|
| `Free Pixel Effects Pack/` | 20張特效spritesheet（魔法/火焰/渦旋/冰凍等） |
| `Icons_Essential/Icons/` | 60+像素圖示PNG（Coin、Key、Chest、Gamepad等） |
| `Pixel Crawler - Free Pack 2.0.4/` | 地下城：Tileset + 英雄NPC（Knight/Rogue/Wizzard，Idle/Run/Death）+ 怪物（Orc×4、Skeleton×4） |
| `Sunnyside World/` | 農場/世界風格 + Goblin（多種動畫）+ 主角（耕作） |
| `Tiny RPG Character Asset Pack v1.03b -Free Soldier&Orc/` | Soldier & Orc sprite |
| `32rogues-1/` | Roguelike精靈圖集（基本版）：monsters/rogues/animals/items/tiles |
| `32rogues-2/` | Roguelike精靈圖集（擴充版）+ animated-tiles、autotiles、palette-swaps |
| `critters/` | 野生動物：badger/boar/stag/wolf，等角4方向，Idle/Walk/Run |
| `isometric tileset/` | 等角地板磚集（100+張獨立圖塊） |
| `Mana Seed Farmer Sprite Free Sample/` | 農夫角色分層換裝（body/feet/lower/shirt/hair/head） |
| `mystic_woods_free_2.1/` 及 `2.2/` | 神秘森林：player/skeleton/slime（**含攻擊動畫✅**）+ Tileset + 物件/粒子 |

⚠️ Pixel Crawler 英雄（Knight/Rogue/Wizzard）**只有 Idle/Run/Death，沒有攻擊動畫**；mystic_woods player/skeleton/slime **有攻擊動畫✅**。

### 混合素材包 `assets/packs/`

| 路徑 | 內容 |
|------|------|
| `PostApocalypse_AssetPack_v1.1.2/` | 末日：主角（Idle/Run/Death/Punch）、殭屍3種、物件/Tile/音效/音樂 |
| `Robot Warfare Asset Pack 24-11-21/` | 機甲：Soldiers×7、Robots×5、Effects、Projectiles、Tileset、UI |

---

## 提示框 / 通知 / 彈窗安全規則

所有 `position:fixed/absolute` 的提示框必須不超出可視範圍：

1. **頂部留白**：有 header+ticker → `top: 80px`；只有 header → `top: 56px`；無 header → `top: 20px`
2. **橫向不溢出**：`max-width: min(400px, calc(100vw - 32px))`
3. **彈窗高度**：`max-height: 88vh; overflow-y: auto`
4. **tooltip** 要用 JS 確認不超出 viewport（getBoundingClientRect 檢查）

---

## 音效規範

- **即時動作音效 ≤ 300ms**（撿道具、升級、射擊、受傷等）
- 音檔超過 300ms 時，必須在 `audio.play()` 第四個參數傳入截斷毫秒數（`maxMs`）
  - 例：`audio.play('pickup', 0.7, 1, 220)` → 只播前 220ms
- 背景音樂、爆炸長尾音、環境音不受限制

## 技術約束

- 所有遊戲都是純前端，無外部依賴
- 使用繁體中文 UI
- 視覺風格：深色背景、金色/青色強調色

---

## 現有遊戲清單（2026/3/19 同步）

| 目錄 | 遊戲名稱 | 類型 | 行數 |
|------|---------|------|------|
| `beat-warrior/` | 節拍戰士 | 節奏 RPG | ~710 |
| `beyblade/` | 戰鬥陀螺 BURST ARENA | 物理對戰 | 中型 |
| `bug-crisis/` | 機甲蟲蟲危機 | 塔防 | 中型 |
| `deep-diggers.html` | Deep Diggers | 挖礦 Roguelike | ~2000+ |
| `earth-civilization/` | 地球再生 Earth Reborn | 放置文明 | 大型 |
| `fps/` | FPS 射擊遊戲 | 第一人稱射擊 | 大型 |
| `hero/` | 勇者傳說 | 放置 RPG | ~3369 |
| `mosquito/` | 進化蚊子 | 放置進化 | ~1431 |
| `space-roguelike/` | 虛空領航員 Void Navigator | 太空 Roguelike | ~2402 |
| `village/` | 水豚小村 | 村落模擬 | ~1530 |
| `virus/` | VIRUS.EXE 系統清除 | 駭客防禦 | ~2403 |
| `zombie-idle/` | 殭屍蔓延 Zombie Idle | 放置點擊 | ~1618 |
| `zombie-spread/` | 末日求生 | 波次生存射擊 | ~719 |

---

## 使用者電腦環境

辨認方式：叫使用者跑 `echo %COMPUTERNAME%`

| 電腦 | Git repo | 素材路徑 |
|------|---------|---------|
| 筆電 | `C:\Users\User\capyworlds` | `C:\Users\User\Desktop\capyworlds\assets\` |
| ACER 主機 | 待確認（請跑 `echo %USERPROFILE%`） | 待確認 |

## 素材上傳 SOP（Windows CMD）

```cmd
xcopy "C:\Users\User\Desktop\capyworlds\assets\<資料夾名稱>" "C:\Users\User\capyworlds\assets\<資料夾名稱>\" /E /I /Y
cd C:\Users\User\capyworlds
git add "assets\<資料夾名稱>"
git commit -m "Add <資料夾名稱>"
git push origin main
```

**常見錯誤：** `pathspec did not match any files` → 複製沒成功，先確認 `git status`。

---

## 歷史對話重點紀錄

- **2026/3/19** 彈幕按鈕移到右上角，配色改用主題變數
- **2026/3/19** 節拍戰士 bug 修：第二關「繼續」按鈕 overlay 不消失 → 已修 `showOverlay`
- **2026/3/19** 節拍戰士音效：從 WebAudio 合成改為素材庫真實音效
- **2026/3/19** 素材 `PostApocalypse_AssetPack_v1.1.2` 待上傳
