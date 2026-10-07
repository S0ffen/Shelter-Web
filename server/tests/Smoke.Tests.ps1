#Requires -Version 7.0
param([string]$ServerDll)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$testDirectory = Join-Path $projectRoot ('server/test-results/' + [guid]::NewGuid())
New-Item -ItemType Directory -Path $testDirectory -Force | Out-Null
$testServerDll = if ($ServerDll) { $ServerDll } else { Join-Path $projectRoot 'server/bin/Debug/net8.0/FantasyShelter.Server.dll' }
if (-not (Test-Path -LiteralPath $testServerDll)) { throw 'Build the server first: dotnet build server/FantasyShelter.Server.csproj' }
$dotnetPath = (Get-Command dotnet).Source
$api = 'http://127.0.0.1:5081'
$serverProcess = $null
$checks = 0

function Start-TestServer {
    $arguments = @('"' + $testServerDll + '"', '--urls', $api, '--DataDirectory', '"' + $testDirectory + '"')
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
    Check ((Invoke-RestMethod "$api/api/config").survival.dayDuration -eq 180) 'Shared survival config was not loaded'
    $placements = Get-Content -Raw (Join-Path $projectRoot 'shared/resources.json') | ConvertFrom-Json
    $definitions = Get-Content -Raw (Join-Path $projectRoot 'shared/harvesting.json') | ConvertFrom-Json -AsHashtable
    $settings = Get-Content -Raw (Join-Path $projectRoot 'shared/survival.json') | ConvertFrom-Json -AsHashtable
    $skillConfig=Get-Content -Raw (Join-Path $projectRoot 'shared/skills.json') | ConvertFrom-Json -AsHashtable
    $perkLevels=@{};foreach($branch in $skillConfig.branches.Values){foreach($perk in $branch){$perkLevels[$perk.id]=0}}
    $snapshot = @{
        outcome = 'active'; version = (Get-Content -Raw (Join-Path $projectRoot 'shared/checkpoint.json') | ConvertFrom-Json).version; runId = [guid]::NewGuid().ToString(); savedAt = [DateTimeOffset]::UtcNow.ToString('O')
        elapsed = 170; totalKills = 4; swordCooldown = 1.2; swordCooldownDuration = 1.4; shelterHp = 475; shelterLevel = 2; repairCooldown = 1
        player = @{ hp = 90; position = @{ x = -6; z = -8 }; yaw = 0.22 }
        encounters = @{ forgeGuardianDefeated = $false; graveGuardianDefeated = $false; ravagerDefeated = $false; finalBossDefeated = $false };
        finalArenaActive = $false
        skills = @{ points = 4; levels = $perkLevels };
        abilities = @{ cloak=0; cloakCooldown=0; barrageCooldown=0; demolitionCooldown=0; shield=0; shieldCooldown=0; sinceDamage=0; idle=0; lastPosition=@{x=-6;z=-8} }; bossHazards=@();
        corruption = @{ value = 100; damageElapsed = 2.5 };
        resources = @{ wood = 13; iron = 8 }; carried = @{ wood = 9; iron = 1 }; settings = $settings
        cycle = @{ day = 2; period = 'night'; periodElapsed = 12; pendingSpawns = 5; waveSize = 12; spawnCountdown = 1; patrolCountdown = 0 }
        spawner = @{ seed = 42; nextId = 2 }
        nodes = @($placements | ForEach-Object { @{ id = $_.id; health = $definitions[$_.type].maxHealth } })
        buildings = @(); towers = @(); projectiles = @()
        zombies = @(@{ id = 'zombie-1'; kind = 'tank'; hp = 266; position = @{ x = -6; z = 13 }; origin = @{ x = -6; z = 13 }; patrolTarget = @{ x = -6; z = 13 }; mode = 'siege'; intent = 'shelter'; chargeCooldown=4;chargeRemaining=0;chargeTarget=$null;chargeHit=$false;specialCooldown=3; summonCooldown=10; retreatTimer=0; slow=0; windup = 0; windupTarget = $null; attackCooldown = 0; deathAge = 0 })
    }
    $snapshot.nodes[0].health = 66
    Check ((Put-Checkpoint $snapshot).StatusCode -eq 200) 'Valid checkpoint rejected'
    $loaded = Invoke-RestMethod "$api/api/checkpoint"
    Check ($loaded.runId -eq $snapshot.runId -and $loaded.nodes[0].health -eq 66 -and $loaded.cycle.pendingSpawns -eq 5 -and $loaded.carried.wood -eq 9) 'Checkpoint state did not roundtrip'
    $combatSave = $snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $combatSave.skills.levels['weapon-mastery'] = 1; $combatSave.skills.levels['health-up'] = 1; $combatSave.skills.levels['battle-tempo'] = 1; $combatSave.skills.points = 1; $combatSave.player.hp = 110
    $combatSave.swordCooldownDuration = 1.4 / 1.05; $combatSave.swordCooldown = 1
    Check ((Put-Checkpoint $combatSave).StatusCode -eq 200) 'Combat perks checkpoint rejected'
    $engineerSave = $snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $engineerSave.skills.levels['beginner-engineer'] = 2; $engineerSave.skills.points = 2
    $engineerSave.buildings = @(@{ id = 'building-1'; kind = 'arcane-core'; position = @{ x = -13; z = -13 }; rotation = 0; hp = 240 })
    Check ((Put-Checkpoint $engineerSave).StatusCode -eq 200) 'Engineer building health checkpoint rejected'
    $advancedSave=$snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $advancedSave.cycle.day=100;$advancedSave.skills.points=102
    foreach($branch in $skillConfig.branches.Values){foreach($perk in $branch){$advancedSave.skills.levels[$perk.id]=$perk.maxRank;$advancedSave.skills.points-=$perk.maxRank}}
    $advancedSave.player.hp=150;$advancedSave.swordCooldownDuration=1.4/1.15;$advancedSave.swordCooldown=1
    $advancedSave.carried.wood=60;$advancedSave.carried.iron=38;$advancedSave.abilities.cloak=5;$advancedSave.abilities.cloakCooldown=80
    Check ((Put-Checkpoint $advancedSave).StatusCode -eq 200) 'Fully expanded tree, backpack and Cloak checkpoint rejected'
    Check ((Invoke-RestMethod "$api/api/checkpoint").carried.iron -eq 38) 'Expanded backpack did not persist'
    $bossSave=$snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $bossSave.zombies=@(@{id='curse-overlord';kind='overlord';hp=16000;position=@{x=102.9;z=224.2};origin=@{x=102.9;z=224.2};patrolTarget=@{x=102.9;z=224.2};mode='guard';intent='player';windup=1;windupTarget=@{x=102.9;z=214.2};chargeCooldown=8;chargeRemaining=0;chargeTarget=@{x=102.9;z=214.2};chargeHit=$false;specialCooldown=6;summonCooldown=10;retreatTimer=0;slow=0;attackCooldown=1.9;deathAge=0})
    $bossSave.player.position=@{x=102.9;z=214.2};$bossSave.finalArenaActive=$true
    Check ((Put-Checkpoint $bossSave).StatusCode -eq 200) 'Boss telegraph checkpoint rejected'
    Check ((Invoke-RestMethod "$api/api/checkpoint").finalArenaActive -and (Invoke-RestMethod "$api/api/checkpoint").zombies[0].chargeTarget.z -eq 214.2) 'Arena or charge did not persist'
    $escaped=$bossSave | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $escaped.player.position=@{x=1.5;z=-7}
    Check ((Put-Checkpoint $escaped).StatusCode -eq 400) 'Arena escape checkpoint accepted'
    $victorySave = $snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
    $victorySave.outcome = 'won'; $victorySave.encounters.finalBossDefeated = $true
    Check ((Put-Checkpoint $victorySave).StatusCode -eq 200) 'Victory checkpoint rejected'
    Check ((Invoke-RestMethod "$api/api/checkpoint").outcome -eq 'won') 'Victory outcome not persisted'
    Put-Checkpoint $snapshot | Out-Null
    foreach ($kind in @('version', 'health', 'node', 'capacity', 'duplicate', 'position', 'arcane-currency', 'outside-base', 'off-pad', 'attack-timer', 'zombie-kind', 'runner-health', 'shelter-level', 'repair-cooldown', 'backpack', 'backpack-extra', 'corruption', 'curse-timer', 'skill-budget', 'skill-level', 'guardian-state', 'windup', 'fake-victory','skill-tier','skill-prerequisite','ability','hazard','boss-timer','arena-without-boss','charge-timer','charged-tank','grave-state','ravager-state')) {
        $bad = $snapshot | ConvertTo-Json -Depth 30 | ConvertFrom-Json -AsHashtable
        switch ($kind) {
            'version' { $bad.version = 1 }
            'health' { $bad.player.hp = 0 }
            'node' { $bad.nodes[0].id = 'wood-unknown' }
            'backpack' { $bad.carried.wood = 31 }
            'backpack-extra' { $bad.carried.arcane = 1 }
            'corruption' { $bad.corruption.value = 101 }
            'curse-timer' { $bad.corruption.damageElapsed = 3 }
            'skill-budget' { $bad.skills.points = 100 }
            'skill-level' { $bad.skills.levels['health-up'] = 4 }
            'skill-tier' { $bad.skills.levels['armor']=1;$bad.skills.points=3 }
            'skill-prerequisite' { $bad.skills.levels['health-up']=3;$bad.skills.levels['weapon-mastery-ii']=1;$bad.skills.points=0 }
            'ability' { $bad.abilities.cloak=1 }
            'hazard' { $bad.bossHazards=@(@{id=4;position=@{x=0;z=75};remaining=1;radius=99;damage=32}) }
            'arena-without-boss' {$bad.finalArenaActive=$true}
            'charge-timer' {$bad.zombies[0].chargeCooldown=9}
            'charged-tank' {$bad.zombies[0].chargeRemaining=.5;$bad.zombies[0].chargeTarget=@{x=0;z=0}}
            'grave-state' {$bad.encounters.graveGuardianDefeated='yes'}
            'ravager-state' {$bad.encounters.ravagerDefeated='yes'}
            'boss-timer' { $bad.zombies[0].specialCooldown=100 }
            'guardian-state' { $bad.encounters.forgeGuardianDefeated = 'yes' }
            'windup' { $bad.zombies[0].windup = 1; $bad.zombies[0].windupTarget = $null }
            'fake-victory' { $bad.outcome = 'won' }
            'capacity' { $bad.resources.wood = 101 }
            'duplicate' { $bad.nodes[1].id = $bad.nodes[0].id }
            'position' { $bad.player.position.x = 999 }
            'arcane-currency' { $bad.resources.arcane = 10 }
            'off-pad' { $bad.buildings = @(@{ id = 'building-1'; kind = 'arcane-core'; position = @{ x = -4; z = -7 }; rotation = 0; hp = 200 }) }
            'attack-timer' { $bad.swordCooldownDuration = 0.65 }
            'zombie-kind' { $bad.zombies[0].kind = 'unknown' }
            'runner-health' { $bad.zombies[0].kind = 'fast'; $bad.zombies[0].hp = 100 }
            'shelter-level' { $bad.shelterLevel = 1 }
            'repair-cooldown' { $bad.repairCooldown = 5 }
            'outside-base' { $bad.buildings = @(@{ id = 'building-1'; kind = 'arcane-core'; position = @{ x = 25; z = 20 }; rotation = 0; hp = 200 }) }
        }
        Check ((Put-Checkpoint $bad).StatusCode -eq 400) "Invalid $kind checkpoint accepted"
    }
    Check ((Invoke-RestMethod "$api/api/checkpoint").runId -eq $snapshot.runId) 'Invalid save overwrote the last valid checkpoint'
    $result = @{ runId = $snapshot.runId; day = 2; kills = 4; elapsed = 170 } | ConvertTo-Json
    Invoke-RestMethod "$api/api/runs" -Method Post -ContentType 'application/json' -Body $result | Out-Null
    Invoke-RestMethod "$api/api/runs" -Method Post -ContentType 'application/json' -Body $result | Out-Null
    Check ((Invoke-RestMethod "$api/api/runs").Count -eq 1) 'Retry created duplicate run results'
    Stop-TestServer
    # Recreate the old Runs schema on the isolated database to verify migration without touching user data.
    $legacySchemaScript = @'
import { DatabaseSync } from 'node:sqlite';
const database = new DatabaseSync(process.argv[1]);
database.exec('ALTER TABLE Runs DROP COLUMN Outcome; DELETE FROM SchemaInfo WHERE Version >= 2');
database.close();
'@
    node --input-type=module -e $legacySchemaScript (Join-Path $testDirectory 'shelter.db')
    Check ($LASTEXITCODE -eq 0) 'Could not prepare the isolated legacy database'
    Start-TestServer
    $afterRestart = Invoke-RestMethod "$api/api/checkpoint"
    Check ($afterRestart.runId -eq $snapshot.runId -and $afterRestart.shelterHp -eq 475) 'SQLite checkpoint did not survive server restart'
    Check ((Invoke-RestMethod "$api/api/runs").Count -eq 1) 'Run history did not survive server restart'
    Check ((Invoke-RestMethod "$api/api/health").schemaVersion -eq 2) 'Schema migration not reported'
    Check ((Invoke-RestMethod "$api/api/runs")[0].outcome -eq 'lost') 'Legacy run result was not preserved'
    $winResult = @{ runId = [guid]::NewGuid().ToString(); day = 7; kills = 85; elapsed = 1510; outcome = 'won' } | ConvertTo-Json
    Invoke-RestMethod "$api/api/runs" -Method Post -ContentType 'application/json' -Body $winResult | Out-Null
    Check ((Invoke-RestMethod "$api/api/runs")[0].outcome -eq 'won') 'Won result not recorded'
    Stop-TestServer
    Start-TestServer
    Check ((Invoke-RestMethod "$api/api/runs").Count -eq 2) 'Won/lost history did not survive restart'
    Write-Output "$checks server checks passed; database preserved at $testDirectory/shelter.db"
} finally { Stop-TestServer }
