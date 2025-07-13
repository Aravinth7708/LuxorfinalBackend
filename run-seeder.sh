#!/bin/bash

echo "Running Villa and Villa Image seeder..."

# Change to the script's directory
cd "$(dirname "$0")"

# Ensure we're in the backend directory
if [ ! -f "s.js" ]; then
  echo "Error: s.js not found in current directory"
  exit 1
fi

# Run the seeder script
echo "Executing seeder script..."
node s.js

# Check if it ran successfully
if [ $? -eq 0 ]; then
  echo "Seeder script completed successfully"
  echo "You can now verify that images are visible in the admin UI"
else
  echo "Seeder script encountered an error"
  exit 1
fi

echo "Done!"
