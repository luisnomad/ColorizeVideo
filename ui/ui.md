## Setting up React with Vite, TypeScript, and shadcn/ui

This guide provides detailed instructions to set up a new React project using Vite as the build tool, TypeScript for static typing, and shadcn/ui for pre-built UI components.

### Prerequisites

* **Node.js:** Ensure you have Node.js installed (version 18 or later). You can download it from [nodejs.org](https://nodejs.org/).
* **pnpm:** This guide uses pnpm as the package manager. If you don't have it, install it by running `npm install -g pnpm` in your terminal. You can use npm or yarn, but you'll need to adapt the commands.
* **Git:** (Optional, but recommended) It's good practice to initialize a Git repository for your project.

### Step-by-Step Instructions

1.  **Initialize a Vite Project:** Open your terminal and run the following command to create a new Vite project with a React and TypeScript template:

    ```bash
    pnpm create vite bw-colorizer --template react-ts
    ```

    Replace `bw-colorizer` with your desired project name.

2.  **Navigate to the Project Directory:**

    ```bash
    cd bw-colorizer
    ```

3.  **Install Dependencies:** Install the project dependencies, including React, React DOM, and the Vite plugins.

    ```bash
    pnpm install
    ```

4.  **Install shadcn/ui:** Use the `shadcn-ui` CLI to initialize shadcn/ui in your project. This will install the necessary components and set up the configuration.

    ```bash
    pnpm dlx shadcn-ui@latest init
    ```

    During the initialization, you'll be prompted to choose a style (e.g., `default`) and a primary color. Select your preferences. The default options are usually fine. If you get an error saying `command not found: dlx`, try running `npm install -g @npmcli/init` and then try the `pnpm dlx` command again.

5.  **Install additional dependencies**: Install the following dependencies:

    ```bash
    pnpm add react-hook-form @hookform/resolvers zod @radix-ui/react-slot
    ```

6.  **Set up TypeScript Path Mapping (Optional, but Recommended):** For better code organization and import management, set up TypeScript path mapping.

    Open `tsconfig.json` and add the following `compilerOptions.paths` configuration:

    ```json
    {
      "compilerOptions": {
        // ... other options
        "baseUrl": ".",
        "paths": {
          "@/*": ["./src/*"]
        }
      },
      // ... other options
    }
    ```

    This allows you to import modules using the `@/` prefix, e.g., `import MyComponent from '@/components/MyComponent';`.

7.  **Create `components.json`:** If the `shadcn-ui init` command didn't create it, create a `components.json` file in the root of your project to configure how shadcn/ui components are imported. This file is crucial for shadcn/ui to work correctly. It should look like this (adjust the `lib` path if necessary for your project structure):

    ```json
    {
      "style": "default",
      "rsc": false,
      "tailwind": {
        "config": "tailwind.config.ts",
        "css": "src/app/globals.css",
        "baseColor": "slate",
        "cssVariables": true
      },
      "aliases": {
        "components": "@/components",
        "utils": "@/lib/utils"
      }
    }
    ```

    * `style`: The style variant (e.g., "default", "new-york").
    * `rsc`: Whether you are using React Server Components.
    * `tailwind`: Configuration for Tailwind CSS.
    * `aliases`: Aliases for your components and utility functions. Make sure these paths match your project structure.

8.  **Update `vite.config.ts`:** Ensure your `vite.config.ts` file is configured correctly. A basic configuration should look like this:

    ```typescript
    import { defineConfig } from 'vite';
    import react from '@vitejs/plugin-react';
    import path from 'path';

    // [https://vitejs.dev/config/](https://vitejs.dev/config/)
    export default defineConfig({
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, './src'),
        },
      },
    });
    ```

    * `react()`: The Vite plugin for React.
    * `alias`: (Optional, but recommended) This alias matches the `@/` path from `tsconfig.json`.

9.  **Tailwind CSS Configuration:** shadcn/ui relies on Tailwind CSS. The `shadcn-ui init` command should have created a `tailwind.config.ts` file. Make sure it looks similar to this:

    ```typescript
    import type { Config } from 'tailwindcss';
    const config: Config = {
      content: [
        './src/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './app/**/*.{js,ts,jsx,tsx,mdx}',
      ],
      theme: {
        extend: {
          keyframes: {
            "accordion-down": {
              from: { height: '0' },
              to: { height: 'var(--radix-accordion-content-height)' },
            },
            "accordion-up": {
              from: { height: 'var(--radix-accordion-content-height)' },
              to: { height: '0' },
            },
          },
          animation: {
            "accordion-down": 'accordion-down 0.2s ease-out',
            "accordion-up": 'accordion-up 0.2s ease-out',
          },
        },
      },
      plugins: [require('tailwindcss-animate')],
    };
    export default config;
    ```

    * `content`: Specifies the files where Tailwind CSS classes are used. Make sure this includes your `src` directory, `components` directory, and any other relevant paths.
    * `plugins`: Includes `tailwindcss-animate`

10. **Set up Global CSS:** Create a global CSS file (e.g., `src/app/globals.css`) and include the necessary Tailwind CSS directives. This file is where you'll import global styles and any custom CSS. It should look like this:

    ```css
    @tailwind base;
    @tailwind components;
    @tailwind utilities;

    :root {
      --background: 0 0% 100%;
      --foreground: 222.2 47.4% 11.2%;
      --muted: 240 4.8% 95.9%;
      --muted-foreground: 240 3.8% 46.1%;
      --popover: 0 0% 100%;
      --popover-foreground: 222.2 47.4% 11.2%;
      --card: 0 0% 100%;
      --card-foreground: 222.2 47.4% 11.2%;
      --primary: 222.1 83.3% 17%;
      --primary-foreground: 210 40% 98%;
      --secondary: 240 4.8% 95.9%;
      --secondary-foreground: 240 5.9% 10%;
      --accent: 240 4.8% 95.9%;
      --accent-foreground: 240 5.9% 10%;
      --destructive: 0 84.2% 60.2%;
      --destructive-foreground: 210 40% 98%;
      --border: 240 5.9% 90%;
      --input: 240 5.9% 90%;
      --ring: 240 5% 64.9%;
      --radius: 0.5rem;
    }

    .dark {
      --background: 222.2 84% 4.9%;
      --foreground: 210 40% 98%;
      --muted: 217.2 32.6% 17.5%;
      --muted-foreground: 215 20.2% 65.1%;
      --popover: 222.2 84% 4.9%;
      --popover-foreground: 210 40% 98%;
      --card: 222.2 84% 4.9%;
      --card-foreground: 210 40% 98%;
      --primary: 212.9 85.1% 27.1%;
      --primary-foreground: 210 40% 98%;
      --secondary: 217.2 32.6% 17.5%;
      --secondary-foreground: 210 40% 98%;
      --accent: 217.2 32.6% 17.5%;
      --accent-foreground: 210 40% 98%;
      --destructive: 0 62.8% 30.6%;
      --destructive-foreground: 210 40% 98%;
      --border: 217.2 32.6% 17.5%;
      --input: 217.2 32.6% 17.5%;
      --ring: 212.9 85.1% 27.1%;
    }

    *,
    *::before,
    *::after {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: 'Inter', sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      color: var(--foreground);
      background: var(--background);
    }
    ```

    * `@tailwind base`, `@tailwind components`, `@tailwind utilities`: These directives inject Tailwind's base styles, component styles, and utility classes into your CSS.
    * `:root` and `.dark`: Defines the CSS variables for light and dark mode.
    * `body`: Sets default styles for the `body` element.
    * `font-family`: Ensure the font family is set to 'Inter'.

11. **Update `main.tsx`:** Update your `main.tsx` file to use the global CSS file and render your main component.

    ```typescript
    import React from 'react';
    import ReactDOM from 'react-dom/client';
    import App from './App'; // Or the path to your main component
    import './app/globals.css'; // Import the global CSS file
    import { Inter } from 'next/font/google';

    const inter = Inter({
      subsets: ['latin'],
      variable: '--font-inter',
    });

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <div className={inter.variable}>
          <App />
        </div>
      </React.StrictMode>
    );
    ```

    * Import the global CSS file.
    * Wrap your application with the Inter font.

12. **Start the Development Server:** Run the following command to start the Vite development server:

    ```bash
    pnpm dev
    ```

    Open your browser and navigate to the displayed URL (usually `http://localhost:5173`) to see your running application.

### Project Structure

After following these steps, your project structure should look similar to this:

bw-colorizer/├── .gitignore├── components.json├── package.json├── pnpm-lock.yaml├── public/│   └── vite.svg├── src/│   ├── App.tsx│   ├── app/│   │   └── globals.css│   ├── assets/│   │   └── react.svg│   ├── components/│   │   └── ui/│   │       ├── accordion.tsx│   │       ├── button.tsx│   │       └── ...│   ├── lib/│   │   └── utils.ts│   ├── main.tsx│   └── vite-env.d.ts├── tailwind.config.ts├── tsconfig.json├── tsconfig.node.json└── vite.config.ts
### Explanation of Key Files

* `package.json`: Contains project metadata and dependencies.
* `pnpm-lock.yaml`: (Or `package-lock.json` or `yarn.lock`) Records the exact versions of dependencies.
* `vite.config.ts`: Vite configuration file.
* `tsconfig.json`: TypeScript configuration file.
* `tailwind.config.ts`: Tailwind CSS configuration file.
* `src/app/globals.css`: Global CSS file for importing Tailwind directives and custom styles.
* `src/main.tsx`: Entry point of the React application.
* `src/App.tsx`: Main application component.
* `src/components/ui`: shadcn/ui components.
* `components.json`: shadcn/ui components configuration.
* `public`: Contains static assets.
