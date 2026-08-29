# Italiano Travel Trainer MVP

私人用、mobile-first、Android Chrome 優先嘅旅行意大利文學習 web app。

## 功能
- 每日 10 題課程
- 50 個 Travel Italian 高頻字詞
- 每個字附超短例句
- Browser TTS 意大利文發音
- 選擇題聽力
- Android Chrome 語音辨識答題
- 寬鬆「聽得明」判斷
- localStorage 學習進度
- 簡單 spaced repetition score
- 自動錯題本
- streak / 進度
- 主題練習

## 本機開啟
直接用瀏覽器開 `index.html` 已可睇介面。

語音辨識通常要求 HTTPS，所以完整測試建議部署 GitHub Pages。

## GitHub Pages 部署
1. 建立一個 GitHub repository，例如 `italiano-travel-trainer`
2. 將本資料夾內檔案 push 去 repo 根目錄
3. GitHub Repo > Settings > Pages
4. Build and deployment 選 `Deploy from a branch`
5. Branch 選 `main` / `(root)`
6. Save
7. 等 GitHub 產生 Pages 網址後，用 Android Chrome 開
8. 第一次語音題允許麥克風權限
9. Chrome menu > Add to Home screen，可當 app 用

## 注意
- SpeechRecognition 係 browser-dependent；Android Chrome 最適合作為第一版目標。
- 清除瀏覽器 site data 會清除學習進度。
- 下一版可加 Export/Import JSON、真正日期-based SRS、PWA manifest/service worker、旅行前 7 日衝刺模式。
