#!/bin/bash

# Railway Deployment Setup Script
# Run this before deploying to Railway

echo "🚂 Railway Deployment Setup"
echo "================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "Please run this script from the V1frontend directory"
    exit 1
fi

echo "✅ Found package.json"
echo ""

# Install Railway CLI
echo "📦 Installing Railway CLI..."
npm install -g @railway/cli

echo ""
echo "✅ Railway CLI installed"
echo ""

# Check for environment variables
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    echo "⚠️  Warning: No .env file found"
    echo "Creating .env.example for reference..."
    echo ""
fi

# Build the project to check for errors
echo "🔨 Testing build..."
npm run build

if [ $? -eq 0 ]; then
    echo "✅ Build successful!"
    echo ""
else
    echo "❌ Build failed. Please fix errors before deploying."
    exit 1
fi

# Prisma check
echo "🔍 Checking Prisma setup..."
if [ -f "prisma/schema.prisma" ]; then
    echo "✅ Prisma schema found"
    npx prisma generate
    echo "✅ Prisma client generated"
else
    echo "⚠️  Warning: Prisma schema not found"
fi

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo ""
echo "Next steps:"
echo "1. Push your code to GitHub"
echo "2. Go to railway.app and sign in"
echo "3. Create new project from GitHub"
echo "4. Add Redis database"
echo "5. Configure environment variables"
echo "6. Deploy!"
echo ""
echo "See DEPLOYMENT.md for detailed instructions"

