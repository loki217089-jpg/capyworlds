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
