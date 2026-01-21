# KEA Research Installer for Windows
# Run: irm https://research.kea.sh | iex

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "KEA Research Installer" -ForegroundColor Cyan
Write-Host "=======================================" -ForegroundColor Cyan
Write-Host ""

# No git required - we'll use zip downloads to avoid line ending issues

# Check for docker (manual install required)
try { docker --version | Out-Null } catch {
    Write-Host "Error: docker is required but not installed." -ForegroundColor Red
    Write-Host "Install Docker Desktop: https://www.docker.com/products/docker-desktop/" -ForegroundColor Cyan
    exit 1
}

# Get latest version tag from GitHub API
function Get-LatestVersionTag {
    try {
        $response = Invoke-RestMethod -Uri "https://api.github.com/repos/KeaBase/kea-research/releases/latest" -ErrorAction Stop
        return $response.tag_name
    } catch {
        Write-Host "Error: Could not fetch latest version from GitHub API." -ForegroundColor Red
        Write-Host "Please check your internet connection and try again." -ForegroundColor Yellow
        exit 1
    }
}

# Get current installed version from VERSION file
function Get-CurrentVersion {
    if (Test-Path "VERSION") {
        return (Get-Content "VERSION" -Raw).Trim()
    }
    return $null
}

# Download and extract version
# Returns $true if download performed, $false if already on latest
function Download-Version {
    param([string]$version)

    Write-Host "Fetching latest version..." -ForegroundColor Yellow

    $latestTag = Get-LatestVersionTag
    $currentTag = Get-CurrentVersion

    if ($currentTag -eq $latestTag) {
        Write-Host "Already on latest version ($latestTag)" -ForegroundColor Green
        return $false  # Signal: no update needed
    }

    if ($currentTag) {
        Write-Host "Updating from $currentTag to $latestTag" -ForegroundColor Yellow
    } else {
        Write-Host "Installing version $latestTag" -ForegroundColor Yellow
    }

    $zipUrl = "https://github.com/KeaBase/kea-research/archive/refs/tags/$latestTag.zip"
    $zipFile = "kea-temp.zip"

    Write-Host "Downloading $zipUrl..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipFile -ErrorAction Stop

    Write-Host "Extracting..." -ForegroundColor Yellow

    # Extract to temp location
    Expand-Archive -Path $zipFile -DestinationPath "kea-temp" -Force

    # The extracted folder will be named kea-research-{version} (e.g., kea-research-0.1.1)
    $extractedFolder = "kea-temp\kea-research-$($latestTag -replace '^v','')"

    # Preserve .env if it exists
    $preserveEnv = $false
    if (Test-Path ".env") {
        Copy-Item ".env" "kea-temp\.env.backup"
        $preserveEnv = $true
    }

    # Copy all files from extracted folder to current directory
    Get-ChildItem -Path $extractedFolder -Recurse | ForEach-Object {
        $dest = $_.FullName -replace [regex]::Escape($extractedFolder), "."
        if ($_.PSIsContainer) {
            if (-not (Test-Path $dest)) {
                New-Item -ItemType Directory -Path $dest -Force | Out-Null
            }
        } else {
            Copy-Item $_.FullName -Destination $dest -Force
        }
    }

    # Fix line endings for shell scripts (convert CRLF to LF for Docker)
    Get-ChildItem -Path "." -Recurse -Include "*.sh" -File | ForEach-Object {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $content = [System.Text.Encoding]::UTF8.GetString($bytes)
        if ($content) {
            $content = $content -replace "`r`n", "`n" -replace "`r", ""
            $content = $content.TrimEnd() + "`n"
            $utf8NoBom = [System.Text.UTF8Encoding]::new($false)
            [System.IO.File]::WriteAllText($_.FullName, $content, $utf8NoBom)
        }
    }

    # Restore .env if it was preserved
    if ($preserveEnv) {
        Copy-Item "kea-temp\.env.backup" ".env" -Force
        Remove-Item "kea-temp\.env.backup"
    }

    # Save version file
    $latestTag | Set-Content "VERSION" -NoNewline

    # Cleanup
    Remove-Item $zipFile -Force
    Remove-Item "kea-temp" -Recurse -Force

    return $true  # Signal: update performed
}

# Check installation state
if (Test-Path "kea-research") {
    if (Test-Path "kea-research\.env") {
        # Folder + .env = Update mode
        Write-Host "Existing installation found. Checking for updates..." -ForegroundColor Yellow
        Set-Location kea-research
        $updatePerformed = Download-Version
        if ($updatePerformed) {
            Write-Host ""
            Write-Host "Rebuilding containers with new version..." -ForegroundColor Yellow
            try {
                docker compose version | Out-Null
                docker compose up -d --build
            } catch {
                docker-compose up -d --build
            }
            Write-Host ""
            Write-Host "============================================" -ForegroundColor Green
            Write-Host "  KEA Research updated successfully!" -ForegroundColor Green
            Write-Host "============================================" -ForegroundColor Green
            Write-Host ""
        } else {
            Write-Host ""
            Write-Host "============================================" -ForegroundColor Green
            Write-Host "  No updates available." -ForegroundColor Green
            Write-Host "============================================" -ForegroundColor Green
            Write-Host ""
        }
        Read-Host "Press Enter to exit"
        exit 0
    } else {
        # Folder but no .env = Incomplete install, continue setup
        Write-Host "Incomplete installation found. Continuing setup..." -ForegroundColor Yellow
        Set-Location kea-research
        Download-Version | Out-Null
    }
} else {
    # No folder = Fresh install
    Write-Host "Downloading KEA Research..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path "kea-research" -Force | Out-Null
    Set-Location kea-research
    Download-Version | Out-Null
}

# Copy environment file
Copy-Item .env.example .env

# Generate random 12-char admin password
$chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
$ADMIN_PASSWORD = -join ((1..12) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })

Write-Host ""
Write-Host "API Keys Configuration" -ForegroundColor Cyan
Write-Host "Press Enter to skip any key. You can add keys later in Admin Panel." -ForegroundColor Cyan
Write-Host ""
Write-Host "  Get keys: console.anthropic.com | platform.openai.com" -ForegroundColor Gray
Write-Host "            aistudio.google.com | console.mistral.ai | console.x.ai" -ForegroundColor Gray
Write-Host "            openrouter.ai" -ForegroundColor Gray
Write-Host ""

# Prompt for API keys (default to "x" if empty to ensure providers are created)
$ANTHROPIC_KEY = Read-Host "ANTHROPIC_API_KEY"
$OPENAI_KEY = Read-Host "OPENAI_API_KEY"
$GOOGLE_KEY = Read-Host "GOOGLE_API_KEY"
$MISTRAL_KEY = Read-Host "MISTRAL_API_KEY"
$XAI_KEY = Read-Host "XAI_API_KEY"
$OPENROUTER_KEY = Read-Host "OPENROUTER_API_KEY"

if (-not $ANTHROPIC_KEY) { $ANTHROPIC_KEY = "x" }
if (-not $OPENAI_KEY) { $OPENAI_KEY = "x" }
if (-not $GOOGLE_KEY) { $GOOGLE_KEY = "x" }
if (-not $MISTRAL_KEY) { $MISTRAL_KEY = "x" }
if (-not $XAI_KEY) { $XAI_KEY = "x" }
if (-not $OPENROUTER_KEY) { $OPENROUTER_KEY = "x" }

Write-Host ""
Write-Host "Domain Configuration" -ForegroundColor Cyan
Write-Host "  localhost = local access only (this computer)" -ForegroundColor Gray
Write-Host "  domain    = public access via your domain (e.g. research.keabase.dev)" -ForegroundColor Gray
Write-Host ""
$DOMAIN = Read-Host "Enter domain (or press Enter for localhost)"

$USE_OWN_CERT = "false"

if ($DOMAIN -and $DOMAIN -ne "localhost") {
    # SSL Certificate options
    Write-Host ""
    Write-Host "SSL Certificate" -ForegroundColor Cyan
    Write-Host "  1) Let's Encrypt (automatic, recommended)"
    Write-Host "  2) Own certificate"
    Write-Host ""
    $SSL_OPTION = Read-Host "Choose option (1/2) [1]"

    if ($SSL_OPTION -eq "2") {
        $USE_OWN_CERT = "true"
        Write-Host ""
        Write-Host "Please place your certificate files:" -ForegroundColor Yellow
        Write-Host "  nginx\ssl\fullchain.crt - Your certificate chain"
        Write-Host "  nginx\ssl\private.key  - Your private key"
        Write-Host ""
        New-Item -ItemType Directory -Force -Path "nginx\ssl" | Out-Null
        Read-Host "Press Enter when files are in place"

        if (-not (Test-Path "nginx\ssl\fullchain.crt") -or -not (Test-Path "nginx\ssl\private.key")) {
            Write-Host "Warning: Certificate files not found. Continuing anyway..." -ForegroundColor Yellow
        }
    }
} else {
    $DOMAIN = "localhost"
}

# Update .env file
Write-Host ""
Write-Host "Configuring environment..." -ForegroundColor Yellow

$envContent = Get-Content .env -Raw

$envContent = $envContent -replace "(?m)^ADMIN_PASSWORD=.*", "ADMIN_PASSWORD=$ADMIN_PASSWORD"
$envContent = $envContent -replace "(?m)^DOMAIN=.*", "DOMAIN=$DOMAIN"

if ($ANTHROPIC_KEY) { $envContent = $envContent -replace "(?m)^ANTHROPIC_API_KEY=.*", "ANTHROPIC_API_KEY=$ANTHROPIC_KEY" }
if ($OPENAI_KEY) { $envContent = $envContent -replace "(?m)^OPENAI_API_KEY=.*", "OPENAI_API_KEY=$OPENAI_KEY" }
if ($GOOGLE_KEY) { $envContent = $envContent -replace "(?m)^GOOGLE_API_KEY=.*", "GOOGLE_API_KEY=$GOOGLE_KEY" }
if ($MISTRAL_KEY) { $envContent = $envContent -replace "(?m)^MISTRAL_API_KEY=.*", "MISTRAL_API_KEY=$MISTRAL_KEY" }
if ($XAI_KEY) { $envContent = $envContent -replace "(?m)^XAI_API_KEY=.*", "XAI_API_KEY=$XAI_KEY" }
if ($OPENROUTER_KEY) { $envContent = $envContent -replace "(?m)^OPENROUTER_API_KEY=.*", "OPENROUTER_API_KEY=$OPENROUTER_KEY" }

if ($USE_OWN_CERT -eq "true") {
    if ($envContent -match "(?m)^USE_OWN_CERT=") {
        $envContent = $envContent -replace "(?m)^USE_OWN_CERT=.*", "USE_OWN_CERT=true"
    } else {
        $envContent += "`nUSE_OWN_CERT=true"
    }
}

$envContent | Set-Content .env -NoNewline

# Start the application
Write-Host ""
Write-Host "Starting KEA Research..." -ForegroundColor Yellow
try {
    docker compose version | Out-Null
    docker compose up -d
} catch {
    docker-compose up -d
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "  KEA Research installed successfully!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Admin Password: " -NoNewline
Write-Host $ADMIN_PASSWORD -ForegroundColor Yellow
Write-Host "  (saved in .env file)" -ForegroundColor Cyan
Write-Host ""
if ($DOMAIN -eq "localhost") {
    Write-Host "  Access: http://localhost:8080"
} else {
    Write-Host "  Access: https://$DOMAIN:8443"
}
Write-Host ""

# Return to parent directory
Set-Location ..

Read-Host "Press Enter to exit"
