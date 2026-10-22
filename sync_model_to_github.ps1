param(
    [Parameter(Mandatory = $true)]
    [string]$RepoPath,

    [Parameter(Mandatory = $true)]
    [ValidateSet('Static', 'Continuous')]
    [string]$ModelType
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path $RepoPath).Path
$backendRoot = Join-Path $repoRoot 'SAHAYAK-Vercel-Deployment\backend'
$modelRoot = Join-Path $projectRoot 'model'
$deployModelRoot = Join-Path $backendRoot 'model'

if (-not (Test-Path (Join-Path $repoRoot '.git'))) {
    throw "RepoPath must point to a cloned Git repository that contains a .git folder: $repoRoot"
}
if (-not (Test-Path $backendRoot)) {
    throw "Could not find SAHAYAK-Vercel-Deployment\backend under: $repoRoot"
}
if (-not (Test-Path $deployModelRoot)) {
    New-Item -ItemType Directory -Path $deployModelRoot -Force | Out-Null
}

switch ($ModelType) {
    'Static' {
        $sourceModel = Join-Path $modelRoot 'sahayak_twohand.joblib'
        $destModel = Join-Path $deployModelRoot 'sahayak_twohand.joblib'
        $sourceLabels = Join-Path $modelRoot 'labels_twohand.json'
        $destLabels = Join-Path $backendRoot 'labels_twohand.json'
        if (-not (Test-Path $sourceModel)) { throw "Missing active static model: $sourceModel" }
        if (-not (Test-Path $sourceLabels)) { throw "Missing static label metadata: $sourceLabels" }
        Copy-Item $sourceModel $destModel -Force
        Copy-Item $sourceLabels $destLabels -Force
        Write-Host 'Staged static model and static label metadata. Existing sequence model was not changed.' -ForegroundColor Green
    }
    'Continuous' {
        $sourceModel = Join-Path $modelRoot 'sahayak_sequence.joblib'
        $destModel = Join-Path $deployModelRoot 'sahayak_sequence.joblib'
        if (-not (Test-Path $sourceModel)) { throw "Missing active sequence model: $sourceModel" }
        Copy-Item $sourceModel $destModel -Force
        Write-Host 'Staged continuous model only. Existing static model and label metadata were not changed.' -ForegroundColor Green
    }
}

Write-Host "Repository: $repoRoot"
Write-Host 'Next: open a terminal in the cloned repo, run git status --short, then stage only the relevant model path(s) as described in DEPLOY_NEW_MODELS_TO_GITHUB.md.' -ForegroundColor Yellow
