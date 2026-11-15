# Renders every slide in posts.html to a 1080x1350 PNG with headless Chrome.
# Run from anywhere:  powershell -File marketing\instagram\render.ps1
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$chrome = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$out = Join-Path $here "png"
New-Item -ItemType Directory -Force $out | Out-Null
$html = (Join-Path $here "posts.html") -replace '\\', '/'
$ids = Select-String -Path (Join-Path $here "posts.html") -Pattern '^\s+"(\d\d-[a-z0-9-]+)":' | ForEach-Object { $_.Matches[0].Groups[1].Value }
$profile = Join-Path $env:TEMP "indifferent-render-profile"
foreach ($id in $ids) {
  $png = Join-Path $out "$id.png"
  & $chrome --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 `
    --user-data-dir="$profile" --window-size=1080,1350 --virtual-time-budget=6000 `
    --screenshot="$png" "file:///$html#$id" 2>$null | Out-Null
  Write-Output "$id -> $(if (Test-Path $png) { 'ok' } else { 'FAILED' })"
}
