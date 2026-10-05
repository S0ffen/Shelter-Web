#Requires -Version 7.0
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$testDirectory = Join-Path $projectRoot ('server/test-results/' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
$serverDll = Join-Path $projectRoot 'server/bin/Debug/net8.0/FantasyShelter.Server.dll'
if (-not (Test-Path -LiteralPath $serverDll)) { throw 'Build the server first: dotnet build server/FantasyShelter.Server.csproj' }
$dotnetPath = (Get-Command dotnet).Source
$api = 'http://127.0.0.1:5081'
$serverProcess = $null
$checks = 0

function Start-TestServer {
    $arguments = @('"' + $serverDll + '"', '--urls', $api, '--DataDirectory', '"' + $testDirectory + '"')
    $script:serverProcess = Start-Process -FilePath $dotnetPath -ArgumentList $arguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $testDirectory 'server.out.log') -RedirectStandardError (Join-Path $testDirectory 'server.err.log')
    for ($attempt = 0; $attempt -lt 50; $attempt++) {
        try {
            if ((Invoke-RestMethod "$api/api/health").status -eq 'ok') { return }
        } catch { Start-Sleep -Milliseconds 200 }
        if ($script:serverProcess.HasExited) { throw (Get-Content -Raw (Join-Path $testDirectory 'server.err.log')) }
    }
    throw 'Test server did not start'
}
function Stop-TestServer {
    if ($null -ne $script:serverProcess -and -not $script:serverProcess.HasExited) {
        Stop-Process -Id $script:serverProcess.Id
        $script:serverProcess.WaitForExit()
    }
}
function Check($condition, $message) {
    if (-not $condition) { throw $message }
    $script:checks++
}
function Put-Checkpoint($body) {
    Invoke-WebRequest "$api/api/checkpoint" -Method Put -ContentType 'application/json' -Body ($body | ConvertTo-Json -Depth 30) -SkipHttpErrorCheck
}

try {
    try { Invoke-RestMethod "$api/api/health" | Out-Null; throw 'Port 5081 is already occupied; stop its test service first.' }
    catch { if ($_.Exception.Message -like 'Port*') { throw } }
    Start-TestServer
    Check ((Invoke-WebRequest "$api/api/checkpoint").StatusCode -eq 204) 'Fresh SQLite should contain no checkpoint'
    Check ((Invoke-RestMethod "$api/api/config").survival.dayDuration -eq 150) 'Shared survival config was not loaded'
    $placements = Get-Content -Raw (Join-Path $projectRoot 'shared/resources.json') | ConvertFrom-Json
    $definitions = Get-Content -Raw (Join-Path $projectRoot 'shared/harvesting.json') | ConvertFrom-Json -AsHashtable
    $settings = Get-Content -Raw (Join-Path $projectRoot 'shared/survival.json') | ConvertFrom-Json -AsHashtable
    $snapshot = @{
        version = 2; runId = [guid]::NewGuid().ToString(); savedAt = [DateTimeOffset]::UtcNow.ToString('O')
        elapsed = 170; totalKills = 4; swordCooldown = 0; shelterHp = 275
        player = @{ hp = 90; position = @{ x = -6; z = -8 }; yaw = 0.22 }
        resources = @{ wood = 13; iron = 8 }; settings = $settings
        cycle = @{ day = 2; period = 'night'; periodElapsed = 12; pendingSpawns = 5; waveSize = 12; spawnCountdown = 1; patrolCountdown = 0 }
        spawner = @{ seed = 42; nextId = 2 }
        nodes = @($placements | ForEach-Object { @{ id = $_.id; health = $definitions[$_.type].maxHealth } })
        buildings = @(); towers = @(); projectiles = @()
        zombies = @(@{ id = 'zombie-1'; hp = 66; position = @{ x = -6; z = 13 }; origin = @{ x = -6; z = 13 }; patrolTarget = @{ x = -6; z = 13 }; mode = 'siege'; intent = 'shelter'; attackCooldown = 0; deathAge = 0 })
    }
    $snapshot.nodes[0].health = 66
    Check ((Put-Checkpoint $snapshot).StatusCode -eq 200) 'Valid checkpoint rejected'
    $loaded = Invoke-RestMethod "$api/api/checkpoint"
    Check ($loaded.runId -eq $snapshot.runId -and $loaded.nodes[0].health -eq 66 -and $loaded.cycle.pendingSpawns -eq 5) 'Checkpoint state did not roundtrip'
    foreach ($kind in @('version', 'health', 'node', 'capacity', 'duplicate', 'position', 'arcane-currency', 'outside-base')) {
        $bad = $snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
        switch ($kind) {
            'version' { $bad.version = 1 }
            'health' { $bad.player.hp = 0 }
            'node' { $bad.nodes[0].id = 'wood-unknown' }
            'capacity' { $bad.resources.wood = 101 }
            'duplicate' { $bad.nodes[1].id = $bad.nodes[0].id }
            'position' { $bad.player.position.x = 999 }
            'arcane-currency' { $bad.resources.arcane = 10 }
            'outside-base' { $bad.buildings = @(@{ id = 'building-1'; kind = 'arcane-core'; position = @{ x = 25; z = 20 }; rotation = 0 }) }
        }
        Check ((Put-Checkpoint $bad).StatusCode -eq 400) "Invalid $kind checkpoint accepted"
    }
    Check ((Invoke-RestMethod "$api/api/checkpoint").runId -eq $snapshot.runId) 'Invalid save overwrote the last valid checkpoint'
    $result = @{ runId = $snapshot.runId; day = 2; kills = 4; elapsed = 170 } | ConvertTo-Json
    Invoke-RestMethod "$api/api/runs" -Method Post -ContentType 'application/json' -Body $result | Out-Null
    Invoke-RestMethod "$api/api/runs" -Method Post -ContentType 'application/json' -Body $result | Out-Null
    Check (@(Invoke-RestMethod "$api/api/runs").Count -eq 1) 'Retry created duplicate run results'
    Stop-TestServer
    Start-TestServer
    $afterRestart = Invoke-RestMethod "$api/api/checkpoint"
    Check ($afterRestart.runId -eq $snapshot.runId -and $afterRestart.shelterHp -eq 275) 'SQLite checkpoint did not survive server restart'
    Check (@(Invoke-RestMethod "$api/api/runs").Count -eq 1) 'Run history did not survive server restart'
    Write-Output "$checks server checks passed; database preserved at $testDirectory/shelter.db"
} finally { Stop-TestServer }
