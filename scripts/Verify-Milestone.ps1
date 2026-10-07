param([Parameter(Mandatory = $true)][string]$Stage)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$reportDirectory = Join-Path $projectRoot 'verification'
New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
function Run-Check([string]$Name, [string]$Command, [string[]]$Arguments, [string]$Directory) {
    Push-Location $Directory
    try {
        $log = Join-Path $reportDirectory "$Stage-$Name.log"
        & $Command @Arguments *> $log
        if ($LASTEXITCODE -ne 0) { Get-Content -LiteralPath $log -Tail 100; throw "$Name failed" }
        Write-Output "$Stage : $Name PASS"
    } finally { Pop-Location }
}
Run-Check 'tests' 'npm.cmd' @('test', '--', '--maxWorkers=4') (Join-Path $projectRoot 'client')
Run-Check 'client-build' 'npm.cmd' @('run', 'build') (Join-Path $projectRoot 'client')
Run-Check 'server-build' 'dotnet' @('build', 'server/FantasyShelter.Server.csproj', '--nologo', '--output', (Join-Path $reportDirectory 'server')) $projectRoot
Run-Check 'checkpoint' 'pwsh' @('-NoProfile', '-File', 'server/tests/Smoke.Tests.ps1', '-ServerDll', (Join-Path $reportDirectory 'server/FantasyShelter.Server.dll')) $projectRoot
[pscustomobject]@{ stage = $Stage; verifiedAt = [DateTimeOffset]::UtcNow.ToString('O'); checks = @('tests', 'client-build', 'server-build', 'checkpoint') } |
    ConvertTo-Json | Set-Content -LiteralPath (Join-Path $reportDirectory "$Stage.json") -Encoding utf8
