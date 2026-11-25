# Tạo worktree riêng cho 1 agent: powershell -ExecutionPolicy Bypass -File scripts\new-agent-worktree.ps1 codex
param([Parameter(Mandatory=$true)][string]$Name)
$repo = (git rev-parse --show-toplevel).Trim()
$dir  = Join-Path (Split-Path $repo -Parent) ("app-" + $Name)
git worktree add $dir -b ("agent/" + $Name)
if ($LASTEXITCODE -ne 0) { exit 1 }
Push-Location $dir
npm.cmd install
Pop-Location
Write-Host "Xong. Chạy agent trong: $dir"
Write-Host "Xoá khi xong: git worktree remove `"$dir`""
