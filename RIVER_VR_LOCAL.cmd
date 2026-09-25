@echo off
chcp 65001 >nul
setlocal EnableExtensions
title ちきぴよ渓流 VR ローカル起動
cd /d "%~dp0"

rem ============================================================
rem  ダブルクリックだけで：Vite起動 → Chrome/Edge で渓流ページを開く
rem  （?xr 付きで開くので「VRで入る」ボタンは必ず表示される）
rem  サーバーを止めるときは「RIVER VITE」ウィンドウを閉じる
rem ============================================================

set "PORT=5173"
set "PAGE=http://127.0.0.1:%PORT%/river.html"
set "URL=%PAGE%?xr"

where npm >nul 2>nul || (echo [エラー] Node.js（npm）が見つかりません。Node.js をインストールしてください。& pause & exit /b 1)

if not exist "node_modules\vite" (
  echo 初回セットアップ中（npm install）...
  call npm install || (echo [エラー] npm install に失敗しました。& pause & exit /b 1)
)

rem すでにサーバーが動いていればそれを使う
curl -s -f -o nul "%PAGE%" >nul 2>nul && goto open

echo ローカルサーバー（Vite）を起動しています...
start "RIVER VITE - 閉じるとサーバー停止" /min cmd /k "npm run dev -- --port %PORT% --strictPort"

set /a TRIES=0
:wait
timeout /t 1 /nobreak >nul
curl -s -f -o nul "%PAGE%" >nul 2>nul && goto open
set /a TRIES+=1
if %TRIES% lss 60 goto wait
echo [エラー] 60秒待ってもサーバーが起動しませんでした。
echo 「RIVER VITE」ウィンドウのメッセージを確認してください（ポート %PORT% が他で使われている等）。
pause
exit /b 1

:open
set "BROWSER="
for %%B in ("%ProgramFiles%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" "%LocalAppData%\Google\Chrome\Application\chrome.exe" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe") do (
  if not defined BROWSER if exist "%%~B" set "BROWSER=%%~B"
)
if defined BROWSER (
  start "" "%BROWSER%" --new-window "%URL%"
) else (
  start "" "%URL%"
)

echo.
echo 渓流ページを開きました：%URL%
echo Virtual Desktop でつないだ状態で、ページ左下の「VRで入る」を押してください。
echo サーバーを止めるときは、タスクバーの「RIVER VITE」ウィンドウを閉じます。
echo （このウィンドウは数秒で閉じます）
timeout /t 8 >nul
exit /b 0
