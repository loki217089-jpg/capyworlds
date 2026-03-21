# CapyWorlds — Claude 開發指引

## 大型檔案寫入規則（最優先執行）

**問題根因**：`Write` 工具或 Agent 的單次輸出有 token 上限（約 21,000 tokens）。
當需要產生的檔案超過這個上限時，工具會觸發 `max_tokens` 錯誤並進入重試迴圈，導致浪費大量時間卻沒有產出。

### 強制規則：讀完規格 → 先切分，再動手

任何預估超過 **400 行**的新檔案，**必須**按以下流程處理：

```
1. 讀完規格 / 釐清需求
2. 在腦中（或寫成註解）規劃所有區塊，確認每塊 ≤ 200 行
3. 建立空白檔（或寫入第一個區塊）
4. 用 `cat >> file << 'EOF' ... EOF` 依序 append 後續區塊
5. 每個 heredoc 區塊寫完後確認行數，再繼續下一塊
```

### 區塊切法參考

| 檔案類型 | 建議切分點 |
|----------|-----------|
| 單頁 HTML 遊戲 | HTML/CSS → 常數/工具函式 → 世界生成 → 玩家/敵人 → 渲染 → HUD/UI → 主迴圈 |
| 長 JS 模組 | imports → types/constants → 各功能函式群 → exports |
| 長 CSS | reset/vars → layout → components → animations |

### 禁止事項

- ❌ 不可用單一 `Write` 工具呼叫寫超過 400 行的內容
- ❌ 不可啟動背景 Agent 去「一口氣」寫整個大型檔案
- ❌ 發現 `max_tokens` 錯誤後不可重試相同的 Write 呼叫

### 正確範例

```bash
# 建立檔案 + 第一段（HTML/CSS）
cat > game.html << 'BLOCK1'
<!DOCTYPE html>...（≤200行）
BLOCK1

# 第二段 append（常數/工具）
cat >> game.html << 'BLOCK2'
// === Constants ===...（≤200行）
BLOCK2

# 持續 append 直到完成
```

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

## 素材使用規則（配置音效 / 音樂 / 圖片前必讀）

### 強制流程：先查素材包，再決定做法

每次要為遊戲加入**音效、背景音樂、圖片**時，必須先執行以下步驟：

1. **掃描素材包**：用 `find /home/user/capyworlds/assets -type f` 列出所有素材
2. **比對需求**：確認素材包內有無符合情境的檔案（例如：爆炸音→ `Explosion/`、腳步→ `FootStep/`、BGM→ `JDSherbert - Minigame Music Pack/`）
3. **決策**：
   - 有適合素材 → 直接使用（用 `<audio>` 或 fetch Blob 載入）
   - 沒有適合素材 → **告訴使用者需要哪種類型的素材包，請他去下載上傳**，不要自行用 WebAudio 合成替代（除非是臨時示意）

### 現有素材包總覽（2026/3/21 更新）

#### 🎵 音效 `assets/sfx/`

| 路徑 | 內容 |
|------|------|
| `assets/sfx/GameSFX0/` | Alarms, Animal, Ascending, Blops, Bounce, Charge, Cinematic, Descending, Electric, Explosion |
| `assets/sfx/GameSFX1/` | Electric, Electronic Burst, Events/Negative, Explosion, Impact |
| `assets/sfx/GameSFX2/` | FootStep, HiTech, Impact, Interferences, Magic, Music/Events/Success/Negative |
| `assets/sfx/GameSFX3/` | PickUp, PowerUp, Roar, Swoosh, Vehicles, Water, Weapon（Gun/Laser/Reload/Grenade/Missile/Arrow/Bomb/Plasma）, Weird, z_Various |
| `assets/sfx/400 Sounds Pack/` | 400音效全套：Combat/Gore, Environment（**ambient_wind.wav✅、water_babbling_loop.wav✅**、door/clock/fire等）, Footsteps, Human, Items, Machines, Match Three, Materials, Musical Effects, Retro, UI, Weapons |
| `assets/sfx/JDSherbert - Ultimate UI SFX Pack (FREE)/` | **UI音效✅**：Cancel×2、Cursor×5、Error、PopupClose、PopupOpen、Select×2、Swipe×2（OGG，`Stereo/ogg/` 子目錄） |

⚠️ **注意**：`assets/images/Weather Elements Freebie/` 實際上是 WAV 音效（**雨聲✅、風聲✅、雷聲✅**），路徑放錯但可直接使用：
- `WE Heavy/Light Inside/Outside Rain 1.wav` — 室內/外雨聲（輕/重）
- `WE Heavy/Light Wind Whistle 1.wav` — 風聲
- `WE Thunder 1/26/29.wav` — 雷聲

#### 🎶 背景音樂 `assets/music/`

| 路徑 | 內容 | 適用情境 |
|------|------|---------|
| `assets/music/JDSherbert - Minigame Music Pack [FREE]/` | 10首OGG（Streetlights、Blackjack、Smooth Driving等） | 輕鬆休閒 |
| `assets/music/retroindiejosh_mp06-horror_ogg/` | 5首OGG：as-the-light-fades、eyes-piercing-shadow、monster、smallheart、toybox | **恐怖/黑暗氣氛✅** |
| `assets/music/10 Ambient RPG Tracks/ogg/` | 10首OGG（Ambient 1–10） | RPG環境/探索 |
| `assets/music/Fantasy RPG Music Pack Vol.3/Loops/ogg/` | **Action Loop×5✅**（戰鬥）+ Ambient Loop×10（探索），均可循環 | **戰鬥BGM✅ / RPG探索** |
| `assets/music/Fantasy RPG Music Vol. 2/ogg/` | Action Loop×5、Ambient×多首、Night Ambient×5、Victory、Death、Complete、Strange | RPG全場景 |
| `assets/music/Medieval Vol. 2/ogg/` | 8首OGG（Medieval Vol.2 1–8） | 中世紀/奇幻 |
| `assets/music/Game Piano Music/ogg/` | 8首OGG（Piano 1–8） | 鋼琴/情感場景 |
| `assets/music/Urban Modern/` | 4首MP3：alexgrohl-urban、digisignreport-urban-light-bed-loop、nastelbom-modern、turtlebeats-modern-electronic-waves | **都市/現代✅** |
| `assets/music/instruments/` | Retro Instrument：choir bass、crystal、drumset 等多種音色（C00–C12） | 程式生成音樂 |

#### 🖼️ 圖片素材 `assets/images/`

| 路徑 | 內容 |
|------|------|
| `assets/images/Free Pixel Effects Pack/` | 20張特效spritesheet（魔法/火焰/渦旋/冰凍等） |
| `assets/images/Icons_Essential/Icons/` | 60+像素圖示PNG（Coin、Key、Chest、Gamepad等） |
| `assets/images/Pixel Crawler - Free Pack 2.0.4/` | 地下城爬行：Tileset（地板/牆/水）+ **英雄NPC**（Knight/Rogue/Wizzard，各有Idle/Run/Death）+ **怪物Mobs**（Orc×4種、Skeleton×4種，各有Idle/Run/Death） |
| `assets/images/Sunnyside World/` | 明亮農場/世界風格 + **Goblin**（哥布林，有Attack/Death等多種動畫）+ 主角人物（耕作動畫為主） |
| `assets/images/Tiny RPG Character Asset Pack v1.03b -Free Soldier&Orc/` | 小型RPG v1.03b：Soldier & Orc sprite（最新版） |
| `assets/images/32rogues-1/` | Roguelike精靈圖集（基本版）：monsters.png、rogues.png、animals.png、items.png、tiles.png |
| `assets/images/32rogues-2/` | Roguelike精靈圖集（擴充版）：同上 + animated-tiles、autotiles、items-palette-swaps（多色板） |
| `assets/images/critters/` | **野生動物✅**：badger（獾）、boar（野豬）、stag（鹿）、wolf（狼）；等角視角4方向（NE/NW/SE/SW），各有Idle/Walk/Run |
| `assets/images/isometric tileset/` | 等角地板磚集（100+張 tile_001.png 等獨立圖塊） |
| `assets/images/Mana Seed Farmer Sprite Free Sample/` | 農夫角色（分層換裝系統）：body/feet/lower/shirt/hair/head 各層 spritesheet |
| `assets/images/mystic_woods_free_2.1/` | 神秘森林 v2.1：角色（player/skeleton/slime）+ Tileset（草地/水/圍牆/裝飾）+ 物件/粒子 |
| `assets/images/mystic_woods_free_2.2/` | 神秘森林 v2.2（更新版）：同上 + skeleton_swordless 變體 |

#### 📦 混合遊戲素材包（含圖片+音效） `assets/packs/`

| 路徑 | 內容 |
|------|------|
| `assets/packs/PostApocalypse_AssetPack_v1.1.2/` | 末日風格：主角（Idle/Run/Death/Punch）、殭屍3種（Zombie_Axe/Big/Small）、物件/Tile/音效/音樂 |
| `assets/packs/Robot Warfare Asset Pack 24-11-21/` | 機甲戰爭：Soldiers×7種（Assault/Sniper/Grenadier等）、Robots×5種（Centipede/Hornet/Scarab/Spider/Wasp）、Effects、Projectiles、Tileset、UI |

### RPG/奇幻角色 sprite 總整理（跨素材包）

| 角色類型 | 路徑 | 動畫 |
|---------|------|------|
| **英雄 - 騎士** | `Pixel Crawler.../Entities/Npc's/Knight/` | Idle / Run / Death |
| **英雄 - 盜賊** | `Pixel Crawler.../Entities/Npc's/Rogue/` | Idle / Run / Death |
| **英雄 - 巫師** | `Pixel Crawler.../Entities/Npc's/Wizzard/` | Idle / Run / Death |
| **英雄 - 農夫** | `Mana Seed Farmer Sprite Free Sample/` | 分層換裝，多種農耕動畫 |
| **英雄 - 森林勇者** | `mystic_woods.../sprites/characters/player.png` | 含攻擊動畫✅ |
| **怪物 - 獸人** | `Pixel Crawler.../Mobs/Orc Crew/Orc/` | Idle / Run / Death |
| **怪物 - 獸人盜賊/薩滿/戰士** | `Pixel Crawler.../Mobs/Orc Crew/` | Idle / Run / Death |
| **怪物 - 骷髏×4種** | `Pixel Crawler.../Mobs/Skeleton Crew/` | Idle / Run / Death |
| **怪物 - 骷髏（森林）** | `mystic_woods.../sprites/characters/skeleton.png` | 含攻擊動畫✅ |
| **怪物 - 史萊姆** | `mystic_woods.../sprites/characters/slime.png` | 含攻擊動畫✅ |
| **怪物 - 哥布林** | `Sunnyside World.../GOBLIN/` | Idle/Attack/Death/Carry等多種 |
| **野生動物×4種** | `critters/critters/` | Idle/Walk/Run × 4方向 |
| **士兵×7種** | `Robot Warfare.../Soldiers/` | 見 Soldier Animation Info.txt |
| **機器人×5種** | `Robot Warfare.../Robots/` | 見 Robot animation info.txt |
| **殭屍×3種** | `PostApocalypse.../Enemies/` | Zombie_Axe / Zombie_Big / Zombie_Small |

⚠️ 注意：Pixel Crawler 英雄（Knight/Rogue/Wizzard）**只有 Idle/Run/Death，沒有攻擊動畫**；mystic_woods 的 player/skeleton/slime **有攻擊動畫✅**。

### 缺乏的素材類型（建議下載）

- ❌ **海浪聲**（現有雨聲/風聲/雷聲，但缺海浪）
- ❌ **英雄攻擊動畫（像素RPG風）**（mystic_woods 有但風格固定；Pixel Crawler 英雄無攻擊）

---

## 提示框 / 通知 / 彈窗安全規則

**避免文字被螢幕切掉的規範**：

```
所有 position:fixed 或 position:absolute 的提示框（toast、notification、popup、tooltip）
必須確保在各裝置上不超出可視範圍。
```

### 必須遵守的規則

1. **頂部留白**：固定式通知的 `top` 值需大於頁面 header + ticker 的實際高度（通常 ≥ 80px）
   - 有標頭列（~40px）+ 跑馬燈（~20px）時：`top: 80px` 以上
   - 只有標頭列（~40px）時：`top: 56px` 以上
   - 無標頭：`top: 20px` 以上

2. **橫向不溢出**：
   ```css
   max-width: min(400px, calc(100vw - 32px));
   overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
   /* 或 */
   word-break: break-word; white-space: normal;
   ```

3. **彈窗（modal/overlay）高度限制**：
   ```css
   max-height: 88vh; overflow-y: auto;
   ```

4. **tooltip 定位檢查**：動態生成的 tooltip 要用 JS 確認不超出 viewport：
   ```js
   const r = el.getBoundingClientRect();
   if (r.right > window.innerWidth) el.style.left = 'auto'; el.style.right = '8px';
   if (r.bottom > window.innerHeight) el.style.top = 'auto'; el.style.bottom = '8px';
   ```

---

## 音效規範

- **即時動作音效 ≤ 300ms**（撿道具、升級、購買、射擊、受傷等一瞬間的動作）
- 加入音效時，若音檔時長超過 300ms，**必須**在 `audio.play()` 的第四個參數傳入截斷毫秒數（`maxMs`）
  - 例：`audio.play('pickup', 0.7, 1, 220)` → 只播前 220ms
- 背景音樂、爆炸長尾音、環境音不受此限制

## 技術約束

- 所有遊戲都是純前端，無外部依賴
- 使用繁體中文 UI
- 視覺風格跟隨現有設計（深色背景、金色/青色強調色）

---

## 現有遊戲清單與優缺點分析（2026/3/19 同步）

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

### 各遊戲優缺點

#### 節拍戰士 `beat-warrior/`
- ✅ 節奏判定清晰（Perfect/Good/Miss）、真實 sprite 動畫、螢幕震動回饋
- ✅ 使用 PostApocalypse 素材庫音效（已修）、overlay 按鈕 bug（已修）
- ⚠️ 戰場畫面單調，音符 pattern 後期重複
- ⚠️ 每關只有一種敵人，缺乏視覺多樣性

#### 戰鬥陀螺 `beyblade/`
- ✅ 模組化陀螺組裝、物理碰撞流暢、隨機環境事件（磁力/冰面/風暴）
- ⚠️ 玩家操作感弱（陀螺自動對打）、玩家技能影響力不夠明顯
- ⚠️ CPU 對手無狀態策略，每局行為相同

#### 機甲蟲蟲危機 `bug-crisis/`
- ✅ 3 線道設計清楚、5 種兵種各有定位、有範圍傷害機制
- ⚠️ 部署後無法管理（賣出/升級）、缺乏中途策略調整空間
- ⚠️ 後期關卡平衡感不足

#### Deep Diggers `deep-diggers.html`
- ✅ 500 行縱向地城、5 種生物群系、7 升級樹＋6 模組、清理小遊戲、排行榜整合
- ✅ 隨機事件（地震/油田/幸運加成）豐富度高
- ⚠️ 程式碼超 2000 行，修改複雜
- ⚠️ 鑽探方向單一（只能往下），敵人 AI 簡單

#### 地球再生 `earth-civilization/`
- ✅ 5 時代進程、多種建築、與太空 Roguelike 跨遊戲連動（localStorage）
- ⚠️ 後期被動收入過慢，地形靜態無互動
- ⚠️ 大型檔案，修改需注意 token 上限

#### FPS 射擊 `fps/`
- ✅ 完整光線追蹤引擎、爆頭機制、3 種武器、小地圖
- ⚠️ 敵人 AI 會卡牆（需定期重置路徑）
- ⚠️ 地圖尺寸固定（14×16）、爆頭判定有時偏移

#### 勇者傳說 `hero/`
- ✅ 完整 RPG 系統：職業/技能/裝備/天賦/地城/Boss，存檔完善
- ✅ 登入獎勵、連線計算、技能拖曳 UI
- ⚠️ 3369 行，修改需特別謹慎分塊
- ⚠️ 後期裝備掉落 RNG 過重，玩家卡關感明顯

#### 進化蚊子 `mosquito/`
- ✅ 吸血點擊升級、進化路線、Boss 戰、商店系統
- ⚠️ 點擊疲勞感（放置元素不足）
- ⚠️ 第 6 隻起才開始被攻擊，早期太安全

#### 虛空領航員 `space-roguelike/`
- ✅ 太空探索+採礦、燃料管理、Meta 升級跨局保留、與地球文明跨遊戲連動
- ⚠️ 大型檔案 ~2402 行，加速器燃料消耗平衡需注意
- ⚠️ 武器種類偏少，後期戰鬥重複性高

#### 水豚小村 `village/`
- ✅ 有收集/採集冷卻、多村莊、行為日誌系統
- ⚠️ 缺乏長期目標，建設感不強
- ⚠️ UI 資訊密度偏低，玩家不易判斷進度

#### VIRUS.EXE `virus/`
- ✅ 賽博朋克視覺風格強烈、VT323 字型、多層防禦機制
- ✅ 2026 版含完整音效
- ⚠️ 學習曲線陡，新手不易理解規則
- ⚠️ 大型檔案 ~2403 行

#### 殭屍蔓延 Zombie Idle `zombie-idle/`
- ✅ 點擊 + 放置雙核心、殭屍擴散機制、存檔
- ⚠️ 後期缺乏 Prestige（重置循環）機制，目標感不足
- ⚠️ UI 有部分元素偏小

#### 末日求生 `zombie-spread/` ← 新作（2026/3/19）
- ✅ 使用 PostApocalypse 素材包、3 種殭屍 sprite、波次系統+跳過按鈕
- ✅ 滑鼠射擊、WASD 移動、補給掉落、換彈機制
- ⚠️ 剛完成，尚未充分測試；地圖背景過於簡單（純黑格線）
- ⚠️ 殭屍 sprite 縮放比例可能需要微調（frameW 各動畫不同）

---

## 使用者電腦環境（素材上傳路徑）

使用者有兩台電腦，請在對話開始時先確認是哪台，才給正確路徑指令。

### 辨認方式
叫使用者在 CMD 跑：
```cmd
echo %COMPUTERNAME%
```

### 筆電（目前已確認）
| 項目 | 路徑 |
|------|------|
| Git repo（本機） | `C:\Users\User\capyworlds` |
| 素材下載落地位置 | `C:\Users\User\Desktop\capyworlds\assets\` |
| 上傳素材指令 | 見下方「素材上傳 SOP」 |

### ACER 主機（路徑待確認）
第一次用 ACER 時請先跑 `echo %COMPUTERNAME%` 和 `echo %USERPROFILE%`，回報給 Claude 更新此欄位。

---

## 素材上傳 SOP（Windows CMD）

每次上傳新素材資料夾到 GitHub assets，照這個流程：

```cmd
:: 1. 把素材從落地位置複製進 git repo（筆電）
xcopy "C:\Users\User\Desktop\capyworlds\assets\<資料夾名稱>" "C:\Users\User\capyworlds\assets\<資料夾名稱>\" /E /I /Y

:: 2. 進 git repo
cd C:\Users\User\capyworlds

:: 3. 確認 git 有看到新資料夾
git status

:: 4. 加入 commit push
git add "assets\<資料夾名稱>"
git commit -m "Add <資料夾名稱>"
git push origin main
```

**常見錯誤：** `pathspec did not match any files` → 代表複製沒成功，先確認 `git status` 有沒有看到資料夾。

---

## 歷史對話重點紀錄

- **2026/3/19** 彈幕按鈕移到右上角，配色改用主題變數（與主題切換器一致）
- **2026/3/19** 節拍戰士 bug 修：第二關「繼續」按鈕按了 overlay 不消失 → 已修 `showOverlay`
- **2026/3/19** 節拍戰士音效：從 WebAudio 合成音改為素材庫真實音效（PickUp/Impact/PowerUp/Success/Negative 系列）
- **2026/3/19** 素材 `PostApocalypse_AssetPack_v1.1.2` 待上傳（路徑確認後請繼續）
