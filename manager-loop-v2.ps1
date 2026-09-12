$ErrorActionPreference = "Stop"

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[Console]::InputEncoding = $utf8NoBom
[Console]::OutputEncoding = $utf8NoBom
$OutputEncoding = $utf8NoBom

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

$LogFile     = Join-Path $ProjectRoot "manager-loop.log"
$TaskFile    = Join-Path $ProjectRoot "CURRENT_TASK.md"
$ClaudePre   = Join-Path $ProjectRoot "CLAUDE_REVIEW.md"
$CodexReport = Join-Path $ProjectRoot "CODEX_REPORT.md"
$ClaudeFinal = Join-Path $ProjectRoot "CLAUDE_FINAL_REVIEW.md"

function Log($msg) {
    $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $msg
    Write-Host $line
    [System.IO.File]::AppendAllText($LogFile, $line + [Environment]::NewLine, $utf8NoBom)
}
function WriteUtf8($path, $text) {
    [System.IO.File]::WriteAllText($path, $text, $utf8NoBom)
}
function ReadUtf8($path) {
    return [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
}
function NeedCmd($name) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) { throw "Command not found: $name" }
}
function StatusAfterHeading($text, $heading) {
    $pattern = "(?ms)^##\s+" + [regex]::Escape($heading) + "\s*\r?\n\s*([A-Z_]+)\s*$"
    $m = [regex]::Match($text, $pattern)
    if ($m.Success) { return $m.Groups[1].Value.Trim() }
    return $null
}

try {
    Log "=== Manager loop v2 start ==="

    NeedCmd "git"
    NeedCmd "claude"
    NeedCmd "codex.cmd"

    if (-not (Test-Path $TaskFile)) { throw "CURRENT_TASK.md が見つかりません。" }
    if (-not (Test-Path ".git")) { throw ".git がありません。先に SETUP_BASELINE.cmd を実行してください。" }

    & git rev-parse --verify HEAD *> $null
    if ($LASTEXITCODE -ne 0) { throw "Git baseline commit がありません。先に SETUP_BASELINE.cmd を実行してください。" }

    $baselineHead = (& git rev-parse HEAD).Trim()

    Log "STEP 1/3: Claude design review"

    $prePrompt = @"
Read CLAUDE.md, CURRENT_TASK.md, README.md, the referenced character sheet if available,
and only the source files needed for this task.

Do NOT modify any files.
Return ONLY valid Markdown for CLAUDE_REVIEW.md with exactly these sections:

# CLAUDE REVIEW
## Review
## Relevant Files / Architecture
## Risks
## Recommended Implementation
## Test Points
## Approval

The value under ## Approval must be exactly one of:
APPROVED
APPROVED_WITH_NOTES
CHANGES_REQUIRED

This is the PRE-IMPLEMENTATION review for Codex/Astra.
"@

    $pre = (& claude -p $prePrompt | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Claude pre-review failed: $LASTEXITCODE" }
    if ([string]::IsNullOrWhiteSpace($pre)) { throw "Claude pre-review returned empty output." }

    WriteUtf8 $ClaudePre $pre
    Log "Claude review saved to CLAUDE_REVIEW.md"

    $approval = StatusAfterHeading $pre "Approval"
    if ($approval -eq "CHANGES_REQUIRED") {
        Log "Claude requested changes. Stopping before implementation."
        exit 2
    }
    if ($approval -notin @("APPROVED","APPROVED_WITH_NOTES")) {
        throw "Invalid or missing Claude Approval: $approval"
    }

    Log "STEP 2/3: Codex/Astra implementation"

    $sentinel = @"
# CODEX REPORT

## Work Performed
NOT_STARTED

## Files Changed
NONE

## Tests
NOT_RUN

## Known Limitations
NONE

## Review Notes
NONE

## Status
PENDING
"@
    WriteUtf8 $CodexReport $sentinel
    $reportBefore = (Get-Item $CodexReport).LastWriteTimeUtc.Ticks

    $codexPrompt = @"
Read AGENTS.md, CURRENT_TASK.md, CLAUDE_REVIEW.md, README.md,
and the referenced character sheet if available.

You are the IMPLEMENTATION engineer.
Do not stop at analysis, planning, review, or recommendations.

Your job in this turn is to ACTUALLY EDIT THE REPOSITORY FILES and complete the task.

Mandatory execution rules:
1. Inspect the relevant implementation files.
2. Make the required code changes in the repository.
3. Do not return a plan instead of implementation.
4. Do not end the turn with "No files changed" unless the task is genuinely impossible.
5. If implementation is impossible, explain why in CODEX_REPORT.md and use Status: BLOCKED.
6. After editing, run the relevant tests/build checks.
7. Verify the changed files with git diff or git status.
8. Rewrite CODEX_REPORT.md before finishing.

The task is not complete unless:
- at least one real implementation file is changed, OR
- Status is BLOCKED with a concrete technical reason.

Follow Claude's approved guidance when reasonable.
Make the smallest safe code changes possible.
Preserve unrelated existing behavior.

CODEX_REPORT.md must use exactly these sections:

# CODEX REPORT
## Work Performed
## Files Changed
## Tests
## Known Limitations
## Review Notes
## Status

The value under ## Status must be exactly one of:
DONE
DONE_WITH_NOTES
BLOCKED

Do not modify CURRENT_TASK.md or CLAUDE_REVIEW.md.
"@

    & codex.cmd exec $codexPrompt
    if ($LASTEXITCODE -ne 0) { throw "Codex/Astra failed: $LASTEXITCODE" }

    $reportAfter = (Get-Item $CodexReport).LastWriteTimeUtc.Ticks
    if ($reportAfter -eq $reportBefore) {
        throw "Codex/Astra が CODEX_REPORT.md を更新していません。"
    }

    $report = ReadUtf8 $CodexReport
    $status = StatusAfterHeading $report "Status"

    if ($status -eq "BLOCKED") {
        Log "Codex/Astra reported BLOCKED."
        exit 4
    }
    if ($status -notin @("DONE","DONE_WITH_NOTES")) {
        throw "Codex/Astra Status が完了値ではありません: $status"
    }

    $gitChanges = (& git status --porcelain | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($gitChanges)) {
        throw "Codex/Astra は DONE を報告しましたが Git 変更が0件です。silent no-op として停止します。"
    }

    Log "STEP 3/3: Claude final review"

    $finalPrompt = @"
You are the FINAL reviewer.

Read:
- CLAUDE.md
- CURRENT_TASK.md
- CLAUDE_REVIEW.md
- CODEX_REPORT.md

Inspect the actual git diff and changed files.
Baseline HEAD: $baselineHead

Do NOT modify any files.
Return ONLY valid Markdown for CLAUDE_FINAL_REVIEW.md with exactly these sections:

# CLAUDE FINAL REVIEW
## What Codex/Astra Changed
## Task Match
## Regressions / Risks
## Test / Build Assessment
## Follow-up
## Final Approval

The value under ## Final Approval must be exactly one of:
APPROVED
APPROVED_WITH_NOTES
CHANGES_REQUIRED
"@

    $final = (& claude -p $finalPrompt | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw "Claude final review failed: $LASTEXITCODE" }
    if ([string]::IsNullOrWhiteSpace($final)) { throw "Claude final review returned empty output." }

    WriteUtf8 $ClaudeFinal $final
    $finalApproval = StatusAfterHeading $final "Final Approval"
    if ($finalApproval -notin @("APPROVED","APPROVED_WITH_NOTES","CHANGES_REQUIRED")) {
        throw "Invalid or missing Final Approval: $finalApproval"
    }

    Log "=== Manager loop v2 complete ==="
    Write-Host ""
    Write-Host "============================================"
    Write-Host " Manager loop v2 完了"
    Write-Host " 事前レビュー: CLAUDE_REVIEW.md"
    Write-Host " Astra実装報告: CODEX_REPORT.md"
    Write-Host " 最終レビュー: CLAUDE_FINAL_REVIEW.md"
    Write-Host " 最終判定: $finalApproval"
    Write-Host "============================================"

    if ($finalApproval -eq "CHANGES_REQUIRED") { exit 5 }
}
catch {
    Log "ERROR: $($_.Exception.Message)"
    Write-Host ""
    Write-Host "Manager loop v2 stopped:"
    Write-Host $_.Exception.Message
    exit 1
}
