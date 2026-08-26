[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$buildRoot = Join-Path $sourceRoot 'build'
$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$packageName = "zcom-production-$timestamp"
$packageRoot = Join-Path $buildRoot $packageName
$publicRoot = Join-Path $packageRoot 'public_html'
$zipPath = Join-Path $buildRoot "$packageName.zip"

New-Item -ItemType Directory -Path $publicRoot -Force | Out-Null

function Copy-FilteredRuntimeTree {
    param(
        [Parameter(Mandatory = $true)][string]$Source,
        [Parameter(Mandatory = $true)][string]$Destination
    )

    $resolvedSource = (Resolve-Path $Source).Path
    Get-ChildItem -LiteralPath $resolvedSource -Recurse -Force -File | ForEach-Object {
        $relative = $_.FullName.Substring($resolvedSource.Length).TrimStart('\', '/')
        $segments = $relative -split '[\\/]'
        if ($segments | Where-Object { $_ -in @('.git', '.github', '.vscode', 'tests', 'docs', 'TEMP', '__pycache__') }) {
            return
        }
        if ($_.Name -match '^(?:\.env(?:\..*)?|sess_[A-Za-z0-9_-]+|__[^.]+\.tmp)$') {
            return
        }

        $target = Join-Path $Destination $relative
        $targetDirectory = Split-Path -Parent $target
        New-Item -ItemType Directory -Path $targetDirectory -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $target -Force
    }
}

$runtimeDirectories = @('api', 'assets', 'config', 'includes', 'pages', 'systems')
foreach ($directory in $runtimeDirectories) {
    Copy-FilteredRuntimeTree -Source (Join-Path $sourceRoot $directory) -Destination (Join-Path $publicRoot $directory)
}

# Composer and PHPMailer are installed locally, so the host does not need
# Composer or shell access. Copy only the files required at runtime.
$vendorRoot = Join-Path $sourceRoot 'vendor'
$vendorTarget = Join-Path $publicRoot 'vendor'
New-Item -ItemType Directory -Path $vendorTarget -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $vendorRoot 'autoload.php') -Destination (Join-Path $vendorTarget 'autoload.php') -Force
Copy-FilteredRuntimeTree -Source (Join-Path $vendorRoot 'composer') -Destination (Join-Path $vendorTarget 'composer')
Copy-FilteredRuntimeTree -Source (Join-Path $vendorRoot 'phpmailer\phpmailer\src') -Destination (Join-Path $vendorTarget 'phpmailer\phpmailer\src')
Copy-FilteredRuntimeTree -Source (Join-Path $vendorRoot 'phpmailer\phpmailer\language') -Destination (Join-Path $vendorTarget 'phpmailer\phpmailer\language')

New-Item -ItemType Directory -Path (Join-Path $publicRoot 'data') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot 'data\orgData.js') -Destination (Join-Path $publicRoot 'data\orgData.js') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot 'index.html') -Destination (Join-Path $publicRoot 'index.html') -Force
Copy-Item -LiteralPath (Join-Path $sourceRoot '.htaccess') -Destination (Join-Path $publicRoot '.htaccess') -Force

# Include only the production notification dispatcher from the CLI utilities.
New-Item -ItemType Directory -Path (Join-Path $publicRoot 'cli') -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $sourceRoot 'cli\dispatch-notification-emails.php') -Destination (Join-Path $publicRoot 'cli\dispatch-notification-emails.php') -Force

# Build empty, protected runtime directories without copying local user data.
$uploadSource = Join-Path $sourceRoot 'uploads'
$uploadTarget = Join-Path $publicRoot 'uploads'
Get-ChildItem -LiteralPath $uploadSource -Recurse -Force -Directory | ForEach-Object {
    $relative = $_.FullName.Substring($uploadSource.Length).TrimStart('\', '/')
    New-Item -ItemType Directory -Path (Join-Path $uploadTarget $relative) -Force | Out-Null
}
New-Item -ItemType Directory -Path $uploadTarget -Force | Out-Null
Get-ChildItem -LiteralPath $uploadSource -Recurse -Force -File | Where-Object {
    $_.Name -in @('.htaccess', 'web.config', '.gitkeep')
} | ForEach-Object {
    $relative = $_.FullName.Substring($uploadSource.Length).TrimStart('\', '/')
    $target = Join-Path $uploadTarget $relative
    New-Item -ItemType Directory -Path (Split-Path -Parent $target) -Force | Out-Null
    Copy-Item -LiteralPath $_.FullName -Destination $target -Force
}

$storageTarget = Join-Path $publicRoot 'storage'
New-Item -ItemType Directory -Path (Join-Path $storageTarget 'cache\analytics_ai') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $storageTarget 'private') -Force | Out-Null
foreach ($protectionFile in @('.htaccess', 'web.config')) {
    $source = Join-Path (Join-Path $sourceRoot 'storage') $protectionFile
    if (Test-Path -LiteralPath $source) {
        Copy-Item -LiteralPath $source -Destination (Join-Path $storageTarget $protectionFile) -Force
    }
}

Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'capstone-runtime.php.example') -Destination (Join-Path $packageRoot 'capstone-runtime.php.example') -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'ZCOM-DEPLOYMENT-CHECKLIST.txt') -Destination (Join-Path $packageRoot 'ZCOM-DEPLOYMENT-CHECKLIST.txt') -Force
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'capstone-private\documents') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'capstone-private\print-jobs') -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $packageRoot 'capstone-cache\analytics-ai') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $packageRoot 'capstone-private\documents\.keep') -Value '' -Encoding ascii
Set-Content -LiteralPath (Join-Path $packageRoot 'capstone-private\print-jobs\.keep') -Value '' -Encoding ascii
Set-Content -LiteralPath (Join-Path $packageRoot 'capstone-cache\analytics-ai\.keep') -Value '' -Encoding ascii

# Fail closed if anything unsafe entered the publicly served package.
$forbidden = Get-ChildItem -LiteralPath $publicRoot -Recurse -Force | Where-Object {
    $_.Name -in @('.git', '.github', '.vscode', '.env', '.env.example', 'tests', 'docs', 'TEMP') -or
    (!$_.PSIsContainer -and ($_.Extension -in @('.sql', '.md', '.mmd', '.log', '.bak', '.backup'))) -or
    (!$_.PSIsContainer -and $_.Name -match '^(?:sess_[A-Za-z0-9_-]+|composer\.phar)$')
}
if ($forbidden) {
    $names = ($forbidden.FullName -join [Environment]::NewLine)
    throw "Unsafe files were found in public_html:`n$names"
}

$secretScanFiles = Get-ChildItem -LiteralPath $publicRoot -Recurse -Force -File | Where-Object {
    $_.Extension -in @('.php', '.js', '.html', '.css', '.json', '.txt', '.xml') -or
    $_.Name -in @('.htaccess', 'web.config')
}
$secretMatches = $secretScanFiles | Select-String -Pattern @(
    'AIza[0-9A-Za-z_-]{30,}',
    'AQ\.[0-9A-Za-z_-]{20,}'
) -ErrorAction SilentlyContinue
if ($secretMatches) {
    throw 'A value resembling an API key was found in the public package. Packaging stopped.'
}

$manifest = Get-ChildItem -LiteralPath $packageRoot -Recurse -Force -File |
    ForEach-Object { $_.FullName.Substring($packageRoot.Length).TrimStart('\', '/') } |
    Sort-Object
Set-Content -LiteralPath (Join-Path $packageRoot 'PACKAGE-MANIFEST.txt') -Value $manifest -Encoding utf8

Compress-Archive -Path (Join-Path $packageRoot '*') -DestinationPath $zipPath -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $zipPath -Algorithm SHA256).Hash
Set-Content -LiteralPath "$zipPath.sha256.txt" -Value "$hash  $([IO.Path]::GetFileName($zipPath))" -Encoding ascii

Write-Output "Package directory: $packageRoot"
Write-Output "Upload ZIP: $zipPath"
Write-Output "SHA-256: $hash"
