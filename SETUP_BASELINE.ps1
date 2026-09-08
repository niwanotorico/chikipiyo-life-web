$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "=== Baseline setup ==="

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw "git が見つかりません。"
}

if (-not (Test-Path ".git")) {
    git init
    if ($LASTEXITCODE -ne 0) { throw "git init failed" }
}

$ignorePath = Join-Path $ProjectRoot ".gitignore"
$required = @(
    "node_modules/",
    "dist/",
    "manager-loop.log"
)

$existing = ""
if (Test-Path $ignorePath) {
    $existing = [System.IO.File]::ReadAllText($ignorePath, [Text.Encoding]::UTF8)
}

$add = @()
foreach ($x in $required) {
    if ($existing -notmatch "(?m)^\s*" + [regex]::Escape($x) + "\s*$") {
        $add += $x
    }
}

if ($add.Count -gt 0) {
    $prefix = ""
    if ($existing.Length -gt 0 -and -not $existing.EndsWith("`n")) {
        $prefix = "`r`n"
    }
    [System.IO.File]::AppendAllText(
        $ignorePath,
        $prefix + ($add -join "`r`n") + "`r`n",
        $utf8NoBom
    )
    Write-Host ".gitignore を確認・更新しました。"
}

# Windows PowerShell 5.1では git の stderr が ErrorActionPreference=Stop に
# 引っかかることがあるため、cmd.exe 経由で静かに HEAD の有無を確認する。
cmd.exe /c "git rev-parse --verify HEAD >nul 2>nul"
$hasHead = ($LASTEXITCODE -eq 0)

if ($hasHead) {
    Write-Host ""
    Write-Host "Baseline commit は既にあります。"
    git log -1 --oneline
    exit 0
}

Write-Host ""
Write-Host "初回 baseline として登録予定:"
git status --short

Write-Host ""
$ans = Read-Host "この状態を baseline commit してよいですか？ (y/n)"
if ($ans -notin @("y","Y","yes","YES")) {
    Write-Host "中止しました。"
    exit 1
}

git add .
if ($LASTEXITCODE -ne 0) {
    throw "git add failed"
}

git commit -m "Baseline before manager loop"
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "commit に失敗しました。Git user.name / user.email 未設定の可能性があります。"
    Write-Host "この画面をチャッピーに見せてください。"
    exit 2
}

Write-Host ""
Write-Host "Baseline commit 完了:"
git log -1 --oneline
