// @ts-check

const path = require('path');
const { defineConfig } = require('@rspack/cli');
const rspack = require('@rspack/core');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return defineConfig({
  target: ['web', 'es2020'],
  entry: {
    popup: './src/popup/popup.ts',
    // sidePanel: './src/sidePanel/sidePanel.ts',
    background: './src/scripts/background.ts',
    contentScript: './src/scripts/contentScript.ts',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true,
  },
  cache: {
    type: 'persistent',
    buildDependencies: [
      __filename,
      path.resolve(__dirname, 'package.json'),
      path.resolve(__dirname, 'pnpm-lock.yaml'),
    ],
    storage: {
      type: 'filesystem',
      directory: path.resolve(__dirname, 'node_modules/.cache/rspack'),
    },
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: 'builtin:swc-loader',
          options: {
            jsc: {
              target: 'es2020',
              parser: {
                syntax: 'typescript',
                tsx: false,
              },
            },
          },
        },
        type: 'javascript/auto',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/i,
        use: [rspack.CssExtractRspackPlugin.loader, 'css-loader', 'postcss-loader'],
      }
    ],
  },
  plugins: [
    new rspack.CssExtractRspackPlugin({
      filename: '[name].css',
    }),
    new rspack.HtmlRspackPlugin({
      template: './src/popup/popup.html',
      filename: 'popup.html',
      chunks: ['popup'],
      minify: true,
    }),
    // new rspack.HtmlRspackPlugin({
    //   template: './src/sidePanel/sidePanel.html',
    //   filename: 'sidePanel.html',
    //   chunks: ['sidePanel'],
    //   minify: true,
    // }),
    new rspack.CopyRspackPlugin({
      patterns: [
        { from: 'public', to: 'public' },
        { from: 'src/manifest.json', to: 'manifest.json' },
        { from: '_locales', to: '_locales' },
        { from: 'show.gif', to: 'show.gif' },
      ],
    }),
  ],
  mode: argv.mode,
  devtool: false, // Disable all source maps to prevent CSP violations
  optimization: {
    minimize: isProduction,
    minimizer: isProduction
      ? [
          new rspack.SwcJsMinimizerRspackPlugin({
            extractComments: false,
            minimizerOptions: {
              compress: {
                drop_console: true,
                drop_debugger: true,
                passes: 3,
              },
              format: {
                comments: false,
              },
            },
          }),
          new rspack.LightningCssMinimizerRspackPlugin({
            minimizerOptions: {
              errorRecovery: false,
            },
          }),
        ]
      : undefined,
    chunkIds: 'total-size',
    mangleExports: 'size',
    realContentHash: false,
  },
  });
};
