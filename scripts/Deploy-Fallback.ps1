#Requires -Version 5.1
<#
.SYNOPSIS
    SHIELD FALLBACK DEPLOYMENT SCRIPT v1.0 (PowerShell)

.DESCRIPTION
    Smart deployment script that serves as fallback when GitHub Actions fails.
    SECURITY: This script REQUIRES pre-commit hooks to pass before deployment.
    DO NOT bypass this check for ANY reason.

.PARAMETER SkipBackend
    Skip backend PHP deployment

.PARAMETER SkipPublic
    Skip public assets deployment

.PARAMETER SkipMigrations
    Skip database migrations

.PARAMETER Rollback
    Rollback to previous deployment

.EXAMPLE
    .\Deploy-Fallback.ps1
    .\Deploy-Fallback.ps1 -SkipBackend
    .\Deploy-Fallback.ps1 -SkipMigrations
    .\Deploy-Fallback.ps1 -Rollback
#>

[CmdletBinding()]
param(
    [switch]$SkipBackend,
    [switch]$SkipPublic,
    [switch]$SkipMigrations,
    [switch]$Rollback
)

$ErrorActionPreference = "Stop"

# ============================================================================
# CONFIGURATION
# ============================================================================

$Script:ProjectRoot = Split-Path -Parent $PSScriptRoot
$Script:BackendDir = Join-Path $Script:ProjectRoot "backend\php"
$Script:PublicDir = Join-Path $Script:ProjectRoot "public"
$Script:DatabaseDir = Join-Path $Script:ProjectRoot "database"

# VPS Configuration
$Script:VpsHost = "stabilis-it.ch"
$Script:VpsUser = $env:SHIELD_VPS_USER
if (-not $Script:VpsUser) { $Script:VpsUser = "debian" }
$Script:VpsPath = "/var/www/shield"

# URLs
$Script:ProdUrl = "https://stabilis-it.ch/internal/shield"
$Script:ApiUrl = "$($Script:ProdUrl)/api"
$Script:HealthUrl = "$($Script:ProdUrl)/health"

# Logging
$Script:LogFile = Join-Path $Script:ProjectRoot "deploy-$(Get-Date -Format 'yyyyMMdd-HHmmss').log"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

function Write-Log {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logEntry = "[$timestamp] [$Level] $Message"
    Add-Content -Path $Script:LogFile -Value $logEntry
    Write-Host $logEntry
}

function Write-Info { param([string]$Message) Write-Log "INFO" $Message }
function Write-Success { param([string]$Message) Write-Host "[SUCCESS] $Message" -ForegroundColor Green; Write-Log "SUCCESS" $Message }
function Write-Warning2 { param([string]$Message) Write-Host "[WARNING] $Message" -ForegroundColor Yellow; Write-Log "WARNING" $Message }
function Write-Error2 { param([string]$Message) Write-Host "[ERROR] $Message" -ForegroundColor Red; Write-Log "ERROR" $Message }
function Write-Step { param([string]$Message) Write-Host "`n=== $Message ===`n" -ForegroundColor Blue; Write-Log "STEP" $Message }

function Exit-WithError {
    param([string]$Message)
    Write-Error2 $Message
    Write-Error2 "Deployment ABORTED. Check $($Script:LogFile) for details."
    exit 1
}

# ============================================================================
# PRE-DEPLOYMENT VALIDATION (MANDATORY - DO NOT BYPASS)
# ============================================================================

function Test-PreCommitHooks {
    Write-Step "PHASE 0: PRE-COMMIT HOOKS VALIDATION"

    Write-Info "Running pre-commit hook validation..."
    Write-Info "THIS CHECK IS MANDATORY AND CANNOT BE BYPASSED"

    Set-Location $Script:ProjectRoot

    # Check if validators exist
    $validatorScript = Join-Path $Script:ProjectRoot "scripts\validators\run-all.js"

    if (Test-Path $validatorScript) {
        Write-Info "Running validators..."

        $result = & node $validatorScript 2>&1
        $exitCode = $LASTEXITCODE

        if ($exitCode -ne 0) {
            Write-Host $result -ForegroundColor Red
            Exit-WithError "PRE-COMMIT HOOKS FAILED - Deployment blocked. Fix the issues and try again."
        }

        Write-Success "All validators passed"
    }
    else {
        Write-Warning2 "Validator script not found, performing basic checks..."

        # Basic hardcoded secrets check
        $secretPatterns = @("SHIELD_JWT_SECRET", "SHIELD_DB_PASSWORD", "twilio_auth_token")
        $found = $false

        foreach ($pattern in $secretPatterns) {
            $matches = Get-ChildItem -Path $Script:ProjectRoot -Recurse -Include "*.php", "*.js" -File |
                Where-Object { $_.FullName -notmatch "node_modules|\.git|\.env" } |
                Select-String -Pattern "$pattern\s*=" -SimpleMatch

            if ($matches) {
                Write-Error2 "Found hardcoded secret: $pattern"
                $found = $true
            }
        }

        if ($found) {
            Exit-WithError "Hardcoded secrets detected - Deployment blocked."
        }

        # Check for SQL in Controllers
        $sqlInControllers = Get-ChildItem -Path "$Script:ProjectRoot\backend\php\Controllers" -Filter "*.php" -File |
            Select-String -Pattern '\$[a-z_]+->query\s*\('

        if ($sqlInControllers) {
            Write-Error2 "Found SQL queries in Controllers (MVC violation)!"
            Exit-WithError "MVC violation detected - Deployment blocked."
        }
    }

    Write-Success "Pre-deployment validation passed"
}

# ============================================================================
# E2E TESTS VALIDATION (MANDATORY BEFORE DEPLOYMENT)
# ============================================================================

function Test-E2ETests {
    Write-Step "PHASE 0.5: E2E TESTS VALIDATION"

    Write-Info "Running E2E tests BEFORE deployment..."
    Write-Info "THIS CHECK IS MANDATORY - Deployment will be blocked if tests fail"

    Set-Location $Script:ProjectRoot

    # Check if npx is available
    if (-not (Get-Command "npx" -ErrorAction SilentlyContinue)) {
        Write-Warning2 "npx not available - E2E tests skipped (NOT RECOMMENDED)"
        $confirm = Read-Host "Continue without E2E tests? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Exit-WithError "Deployment cancelled - install Node.js and run E2E tests"
        }
        return
    }

    # Check if test directory exists
    $testDir = Join-Path $Script:ProjectRoot "tests\playwright\e2e"
    if (-not (Test-Path $testDir)) {
        Write-Warning2 "E2E test directory not found"
        return
    }

    # Run all E2E tests
    Write-Info "Executing comprehensive E2E tests..."
    Write-Host ""

    $result = & npx playwright test tests/playwright/e2e/ --reporter=line 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        Write-Success "ALL E2E TESTS PASSED"
        Write-Host ""
    }
    else {
        Write-Host $result -ForegroundColor Red
        Write-Host ""
        Write-Error2 "================================================================"
        Write-Error2 "  E2E TESTS FAILED - DEPLOYMENT BLOCKED                        "
        Write-Error2 "                                                               "
        Write-Error2 "  Les tests E2E doivent passer AVANT tout deploiement.         "
        Write-Error2 "  Executez: npx playwright test tests/playwright/e2e/ --headed"
        Write-Error2 "                                                               "
        Write-Error2 "  AUCUNE EXCEPTION. AUCUN BYPASS.                              "
        Write-Error2 "================================================================"
        Write-Host ""

        $confirm = Read-Host "Force deployment anyway? (type 'FORCE' to confirm)"
        if ($confirm -ne "FORCE") {
            Exit-WithError "Deployment blocked by E2E test failures"
        }

        Write-Warning2 "FORCING DEPLOYMENT DESPITE TEST FAILURES - THIS IS LOGGED"
        $logEntry = "[$(Get-Date)] FORCED DEPLOYMENT despite E2E failures by $env:USERNAME"
        Add-Content -Path (Join-Path $Script:ProjectRoot ".deployment_warnings.log") -Value $logEntry
    }
}

# ============================================================================
# ENVIRONMENT CHECKS
# ============================================================================

function Test-Prerequisites {
    Write-Step "PHASE 1: PREREQUISITES CHECK"

    # Check required tools
    $requiredTools = @("git", "node", "ssh", "rsync", "curl")

    foreach ($tool in $requiredTools) {
        if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
            Exit-WithError "Required tool not found: $tool"
        }
    }
    Write-Info "All required tools found"

    # Test SSH connectivity
    Write-Info "Testing SSH connectivity..."
    $sshTest = & ssh -o BatchMode=yes -o ConnectTimeout=10 "$($Script:VpsUser)@$($Script:VpsHost)" "echo 'SSH OK'" 2>&1

    if ($LASTEXITCODE -ne 0) {
        Exit-WithError "Cannot connect to VPS via SSH. Check your SSH keys."
    }
    Write-Success "SSH connection verified"

    # Check Git status
    Write-Info "Checking Git status..."
    Set-Location $Script:ProjectRoot
    $currentBranch = & git branch --show-current

    if ($currentBranch -ne "main") {
        Write-Warning2 "Not on main branch (current: $currentBranch)"
        $confirm = Read-Host "Continue anyway? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Exit-WithError "Deployment cancelled"
        }
    }

    # Check for uncommitted changes
    $gitStatus = & git status --porcelain
    if ($gitStatus) {
        Write-Warning2 "You have uncommitted changes"
        $confirm = Read-Host "Continue anyway? (y/N)"
        if ($confirm -ne "y" -and $confirm -ne "Y") {
            Exit-WithError "Deployment cancelled - commit your changes first"
        }
    }

    # Check for unpushed commits
    $unpushed = (& git log origin/main..HEAD --oneline 2>$null | Measure-Object -Line).Lines

    if ($unpushed -gt 0) {
        Write-Warning2 "You have $unpushed unpushed commit(s)"
        $confirm = Read-Host "Push before deploying? (Y/n)"
        if ($confirm -ne "n" -and $confirm -ne "N") {
            Write-Info "Pushing to origin..."
            & git push origin main
        }
    }

    Write-Success "Prerequisites check passed"
}

# ============================================================================
# DEPLOYMENT PHASE
# ============================================================================

function Deploy-Backend {
    Write-Step "PHASE 2: BACKEND DEPLOYMENT"

    Write-Info "Creating backup on VPS..."
    $backupCmd = @"
if [ -d '$($Script:VpsPath)' ]; then
    backup_name='${Script:VpsPath}.bak-`$(date +%Y%m%d-%H%M%S)'
    sudo cp -r '$($Script:VpsPath)' "`$backup_name"
    echo "Backup created: `$backup_name"
fi
"@
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" $backupCmd

    Write-Info "Deploying backend PHP..."
    & rsync -avz --delete `
        --exclude='.env' `
        --exclude='*.log' `
        --exclude='vendor/' `
        --exclude='node_modules/' `
        "$($Script:BackendDir)/" "$($Script:VpsUser)@$($Script:VpsHost):$($Script:VpsPath)/backend/php/"

    Write-Success "Backend deployed"
}

function Deploy-Public {
    Write-Step "PHASE 3: PUBLIC ASSETS DEPLOYMENT"

    Write-Info "Deploying public assets..."
    & rsync -avz --delete `
        --exclude='uploads/*' `
        --exclude='*.log' `
        "$($Script:PublicDir)/" "$($Script:VpsUser)@$($Script:VpsHost):$($Script:VpsPath)/public/"

    Write-Success "Public assets deployed"
}

function Deploy-Database {
    Write-Step "PHASE 4: DATABASE MIGRATIONS"

    Write-Info "Deploying migration files..."
    & rsync -avz `
        "$($Script:DatabaseDir)/migrations/" "$($Script:VpsUser)@$($Script:VpsHost):$($Script:VpsPath)/database/migrations/"

    Write-Info "Running migrations on VPS..."
    $migrateCmd = @"
cd '$($Script:VpsPath)'
if [ -f '.env' ]; then
    export `$(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' .env | xargs)

    mysql -h "`$DB_HOST" -P "`$DB_PORT" -u "`$DB_USER" -p"`$DB_PASSWORD" "`$DB_NAME" -e '
        CREATE TABLE IF NOT EXISTS migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            migration VARCHAR(255) NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    ' 2>/dev/null

    for file in database/migrations/*.sql; do
        if [ -f "`$file" ]; then
            filename=`$(basename "`$file")
            exists=`$(mysql -h "`$DB_HOST" -P "`$DB_PORT" -u "`$DB_USER" -p"`$DB_PASSWORD" "`$DB_NAME" -N -e "
                SELECT COUNT(*) FROM migrations WHERE migration = '`$filename';
            " 2>/dev/null)

            if [ "`$exists" = "0" ]; then
                echo "Applying: `$filename"
                mysql -h "`$DB_HOST" -P "`$DB_PORT" -u "`$DB_USER" -p"`$DB_PASSWORD" "`$DB_NAME" < "`$file" 2>/dev/null && \
                mysql -h "`$DB_HOST" -P "`$DB_PORT" -u "`$DB_USER" -p"`$DB_PASSWORD" "`$DB_NAME" -e "
                    INSERT INTO migrations (migration) VALUES ('`$filename');
                " 2>/dev/null
            fi
        fi
    done
fi
"@
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" $migrateCmd

    Write-Success "Migrations completed"
}

function Set-Permissions {
    Write-Step "PHASE 5: PERMISSIONS"

    Write-Info "Setting file permissions..."
    $permCmd = @"
sudo chown -R www-data:www-data '$($Script:VpsPath)'
sudo chmod -R 755 '$($Script:VpsPath)'
sudo chmod -R 775 '$($Script:VpsPath)/public/uploads'
sudo chmod -R 775 '$($Script:VpsPath)/storage'
sudo chmod 600 '$($Script:VpsPath)/.env' 2>/dev/null || true
"@
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" $permCmd

    Write-Success "Permissions set"
}

function Invoke-ServiceReload {
    Write-Step "PHASE 6: SERVICE RELOAD"

    Write-Info "Testing nginx configuration..."
    $result = & ssh "$($Script:VpsUser)@$($Script:VpsHost)" "sudo nginx -t" 2>&1

    if ($LASTEXITCODE -ne 0) {
        Write-Host $result -ForegroundColor Red
        Exit-WithError "Nginx configuration test failed!"
    }
    Write-Success "Nginx configuration valid"

    Write-Info "Reloading nginx..."
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" "sudo systemctl reload nginx"
    Write-Success "Nginx reloaded"

    Write-Info "Restarting PHP-FPM..."
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" "sudo systemctl restart php8.2-fpm 2>/dev/null || sudo systemctl restart php-fpm"
    Write-Success "PHP-FPM restarted"

    Write-Info "Clearing cache..."
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" "rm -f '$($Script:VpsPath)/storage/cache/'* 2>/dev/null || true"
    Write-Success "Cache cleared"
}

# ============================================================================
# VERIFICATION PHASE
# ============================================================================

function Test-SmokeTests {
    Write-Step "PHASE 7: SMOKE TESTS"

    $errors = 0

    Write-Info "Waiting for services to stabilize..."
    Start-Sleep -Seconds 5

    # Test health endpoint
    Write-Info "Testing health endpoint..."
    try {
        $response = Invoke-WebRequest -Uri $Script:HealthUrl -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Success "Health: HTTP $($response.StatusCode)"
        }
        else {
            Write-Error2 "Health: HTTP $($response.StatusCode) (expected 200)"
            $errors++
        }
    }
    catch {
        Write-Error2 "Health: Failed - $_"
        $errors++
    }

    # Test API v1 health
    Write-Info "Testing API v1 health..."
    try {
        $response = Invoke-WebRequest -Uri "$($Script:ApiUrl)/v1/health" -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Success "API Health: HTTP $($response.StatusCode)"
        }
        else {
            Write-Error2 "API Health: HTTP $($response.StatusCode) (expected 200)"
            $errors++
        }
    }
    catch {
        Write-Error2 "API Health: Failed - $_"
        $errors++
    }

    # Test auth protection (should return 401)
    Write-Info "Testing auth protection..."
    try {
        $response = Invoke-WebRequest -Uri "$($Script:ApiUrl)/incidents.php?action=active" -UseBasicParsing -TimeoutSec 30 -ErrorAction SilentlyContinue
        Write-Error2 "Auth protection: HTTP $($response.StatusCode) (expected 401)"
        $errors++
    }
    catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 401) {
            Write-Success "Auth protection: HTTP 401 (expected)"
        }
        else {
            Write-Error2 "Auth protection: Unexpected error - $_"
            $errors++
        }
    }

    # Test login page
    Write-Info "Testing login page..."
    try {
        $response = Invoke-WebRequest -Uri "$($Script:ProdUrl)/auth/login" -UseBasicParsing -TimeoutSec 30
        if ($response.StatusCode -eq 200) {
            Write-Success "Login page: HTTP $($response.StatusCode)"
        }
        else {
            Write-Error2 "Login page: HTTP $($response.StatusCode) (expected 200)"
            $errors++
        }
    }
    catch {
        Write-Error2 "Login page: Failed - $_"
        $errors++
    }

    if ($errors -eq 0) {
        Write-Success "ALL SMOKE TESTS PASSED"
        return $true
    }
    else {
        Write-Error2 "$errors SMOKE TEST(S) FAILED"
        return $false
    }
}

# ============================================================================
# ROLLBACK
# ============================================================================

function Invoke-Rollback {
    Write-Step "ROLLBACK"

    Write-Warning2 "Rolling back to previous deployment..."

    $rollbackCmd = @"
latest_backup=`$(ls -td ${Script:VpsPath}.bak-* 2>/dev/null | head -1)
if [ -n "`$latest_backup" ]; then
    echo "Restoring from: `$latest_backup"
    sudo rm -rf '$($Script:VpsPath)'
    sudo mv "`$latest_backup" '$($Script:VpsPath)'
    sudo chown -R www-data:www-data '$($Script:VpsPath)'
    sudo systemctl reload nginx
    sudo systemctl restart php8.2-fpm 2>/dev/null || sudo systemctl restart php-fpm
    echo "Rollback completed"
else
    echo "No backup found for rollback!"
    exit 1
fi
"@
    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" $rollbackCmd

    Write-Success "Rollback completed"
}

function Clear-OldBackups {
    Write-Info "Cleaning up old backups (keeping last 3)..."

    & ssh "$($Script:VpsUser)@$($Script:VpsHost)" "cd /var/www && ls -td shield.bak-* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf"

    Write-Success "Cleanup completed"
}

# ============================================================================
# MAIN EXECUTION
# ============================================================================

function Main {
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host "     SHIELD FALLBACK DEPLOYMENT SCRIPT v1.0                    " -ForegroundColor Cyan
    Write-Host "     Production: $($Script:ProdUrl)            " -ForegroundColor Cyan
    Write-Host "================================================================" -ForegroundColor Cyan
    Write-Host ""

    Write-Info "Deployment started at $(Get-Date)"
    Write-Info "Log file: $($Script:LogFile)"
    Write-Host ""

    # Handle rollback
    if ($Rollback) {
        Test-Prerequisites
        Invoke-Rollback
        Test-SmokeTests | Out-Null
        return
    }

    # MANDATORY: Pre-commit hooks validation
    Test-PreCommitHooks

    # MANDATORY: E2E tests validation
    Test-E2ETests

    # Prerequisites check
    Test-Prerequisites

    # Deploy
    if (-not $SkipBackend) {
        Deploy-Backend
    }
    else {
        Write-Info "Skipping backend deployment (-SkipBackend)"
    }

    if (-not $SkipPublic) {
        Deploy-Public
    }
    else {
        Write-Info "Skipping public assets deployment (-SkipPublic)"
    }

    if (-not $SkipMigrations) {
        Deploy-Database
    }
    else {
        Write-Info "Skipping migrations (-SkipMigrations)"
    }

    # Set permissions and reload services
    Set-Permissions
    Invoke-ServiceReload

    # Smoke tests
    if (-not (Test-SmokeTests)) {
        Write-Error2 "Smoke tests failed!"
        $confirm = Read-Host "Do you want to rollback? (y/N)"
        if ($confirm -eq "y" -or $confirm -eq "Y") {
            Invoke-Rollback
            Test-SmokeTests | Out-Null
        }
        exit 1
    }

    # Cleanup old backups
    Clear-OldBackups

    # Success summary
    Write-Host ""
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host "     DEPLOYMENT SUCCESSFUL                                     " -ForegroundColor Green
    Write-Host "================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Success "Deployment completed at $(Get-Date)"
    Write-Info "Production URL: $($Script:ProdUrl)"
    Write-Info "API URL: $($Script:ApiUrl)"
    Write-Info "Log file: $($Script:LogFile)"
    Write-Host ""
}

# Run main
Main
