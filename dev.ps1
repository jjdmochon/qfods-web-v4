<#
    dev.ps1 — Arranca el entorno de desarrollo de QFDOS v4 (Modernist).

    Uso:
        .\dev.ps1              # sincroniza y arranca el servidor local en puerto 3004
        .\dev.ps1 -Static      # arranca el servidor estático zero-build inmediato
#>

param(
    [switch]$Static,
    [int]$Port = 3004
)

$ErrorActionPreference = 'Stop'
$Source = $PSScriptRoot
$Local  = "$env:USERPROFILE\qfdos-v4-node"

if ($Static) {
    Write-Host "Iniciando servidor HTTP zero-build en http://localhost:$Port..." -ForegroundColor Green
    python -m http.server $Port --directory $Source
    exit 0
}

Write-Host 'Sincronizando codigo qfdos-v4 -> disco local...' -ForegroundColor Cyan

if (Test-Path "$Local\src") { Remove-Item "$Local\src" -Recurse -Force }
Copy-Item "$Source\src" "$Local\src" -Recurse -Force

if (Test-Path "$Source\public") {
    if (Test-Path "$Local\public") { Remove-Item "$Local\public" -Recurse -Force }
    Copy-Item "$Source\public" "$Local\public" -Recurse -Force
}

foreach ($f in @('index.html', 'package.json', 'vite.config.ts', 'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json')) {
    if (Test-Path "$Source\$f") { Copy-Item "$Source\$f" $Local -Force }
}

# Liberar puerto
$pids = netstat -ano |
    Select-String "LISTENING" |
    Select-String ":$Port\s" |
    ForEach-Object { ($_ -split '\s+' | Where-Object { $_ })[-1] } |
    Sort-Object -Unique

foreach ($procId in $pids) {
    Write-Host "Cerrando servidor previo en el puerto $Port (pid $procId)" -ForegroundColor Yellow
    taskkill /PID $procId /F 2>&1 | Out-Null
}
if ($pids) { Start-Sleep -Milliseconds 500 }

Push-Location $Local
if (-not (Test-Path "node_modules")) {
    Write-Host "Instalando dependencias en $Local..." -ForegroundColor Yellow
    npm install
}
Write-Host "Iniciando servidor en http://localhost:$Port..." -ForegroundColor Green
npm run dev -- --port $Port --host
Pop-Location
