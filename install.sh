#!/bin/bash

# ============================================
# Asset Tracker Installation Script
# Supports both Docker and Podman
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Container runtime (docker or podman)
CONTAINER_RUNTIME=""
COMPOSE_CMD=""

# Print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN} Asset Tracker Installation${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
}

# Detect and set container runtime (Docker or Podman)
detect_container_runtime() {
    print_info "Detecting container runtime..."
    
    # Check for Docker
    if command -v docker &> /dev/null; then
        CONTAINER_RUNTIME="docker"
        # Check for docker compose (v2) or docker-compose (v1)
        if docker compose version &> /dev/null 2>&1; then
            COMPOSE_CMD="docker compose"
        elif command -v docker-compose &> /dev/null; then
            COMPOSE_CMD="docker-compose"
        fi
    fi
    
    # Check for Podman
    if command -v podman &> /dev/null; then
        # If Docker wasn't found or user prefers Podman
        if [[ -z "$CONTAINER_RUNTIME" ]]; then
            CONTAINER_RUNTIME="podman"
        fi
        # Check for podman-compose
        if command -v podman-compose &> /dev/null; then
            if [[ -z "$COMPOSE_CMD" ]] || [[ "$CONTAINER_RUNTIME" == "podman" ]]; then
                COMPOSE_CMD="podman-compose"
            fi
        elif podman compose version &> /dev/null 2>&1; then
            if [[ -z "$COMPOSE_CMD" ]] || [[ "$CONTAINER_RUNTIME" == "podman" ]]; then
                COMPOSE_CMD="podman compose"
            fi
        fi
    fi
}

# Check for required commands
check_requirements() {
    print_info "Checking system requirements..."
    
    detect_container_runtime
    
    if [[ -z "$CONTAINER_RUNTIME" ]]; then
        print_error "Neither Docker nor Podman is installed."
        echo "Please install one of the following:"
        echo "  - Docker: https://docs.docker.com/get-docker/"
        echo "  - Podman: https://podman.io/getting-started/installation"
        exit 1
    fi
    
    if [[ -z "$COMPOSE_CMD" ]]; then
        if [[ "$CONTAINER_RUNTIME" == "docker" ]]; then
            print_error "Docker Compose is not installed. Please install Docker Compose."
            echo "Visit: https://docs.docker.com/compose/install/"
        else
            print_error "Podman Compose is not installed. Please install podman-compose."
            echo "Install with: pip install podman-compose"
            echo "Or use: dnf install podman-compose (Fedora/RHEL)"
        fi
        exit 1
    fi
    
    print_success "Container runtime: ${CONTAINER_RUNTIME}"
    print_success "Compose command: ${COMPOSE_CMD}"
    print_success "All requirements met!"
}

# Ask yes/no question
ask_yes_no() {
    local question="$1"
    local default="${2:-n}"
    
    if [[ "$default" == "y" ]]; then
        prompt="[Y/n]"
    else
        prompt="[y/N]"
    fi
    
    while true; do
        read -p "$question $prompt: " answer
        answer=${answer:-$default}
        case $answer in
            [Yy]* ) return 0;;
            [Nn]* ) return 1;;
            * ) echo "Please answer yes (y) or no (n).";;
        esac
    done
}

# Get user input with default value
get_input() {
    local question="$1"
    local default="$2"
    local result
    
    read -p "$question [$default]: " result
    echo "${result:-$default}"
}

# Get password input (hidden)
get_password() {
    local question="$1"
    local default="$2"
    local result
    
    read -s -p "$question [$default]: " result
    echo ""
    echo "${result:-$default}"
}

# Main installation function
main() {
    print_header
    check_requirements
    
    # Initialize configuration variables
    USE_DOCKER_POSTGRES=false
    USE_PRISMA=false
    DATABASE_URL=""
    POSTGRES_USER="assettracker"
    POSTGRES_PASSWORD="assettracker"
    POSTGRES_DB="assettracker"
    APP_PORT="3000"
    DB_PORT="5432"
    
    echo ""
    print_info "This script will help you configure Asset Tracker for deployment."
    echo ""
    
    # ============================================
    # Database Configuration
    # ============================================
    echo -e "${YELLOW}--- Database Configuration ---${NC}"
    echo ""
    
    if ask_yes_no "Do you have an existing PostgreSQL database to use?" "n"; then
        USE_DOCKER_POSTGRES=false
        print_info "Using external PostgreSQL database."
        echo ""
        
        # Get external database connection details
        DB_HOST=$(get_input "Enter database host" "localhost")
        DB_PORT=$(get_input "Enter database port" "5432")
        DB_NAME=$(get_input "Enter database name" "assettracker")
        DB_USER=$(get_input "Enter database username" "postgres")
        DB_PASS=$(get_password "Enter database password" "password")
        
        DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
        
    else
        USE_DOCKER_POSTGRES=true
        print_info "Will create PostgreSQL database using Docker."
        echo ""
        
        POSTGRES_USER=$(get_input "Enter PostgreSQL username" "assettracker")
        POSTGRES_PASSWORD=$(get_password "Enter PostgreSQL password" "assettracker")
        POSTGRES_DB=$(get_input "Enter database name" "assettracker")
        DB_PORT=$(get_input "Enter database port to expose" "5432")
        
        DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
    fi
    
    echo ""
    
    # ============================================
    # Schema Creation Method
    # ============================================
    echo -e "${YELLOW}--- Schema Creation Method ---${NC}"
    echo ""
    
    echo "How would you like to create the database schema?"
    echo "  1) Prisma (recommended) - Uses Prisma migrations for schema management"
    echo "  2) SQL Scripts - Uses raw SQL scripts to create tables"
    echo ""
    
    while true; do
        read -p "Enter choice [1 or 2]: " schema_choice
        case $schema_choice in
            1 ) USE_PRISMA=true; break;;
            2 ) USE_PRISMA=false; break;;
            * ) echo "Please enter 1 or 2.";;
        esac
    done
    
    # ============================================
    # Application Port
    # ============================================
    echo ""
    echo -e "${YELLOW}--- Application Settings ---${NC}"
    echo ""
    
    APP_PORT=$(get_input "Enter application port" "3000")
    
    # ============================================
    # Create .env file
    # ============================================
    echo ""
    print_info "Creating .env configuration file..."
    
    cat > .env << EOF
# Asset Tracker Configuration
# Generated by install.sh on $(date)

# Database Connection
DATABASE_URL="${DATABASE_URL}"

# Docker PostgreSQL Settings (if using Docker-provided database)
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_DB=${POSTGRES_DB}

# Application Settings
APP_PORT=${APP_PORT}
DB_PORT=${DB_PORT}
NODE_ENV=production
EOF
    
    print_success ".env file created!"
    
    # ============================================
    # Start Services
    # ============================================
    echo ""
    print_info "Building and starting services..."
    echo ""
    
    if $USE_DOCKER_POSTGRES; then
        # Start with included database
        print_info "Starting with containerized PostgreSQL..."
        $COMPOSE_CMD --profile with-db up -d --build
        
        print_info "Waiting for database to be ready..."
        sleep 10
        
        if $USE_PRISMA; then
            print_info "Running Prisma migrations..."
            $COMPOSE_CMD exec app npx prisma migrate deploy 2>/dev/null || \
            $COMPOSE_CMD exec app npx prisma db push --accept-data-loss 2>/dev/null || \
            print_warning "Could not run Prisma migrations. You may need to run them manually."
        else
            print_info "SQL schema will be auto-initialized by PostgreSQL container."
        fi
    else
        # Start app only
        print_info "Starting application only (using external database)..."
        $COMPOSE_CMD --profile app-only up -d --build
        
        if $USE_PRISMA; then
            print_info "Running Prisma migrations on external database..."
            $COMPOSE_CMD exec app npx prisma migrate deploy 2>/dev/null || \
            $COMPOSE_CMD exec app npx prisma db push --accept-data-loss 2>/dev/null || \
            print_warning "Could not run Prisma migrations automatically."
            echo ""
            print_info "To run migrations manually, use:"
            echo "  npx prisma migrate deploy"
            echo "  # or"
            echo "  npx prisma db push"
        else
            print_info "Schema should be created using SQL scripts."
            echo ""
            print_info "To create the schema manually, run:"
            echo "  psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME} -f sql/init/01-schema.sql"
        fi
    fi
    
    # ============================================
    # Run Prisma seed if using Prisma
    # ============================================
    if $USE_PRISMA; then
        echo ""
        if ask_yes_no "Would you like to seed the database with initial data?" "y"; then
            print_info "Running database seed..."
            $COMPOSE_CMD exec app npm run db:seed 2>/dev/null || \
            print_warning "Seeding failed. You can run it manually later with: $COMPOSE_CMD exec app npm run db:seed"
        fi
    fi
    
    # ============================================
    # Final Output
    # ============================================
    echo ""
    echo -e "${GREEN}============================================${NC}"
    echo -e "${GREEN} Installation Complete!${NC}"
    echo -e "${GREEN}============================================${NC}"
    echo ""
    print_success "Asset Tracker is now running!"
    echo ""
    echo -e "  Application URL: ${GREEN}http://localhost:${APP_PORT}${NC}"
    echo ""
    echo "Useful commands (using ${CONTAINER_RUNTIME}):"
    echo "  View logs:        $COMPOSE_CMD logs -f"
    echo "  Stop services:    $COMPOSE_CMD down"
    echo "  Restart:          $COMPOSE_CMD restart"
    echo "  Shell access:     $COMPOSE_CMD exec app sh"
    echo ""
    
    if $USE_PRISMA; then
        echo "Prisma commands:"
        echo "  Run migrations:   $COMPOSE_CMD exec app npx prisma migrate deploy"
        echo "  Reset database:   $COMPOSE_CMD exec app npx prisma migrate reset"
        echo "  Prisma Studio:    $COMPOSE_CMD exec app npx prisma studio"
    fi
    
    echo ""
    print_info "For API testing, import the Postman collection from: postman/AssetTracker.postman_collection.json"
    echo ""
}

# Run main function
main "$@"
