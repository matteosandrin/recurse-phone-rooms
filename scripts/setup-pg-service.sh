#!/bin/bash
#
# PostgreSQL Service Configuration Setup Script
# This script helps set up PostgreSQL service configuration for the project.
#

# Colors for better readability
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Paths
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATE_PATH="$PROJECT_ROOT/pg_service.conf"
TARGET_PATH="$HOME/.pg_service.conf"

echo -e "${BLUE}=== PostgreSQL Service Configuration Setup ===${NC}"

# Check if template exists
if [ ! -f "$TEMPLATE_PATH" ]; then
  echo -e "${RED}Error: Template file not found at: $TEMPLATE_PATH${NC}"
  exit 1
fi

# Check if target already exists
if [ -f "$TARGET_PATH" ]; then
  echo -e "${YELLOW}Found existing PostgreSQL service configuration at: $TARGET_PATH${NC}"

  read -p "What would you like to do? [O]verwrite, [M]erge, [S]kip: " choice
  case "$choice" in
    [Oo]* )
      echo "Overwriting existing configuration..."
      cp "$TEMPLATE_PATH" "$TARGET_PATH"
      echo -e "${GREEN}Configuration overwritten successfully!${NC}"
      ;;
    [Mm]* )
      echo "Merging configurations..."
      echo -e "${YELLOW}Which sections would you like to update?${NC}"
      echo -e "1) Local development database [local]"
      echo -e "2) Test database [test]"
      echo -e "3) Production database [prod]"
      echo -e "4) All sections"
      read -p "Enter your choice (1-4): " section_choice

      temp_file=$(mktemp)

      case "$section_choice" in
        1)
          # Extract local section from template and replace in target
          sed -n '/\[local\]/,/^\[/p' "$TEMPLATE_PATH" | sed '$d' > "$temp_file"
          sed -i.bak '/\[local\]/,/^\[/ { /\[local\]/!{ /^\[/!d } }' "$TARGET_PATH"
          sed -i.bak "/\[local\]/r $temp_file" "$TARGET_PATH"
          echo -e "${GREEN}[local] section updated!${NC}"
          ;;
        2)
          # Extract test section from template and replace in target
          sed -n '/\[test\]/,/^\[/p' "$TEMPLATE_PATH" | sed '$d' > "$temp_file"
          sed -i.bak '/\[test\]/,/^\[/ { /\[test\]/!{ /^\[/!d } }' "$TARGET_PATH"
          sed -i.bak "/\[test\]/r $temp_file" "$TARGET_PATH"
          echo -e "${GREEN}[test] section updated!${NC}"
          ;;
        3)
          # Extract prod section from template and replace in target
          sed -n '/\[prod\]/,/$/p' "$TEMPLATE_PATH" > "$temp_file"
          sed -i.bak '/\[prod\]/,$d' "$TARGET_PATH"
          echo -e "\n$(cat $temp_file)" >> "$TARGET_PATH"
          echo -e "${GREEN}[prod] section updated!${NC}"
          ;;
        4)
          cp "$TEMPLATE_PATH" "$TARGET_PATH"
          echo -e "${GREEN}All sections updated!${NC}"
          ;;
        *)
          echo -e "${RED}Invalid choice. No changes made.${NC}"
          ;;
      esac

      rm -f "$temp_file"
      rm -f "$TARGET_PATH.bak"
      ;;
    [Ss]* )
      echo -e "${YELLOW}Skipping configuration update.${NC}"
      ;;
    * )
      echo -e "${RED}Invalid choice. No changes made.${NC}"
      ;;
  esac
else
  # No existing config, create new one
  echo "Creating new PostgreSQL service configuration..."
  cp "$TEMPLATE_PATH" "$TARGET_PATH"
  echo -e "${GREEN}Configuration created at: $TARGET_PATH${NC}"
fi

# Set proper permissions
chmod 600 "$TARGET_PATH"
echo -e "${GREEN}File permissions set to 600 (user read/write only)${NC}"

# Test connections
echo -e "\n${BLUE}Testing database connections${NC}"

# Function to test database connection
test_connection() {
  service_name=$1
  echo -ne "Testing connection to [$service_name] service... "
  if command -v psql >/dev/null 2>&1; then
    if psql "service=$service_name" -c "SELECT 1" >/dev/null 2>&1; then
      echo -e "${GREEN}Success!${NC}"
      return 0
    else
      echo -e "${RED}Failed${NC}"
      return 1
    fi
  else
    echo -e "${YELLOW}psql command not found${NC}"
    return 2
  fi
}

# Test local and test connections
test_connection "local"
local_result=$?

test_connection "test"
test_result=$?

echo -e "\n${BLUE}Next Steps:${NC}"

if [ $local_result -eq 0 ] && [ $test_result -eq 0 ]; then
  echo -e "${GREEN}✓ All database connections successful!${NC}"
  echo -e "You can now use 'service=local', 'service=test', or 'service=prod' in your database connections."
elif [ $local_result -ne 0 ] || [ $test_result -ne 0 ]; then
  echo -e "${YELLOW}⚠ Some database connections failed.${NC}"
  echo -e "Please check your configuration and ensure your databases are running."

  if [ $local_result -ne 0 ]; then
    echo -e "  - Check local database connection parameters"
  fi

  if [ $test_result -ne 0 ]; then
    echo -e "  - Check test database connection parameters"
    echo -e "  - Run 'npm run setup:test-db' to create the test database"
  fi
fi

echo -e "\nFor production usage:"
echo -e "1. Update the [prod] section in $TARGET_PATH with your Railway credentials"
echo -e "2. Consider using environment variables for sensitive information:"
echo -e "   export PGPASSWORD=your_actual_railway_password"

echo -e "\n${GREEN}Setup complete!${NC}"