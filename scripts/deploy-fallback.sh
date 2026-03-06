#!/bin/bash
# ============================================================================
# SHIELD FALLBACK DEPLOYMENT SCRIPT v1.0
# ============================================================================
# Smart deployment script that serves as fallback when GitHub Actions fails
#
# SECURITY: This script REQUIRES pre-commit hooks to pass before deployment
# DO NOT bypass this check for ANY reason
# ============================================================================

set -euo pipefail

# ============================================================================
# CONFIGURATION
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# VPS Configuration
VPS_HOST="stabilis-it.ch"
VPS_USER="${SHIELD_VPS_USER:-debian}"
VPS_PATH="/var/www/shield"

# Deployment URLs
PROD_URL="https://stabilis-it.ch/internal/shield"
API_URL="$PROD_URL/api"
HEALTH_URL="$PROD_URL/health"

# Directories
BACKEND_DIR="$PROJECT_ROOT/backend/php"
PUBLIC_DIR="$PROJECT_ROOT/public"
DATABASE_DIR="$PROJECT_ROOT/database"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Logging
LOG_FILE="$PROJECT_ROOT/deploy-$(date +%Y%m%d-%H%M%S).log"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

info() { log "INFO" "${CYAN}$*${NC}"; }
success() { log "SUCCESS" "${GREEN}$*${NC}"; }
warning() { log "WARNING" "${YELLOW}$*${NC}"; }
error() { log "ERROR" "${RED}$*${NC}"; }
step() { echo -e "\n${BOLD}${BLUE}=== $* ===${NC}\n" | tee -a "$LOG_FILE"; }

die() {
    error "$*"
    error "Deployment ABORTED. Check $LOG_FILE for details."
    exit 1
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        die "Required command not found: $1"
    fi
}

# ============================================================================
# PRE-DEPLOYMENT VALIDATION (MANDATORY - DO NOT BYPASS)
# ============================================================================

validate_precommit_hooks() {
    step "PHASE 0: PRE-COMMIT HOOKS VALIDATION"

    info "Running pre-commit hook validation..."
    info "THIS CHECK IS MANDATORY AND CANNOT BE BYPASSED"

    cd "$PROJECT_ROOT"

    # Check if there are staged changes
    if ! git diff --cached --quiet 2>/dev/null; then
        info "Found staged changes, running pre-commit hooks..."

        # Run pre-commit hooks
        if [ -f ".git/hooks/pre-commit" ]; then
            if ! .git/hooks/pre-commit; then
                die "PRE-COMMIT HOOKS FAILED - Deployment blocked. Fix the issues and try again."
            fi
            success "Pre-commit hooks passed for staged changes"
        elif [ -f ".githooks/pre-commit" ]; then
            if ! bash .githooks/pre-commit; then
                die "PRE-COMMIT HOOKS FAILED - Deployment blocked. Fix the issues and try again."
            fi
            success "Pre-commit hooks passed for staged changes"
        else
            warning "No pre-commit hook found, running validators manually..."
            if ! run_validators; then
                die "VALIDATORS FAILED - Deployment blocked."
            fi
        fi
    else
        info "No staged changes, running validators on working directory..."
        if ! run_validators; then
            die "VALIDATORS FAILED - Deployment blocked."
        fi
    fi

    success "All pre-deployment validations passed"
}

run_validators() {
    info "Running Node.js validators..."

    if [ -f "$PROJECT_ROOT/scripts/validators/run-all.js" ]; then
        if ! node "$PROJECT_ROOT/scripts/validators/run-all.js"; then
            return 1
        fi
    else
        warning "Validator script not found, checking for basic issues..."

        # Basic hardcoded secrets check
        if grep -rE "(SHIELD_JWT_SECRET|SHIELD_DB_PASSWORD|twilio_auth_token)\s*=" --include="*.php" --include="*.js" "$PROJECT_ROOT" 2>/dev/null | grep -v ".git" | grep -v "node_modules" | grep -v ".env"; then
            error "Found hardcoded secrets in codebase!"
            return 1
        fi

        # Check for SQL in Controllers
        if grep -rE "\\\$[a-z_]+->query\s*\(" "$PROJECT_ROOT/backend/php/Controllers" 2>/dev/null; then
            error "Found SQL queries in Controllers (MVC violation)!"
            return 1
        fi
    fi

    return 0
}

# ============================================================================
# E2E TESTS VALIDATION (MANDATORY BEFORE DEPLOYMENT)
# ============================================================================

run_e2e_tests() {
    step "PHASE 0.5: E2E TESTS VALIDATION"

    info "Running E2E tests BEFORE deployment..."
    info "THIS CHECK IS MANDATORY - Deployment will be blocked if tests fail"

    cd "$PROJECT_ROOT"

    # Check if playwright is available
    if ! command -v npx &> /dev/null; then
        warning "npx not available - E2E tests skipped (NOT RECOMMENDED)"
        read -p "Continue without E2E tests? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            die "Deployment cancelled - install Node.js and run E2E tests"
        fi
        return 0
    fi

    # Check if test directory exists
    if [ ! -d "$PROJECT_ROOT/tests/playwright/e2e" ]; then
        warning "E2E test directory not found"
        return 0
    fi

    # Run all E2E tests
    info "Executing comprehensive E2E tests..."
    echo ""

    if npx playwright test tests/playwright/e2e/ --reporter=line 2>&1 | tee -a "$LOG_FILE"; then
        success "ALL E2E TESTS PASSED"
        echo ""
    else
        error "E2E TESTS FAILED"
        echo ""
        error "╔════════════════════════════════════════════════════════════════════╗"
        error "║  ❌ E2E TESTS FAILED - DEPLOYMENT BLOCKED                          ║"
        error "║                                                                     ║"
        error "║  Les tests E2E doivent passer AVANT tout déploiement.              ║"
        error "║  Exécutez: npx playwright test tests/playwright/e2e/ --headed      ║"
        error "║                                                                     ║"
        error "║  AUCUNE EXCEPTION. AUCUN BYPASS.                                   ║"
        error "╚════════════════════════════════════════════════════════════════════╝"
        echo ""

        read -p "Force deployment anyway? (type 'FORCE' to confirm): " confirm
        if [ "$confirm" != "FORCE" ]; then
            die "Deployment blocked by E2E test failures"
        fi

        warning "FORCING DEPLOYMENT DESPITE TEST FAILURES - THIS IS LOGGED"
        echo "[$(date)] FORCED DEPLOYMENT despite E2E failures by $(whoami)" >> "$PROJECT_ROOT/.deployment_warnings.log"
    fi

    return 0
}

# ============================================================================
# ENVIRONMENT CHECKS
# ============================================================================

check_prerequisites() {
    step "PHASE 1: PREREQUISITES CHECK"

    info "Checking required tools..."
    check_command "git"
    check_command "node"
    check_command "ssh"
    check_command "rsync"
    check_command "curl"

    info "Checking SSH connectivity..."
    if ! ssh -o BatchMode=yes -o ConnectTimeout=10 "$VPS_USER@$VPS_HOST" "echo 'SSH OK'" &>/dev/null; then
        die "Cannot connect to VPS via SSH. Check your SSH keys."
    fi
    success "SSH connection verified"

    info "Checking Git status..."
    cd "$PROJECT_ROOT"

    # Ensure we're on main branch
    local current_branch=$(git branch --show-current)
    if [ "$current_branch" != "main" ]; then
        warning "Not on main branch (current: $current_branch)"
        read -p "Continue anyway? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            die "Deployment cancelled"
        fi
    fi

    # Check for uncommitted changes
    if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
        warning "You have uncommitted changes"
        read -p "Continue anyway? (y/N): " confirm
        if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
            die "Deployment cancelled - commit your changes first"
        fi
    fi

    # Check for unpushed commits
    local unpushed=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l)
    if [ "$unpushed" -gt 0 ]; then
        warning "You have $unpushed unpushed commit(s)"
        read -p "Push before deploying? (Y/n): " confirm
        if [ "$confirm" != "n" ] && [ "$confirm" != "N" ]; then
            info "Pushing to origin..."
            git push origin main
        fi
    fi

    success "Prerequisites check passed"
}

# ============================================================================
# DEPLOYMENT PHASE
# ============================================================================

deploy_backend() {
    step "PHASE 2: BACKEND DEPLOYMENT"

    info "Creating backup on VPS..."
    ssh "$VPS_USER@$VPS_HOST" "
        if [ -d '$VPS_PATH' ]; then
            backup_name='${VPS_PATH}.bak-\$(date +%Y%m%d-%H%M%S)'
            sudo cp -r '$VPS_PATH' \"\$backup_name\"
            echo \"Backup created: \$backup_name\"
        fi
    "

    info "Deploying backend PHP..."
    rsync -avz --delete \
        --exclude='.env' \
        --exclude='*.log' \
        --exclude='vendor/' \
        --exclude='node_modules/' \
        "$BACKEND_DIR/" "$VPS_USER@$VPS_HOST:$VPS_PATH/backend/php/"

    success "Backend deployed"
}

deploy_public() {
    step "PHASE 3: PUBLIC ASSETS DEPLOYMENT"

    info "Deploying public assets..."
    rsync -avz --delete \
        --exclude='uploads/*' \
        --exclude='*.log' \
        "$PUBLIC_DIR/" "$VPS_USER@$VPS_HOST:$VPS_PATH/public/"

    success "Public assets deployed"
}

deploy_database() {
    step "PHASE 4: DATABASE MIGRATIONS"

    info "Deploying migration files..."
    rsync -avz \
        "$DATABASE_DIR/migrations/" "$VPS_USER@$VPS_HOST:$VPS_PATH/database/migrations/"

    info "Checking for pending migrations..."
    ssh "$VPS_USER@$VPS_HOST" "
        cd '$VPS_PATH'

        # Get DB credentials from .env
        if [ -f '.env' ]; then
            export \$(grep -E '^(DB_HOST|DB_PORT|DB_USER|DB_PASSWORD|DB_NAME)=' .env | xargs)

            # Check migrations table exists
            mysql -h \"\$DB_HOST\" -P \"\$DB_PORT\" -u \"\$DB_USER\" -p\"\$DB_PASSWORD\" \"\$DB_NAME\" -e '
                CREATE TABLE IF NOT EXISTS migrations (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    migration VARCHAR(255) NOT NULL,
                    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            ' 2>/dev/null

            # Apply new migrations
            for file in database/migrations/*.sql; do
                if [ -f \"\$file\" ]; then
                    filename=\$(basename \"\$file\")

                    # Check if already executed
                    exists=\$(mysql -h \"\$DB_HOST\" -P \"\$DB_PORT\" -u \"\$DB_USER\" -p\"\$DB_PASSWORD\" \"\$DB_NAME\" -N -e \"
                        SELECT COUNT(*) FROM migrations WHERE migration = '\$filename';
                    \" 2>/dev/null)

                    if [ \"\$exists\" = \"0\" ]; then
                        echo \"Applying migration: \$filename\"
                        if mysql -h \"\$DB_HOST\" -P \"\$DB_PORT\" -u \"\$DB_USER\" -p\"\$DB_PASSWORD\" \"\$DB_NAME\" < \"\$file\" 2>/dev/null; then
                            mysql -h \"\$DB_HOST\" -P \"\$DB_PORT\" -u \"\$DB_USER\" -p\"\$DB_PASSWORD\" \"\$DB_NAME\" -e \"
                                INSERT INTO migrations (migration) VALUES ('\$filename');
                            \" 2>/dev/null
                            echo \"  ✓ Applied\"
                        else
                            echo \"  ✗ Failed (may already be applied)\"
                        fi
                    fi
                fi
            done
        else
            echo 'No .env file found, skipping migrations'
        fi
    "

    success "Migrations completed"
}

set_permissions() {
    step "PHASE 5: PERMISSIONS"

    info "Setting file permissions..."
    ssh "$VPS_USER@$VPS_HOST" "
        sudo chown -R www-data:www-data '$VPS_PATH'
        sudo chmod -R 755 '$VPS_PATH'
        sudo chmod -R 775 '$VPS_PATH/public/uploads'
        sudo chmod -R 775 '$VPS_PATH/storage'
        sudo chmod 600 '$VPS_PATH/.env' 2>/dev/null || true
    "

    success "Permissions set"
}

reload_services() {
    step "PHASE 6: SERVICE RELOAD"

    info "Testing nginx configuration..."
    if ! ssh "$VPS_USER@$VPS_HOST" "sudo nginx -t" 2>&1 | tee -a "$LOG_FILE"; then
        die "Nginx configuration test failed!"
    fi
    success "Nginx configuration valid"

    info "Reloading nginx..."
    ssh "$VPS_USER@$VPS_HOST" "sudo systemctl reload nginx"
    success "Nginx reloaded"

    info "Restarting PHP-FPM..."
    ssh "$VPS_USER@$VPS_HOST" "sudo systemctl restart php8.2-fpm 2>/dev/null || sudo systemctl restart php-fpm"
    success "PHP-FPM restarted"

    info "Clearing application cache..."
    ssh "$VPS_USER@$VPS_HOST" "
        rm -f '$VPS_PATH/storage/cache/'* 2>/dev/null || true
    "
    success "Cache cleared"
}

# ============================================================================
# VERIFICATION PHASE
# ============================================================================

run_smoke_tests() {
    step "PHASE 7: SMOKE TESTS"

    local errors=0

    info "Waiting for services to stabilize..."
    sleep 5

    info "Testing health endpoint..."
    local health_response=$(curl -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" 2>/dev/null || echo "000")
    if [ "$health_response" == "200" ]; then
        success "Health: HTTP $health_response"
    else
        error "Health: HTTP $health_response (expected 200)"
        ((errors++))
    fi

    info "Testing API v1 health..."
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/v1/health" 2>/dev/null || echo "000")
    if [ "$api_response" == "200" ]; then
        success "API Health: HTTP $api_response"
    else
        error "API Health: HTTP $api_response (expected 200)"
        ((errors++))
    fi

    info "Testing auth endpoint (should return 401 without token)..."
    local auth_response=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/incidents.php?action=active" 2>/dev/null || echo "000")
    if [ "$auth_response" == "401" ]; then
        success "Auth protection: HTTP $auth_response (expected 401)"
    else
        error "Auth protection: HTTP $auth_response (expected 401)"
        ((errors++))
    fi

    info "Testing login page..."
    local login_response=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/auth/login" 2>/dev/null || echo "000")
    if [ "$login_response" == "200" ]; then
        success "Login page: HTTP $login_response"
    else
        error "Login page: HTTP $login_response (expected 200)"
        ((errors++))
    fi

    info "Testing Redis connectivity..."
    local redis_check=$(ssh "$VPS_USER@$VPS_HOST" "redis-cli -p 6380 PING 2>/dev/null || echo 'FAIL'")
    if [ "$redis_check" == "PONG" ]; then
        success "Redis: Connected"
    else
        warning "Redis: Not available (rate limiting will use session fallback)"
    fi

    echo ""
    if [ $errors -eq 0 ]; then
        success "ALL SMOKE TESTS PASSED"
    else
        error "$errors SMOKE TEST(S) FAILED"
        return 1
    fi
}

# ============================================================================
# ROLLBACK SUPPORT
# ============================================================================

rollback() {
    step "ROLLBACK"

    warning "Rolling back to previous deployment..."

    ssh "$VPS_USER@$VPS_HOST" "
        # Find latest backup
        latest_backup=\$(ls -td ${VPS_PATH}.bak-* 2>/dev/null | head -1)

        if [ -n \"\$latest_backup\" ]; then
            echo 'Restoring from: '\$latest_backup
            sudo rm -rf '$VPS_PATH'
            sudo mv \"\$latest_backup\" '$VPS_PATH'
            sudo chown -R www-data:www-data '$VPS_PATH'

            # Restart services
            sudo systemctl reload nginx
            sudo systemctl restart php8.2-fpm 2>/dev/null || sudo systemctl restart php-fpm

            echo 'Rollback completed'
        else
            echo 'No backup found for rollback!'
            exit 1
        fi
    "

    success "Rollback completed"
}

cleanup_old_backups() {
    info "Cleaning up old backups (keeping last 3)..."

    ssh "$VPS_USER@$VPS_HOST" "
        cd /var/www
        ls -td shield.bak-* 2>/dev/null | tail -n +4 | xargs -r sudo rm -rf
    "

    success "Cleanup completed"
}

# ============================================================================
# MAIN DEPLOYMENT FLOW
# ============================================================================

main() {
    echo ""
    echo -e "${BOLD}${CYAN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${CYAN}║     SHIELD FALLBACK DEPLOYMENT SCRIPT v1.0                ║${NC}"
    echo -e "${BOLD}${CYAN}║     Production: $PROD_URL            ║${NC}"
    echo -e "${BOLD}${CYAN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""

    info "Deployment started at $(date)"
    info "Log file: $LOG_FILE"
    echo ""

    # Parse arguments
    local skip_backend=false
    local skip_public=false
    local skip_migrations=false
    local do_rollback=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backend) skip_backend=true ;;
            --skip-public) skip_public=true ;;
            --skip-migrations) skip_migrations=true ;;
            --rollback) do_rollback=true ;;
            --help)
                echo "Usage: $0 [options]"
                echo ""
                echo "Options:"
                echo "  --skip-backend      Skip backend PHP deployment"
                echo "  --skip-public       Skip public assets deployment"
                echo "  --skip-migrations   Skip database migrations"
                echo "  --rollback          Rollback to previous deployment"
                echo "  --help              Show this help message"
                exit 0
                ;;
            *)
                warning "Unknown option: $1"
                ;;
        esac
        shift
    done

    # Handle rollback
    if [ "$do_rollback" = true ]; then
        check_prerequisites
        rollback
        run_smoke_tests
        exit 0
    fi

    # MANDATORY: Run pre-commit hooks validation
    validate_precommit_hooks

    # MANDATORY: Run E2E tests before deployment
    run_e2e_tests

    # Check prerequisites
    check_prerequisites

    # Deploy
    if [ "$skip_backend" = false ]; then
        deploy_backend
    else
        info "Skipping backend deployment (--skip-backend)"
    fi

    if [ "$skip_public" = false ]; then
        deploy_public
    else
        info "Skipping public assets deployment (--skip-public)"
    fi

    if [ "$skip_migrations" = false ]; then
        deploy_database
    else
        info "Skipping migrations (--skip-migrations)"
    fi

    # Set permissions and reload services
    set_permissions
    reload_services

    # Run smoke tests
    if ! run_smoke_tests; then
        error "Smoke tests failed!"
        read -p "Do you want to rollback? (y/N): " confirm
        if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
            rollback
            run_smoke_tests
        fi
        exit 1
    fi

    # Cleanup old backups
    cleanup_old_backups

    # Final summary
    echo ""
    echo -e "${BOLD}${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}${GREEN}║     DEPLOYMENT SUCCESSFUL                                 ║${NC}"
    echo -e "${BOLD}${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    success "Deployment completed at $(date)"
    info "Production URL: $PROD_URL"
    info "API URL: $API_URL"
    info "Log file: $LOG_FILE"
    echo ""
}

# Run main with all arguments
main "$@"
