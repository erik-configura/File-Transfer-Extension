# File Transfer Extension

A VS Code extension that provides a dual-pane file transfer interface. Copy files from one location to another for editing and later replace the originals.

## Features

- **Dual-Pane Interface**: Source and destination windows side by side
- **Folder Selection**: Open dialogs to select source and destination folders
- **File Listing**: Browse and view files in both directories
- **Bidirectional Transfer**: Move files between source and destination
- **File Management**: Copy files for editing and manage versions

## Usage

1. Open the File Transfer Panel with `Ctrl+Shift+F`
2. Click "Open Source Folder" and select your source directory
3. Click "Open Destination Folder" and select your destination directory
4. Select files from either pane and click the transfer buttons
5. Use the bidirectional arrows to move files as needed

## Installation

Install from the VS Code Extension Marketplace by searching for "File Transfer".

## Development

```bash
npm install
npm run compile
```

To run the extension in debug mode, press `F5` in VS Code.

## Building

```bash
npm run esbuild
```

This will bundle and minify the extension for distribution.

## Packaging

To create a distributable VSIX package and an archive containing the package and source files, run:

```bash
npm run compile
npm run package
```

The `npm run package` step uses `vsce` to create a `.vsix` file. An updated ZIP archive named `package-file-transfer-extension.zip` is included in the repository root; it contains the `.vsix` and the `src` folder for reference and local installation.

To install from the produced VSIX manually:

1. Open VS Code.
2. Press `Ctrl+Shift+P` and choose `Extensions: Install from VSIX...`.
3. Select the generated `.vsix` file (or extract `package-file-transfer-extension.zip` and pick the `.vsix`).

