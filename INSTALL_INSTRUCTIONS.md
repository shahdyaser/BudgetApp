# Installation Instructions

## Issue: npm SSL Error

You're experiencing an SSL/TLS error with npm. Here are several solutions:

## Solution 1: Update Node.js and npm (Recommended)

1. Download and install the latest LTS version of Node.js from https://nodejs.org/
2. This will update both Node.js and npm with the latest SSL/TLS support
3. Restart your terminal/IDE
4. Run: `npm install`

## Solution 2: Use Yarn Instead

1. Install Yarn globally:
   ```powershell
   npm install -g yarn
   ```
2. Then use Yarn to install dependencies:
   ```powershell
   yarn install
   ```

## Solution 3: Manual Package Installation

If npm continues to fail, try installing packages one by one:

```powershell
npm install tailwindcss --save-dev --strict-ssl=false
npm install postcss --save-dev --strict-ssl=false
npm install autoprefixer --save-dev --strict-ssl=false
npm install class-variance-authority --strict-ssl=false
npm install clsx --strict-ssl=false
npm install tailwind-merge --strict-ssl=false
npm install tailwindcss-animate --strict-ssl=false
npm install lucide-react --strict-ssl=false
npm install @radix-ui/react-checkbox --strict-ssl=false
npm install @radix-ui/react-dropdown-menu --strict-ssl=false
npm install @radix-ui/react-label --strict-ssl=false
npm install @radix-ui/react-select --strict-ssl=false
npm install @radix-ui/react-slot --strict-ssl=false
```

## Solution 4: Fix npm Configuration

Try these commands:

```powershell
npm config set strict-ssl false
npm config set registry https://registry.npmjs.org/
npm cache clean --force
npm install
```

## Solution 5: Check for Running Processes

Make sure no Node.js processes are running that might lock files:

1. Stop your dev server (Ctrl+C)
2. Close any IDEs/editors
3. Try installing again

## After Installation

Once packages are installed, restart your dev server:

```powershell
npm run dev
```
