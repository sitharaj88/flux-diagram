const esbuild = require('esbuild');
const path = require('path');
const fs = require('fs');

const isProduction = process.argv.includes('--production');
const isWatch = process.argv.includes('--watch');

// Path aliases from tsconfig
const aliases = {
    '@core': path.resolve(__dirname, 'src/core'),
    '@canvas': path.resolve(__dirname, 'src/canvas'),
    '@renderer': path.resolve(__dirname, 'src/renderer'),
    '@layout': path.resolve(__dirname, 'src/layout'),
    '@nodes': path.resolve(__dirname, 'src/nodes'),
    '@export': path.resolve(__dirname, 'src/export'),
    '@webview': path.resolve(__dirname, 'src/webview'),
    '@commands': path.resolve(__dirname, 'src/commands'),
    '@utils': path.resolve(__dirname, 'src/utils'),
    '@types': path.resolve(__dirname, 'src/types'),
};

// Plugin to resolve path aliases
const aliasPlugin = {
    name: 'alias',
    setup(build) {
        Object.entries(aliases).forEach(([alias, target]) => {
            const filter = new RegExp(`^${alias.replace('@', '\\@')}/`);
            build.onResolve({ filter }, (args) => {
                const resolvedPath = args.path.replace(alias, target);
                return { path: resolvedPath };
            });
        });
    },
};

// Copy webview assets to dist
const copyWebviewAssets = {
    name: 'copy-webview-assets',
    setup(build) {
        build.onEnd(() => {
            const srcDir = path.join(__dirname, 'src/webview');
            const destDir = path.join(__dirname, 'dist/webview');

            // Create webview directory
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }

            // Copy HTML file
            const htmlSrc = path.join(srcDir, 'index.html');
            const htmlDest = path.join(destDir, 'index.html');
            if (fs.existsSync(htmlSrc)) {
                fs.copyFileSync(htmlSrc, htmlDest);
            }

            // Copy and create styles directory
            const stylesDir = path.join(destDir, 'styles');
            if (!fs.existsSync(stylesDir)) {
                fs.mkdirSync(stylesDir, { recursive: true });
            }
            const cssFiles = ['main.css', 'themes.css', 'components.css'];
            cssFiles.forEach((file) => {
                const src = path.join(srcDir, 'styles', file);
                const dest = path.join(stylesDir, file);
                if (fs.existsSync(src)) {
                    fs.copyFileSync(src, dest);
                }
            });

            console.log('📦 Webview assets copied');
        });
    },
};

// Extension build config
const extensionConfig = {
    entryPoints: ['src/extension.ts'],
    bundle: true,
    outfile: 'dist/extension.js',
    external: ['vscode'],
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    sourcemap: !isProduction,
    minify: isProduction,
    plugins: [aliasPlugin],
    define: {
        'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
};

// Webview build config
const webviewConfig = {
    entryPoints: ['src/webview/main.ts'],
    bundle: true,
    outfile: 'dist/webview/main.js',
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: !isProduction,
    minify: isProduction,
    plugins: [aliasPlugin, copyWebviewAssets],
    define: {
        'process.env.NODE_ENV': isProduction ? '"production"' : '"development"',
    },
};

async function build() {
    console.log(`🔨 Building in ${isProduction ? 'production' : 'development'} mode...`);

    try {
        if (isWatch) {
            // Watch mode
            const extContext = await esbuild.context(extensionConfig);
            const webContext = await esbuild.context(webviewConfig);

            await Promise.all([extContext.watch(), webContext.watch()]);

            console.log('👀 Watching for changes...');
            console.log('✅ Build complete!');
        } else {
            // Single build
            await Promise.all([esbuild.build(extensionConfig), esbuild.build(webviewConfig)]);

            console.log('✅ Build complete!');
        }
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
