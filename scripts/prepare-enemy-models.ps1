param([string]$SourceDirectory)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $SourceDirectory) { $SourceDirectory = Join-Path $projectRoot 'models' }
$SourceDirectory = (Resolve-Path -LiteralPath $SourceDirectory).Path
$toolRoot = Join-Path $PSScriptRoot 'model-tools'
$cli = Join-Path $toolRoot 'node_modules/@gltf-transform/cli/bin/cli.js'
if (-not (Test-Path -LiteralPath $cli)) { throw 'Install the pinned offline tools: npm ci --prefix scripts/model-tools' }
$runtimeDirectory = Join-Path $projectRoot 'client/public/models/enemies'
$reportDirectory = Join-Path $projectRoot 'verification/pixabay-models'
New-Item -ItemType Directory -Path $runtimeDirectory, $reportDirectory -Force | Out-Null
$profiles = @(
    @{ source = 'pixellabs-dark-fantasy-knight-3471.glb'; target = 'undead-knight'; ratio = '.24'; error = '.003' },
    @{ source = 'pixellabs-skeleton-warrior-4237.glb'; target = 'hollow-warrior'; ratio = '.24'; error = '.003' },
    @{ source = 'nickpanek-bigfoot-1716.glb'; target = 'feral-ghoul'; ratio = '.075'; error = '.006' }
)
foreach ($profile in $profiles) {
    $source = Join-Path $SourceDirectory $profile.source
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing local source: $source" }
    $hashBefore = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    $optimized = Join-Path $reportDirectory "$($profile.target)-optimized.glb"
    $runtime = Join-Path $runtimeDirectory "$($profile.target).glb"
    & node $cli optimize $source $optimized --compress false --texture-compress auto --texture-size 1024 --flatten false --join false --instance false --palette false --simplify-ratio $profile.ratio --simplify-error $profile.error *> (Join-Path $reportDirectory "$($profile.target)-optimization.log")
    if ($LASTEXITCODE -ne 0) { throw "Optimization failed: $source" }
    & node (Join-Path $toolRoot 'finalize.mjs') $optimized $runtime $source (Join-Path $reportDirectory "$($profile.target)-asset.json")
    if ($LASTEXITCODE -ne 0) { throw "Validation failed: $runtime" }
    if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $hashBefore) { throw "Source was modified: $source" }
}

& node (Join-Path $toolRoot 'rig-enemies.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Enemy rig/animation generation failed' }
