# File Transfer Extension

A VS Code extension that provides a dual-pane file transfer interface. Copy files from one location to another for editing and later replace the originals.

## Features

- **Dual-Pane Interface**: Source and destination windows side by side
- **Folder Selection**: Open dialogs to select source and destination folders
- **File Listing**: Browse and navigate files and directories in both panes
- **Bidirectional Transfer**: Move files between source and destination
- **File Diff**: Compare changed files between source and destination using VS Code's native diff editor
- **Metadata Tracking**: Automatically tracks original source paths so files transferred to subdirectories can be compared and transferred back correctly
- **State Persistence**: Source and destination folder selections are remembered across sessions

## Usage

1. Open the File Transfer Panel with `Ctrl+Shift+F`
2. Click **Open Source Folder** and select your source directory
3. The destination folder defaults to the current VS Code workspace; click **Open Folder** in the destination pane to change it
4. Select files from either pane and click the transfer arrows (`→` / `←`) to copy them
5. Click the **◬ diff button** to open a native VS Code diff tab for every file that has changed between source and destination

## Diff Functionality

The diff button (◬) compares files that exist in both the source and destination folders.

- If **no files are selected** in the destination pane, all destination files with known source paths are compared.
- If **specific destination files are selected**, only those files are compared.
- Each changed file opens in its own VS Code diff tab (the same diff UI used by Git), showing the source version on the left and the destination version on the right.
- Files with identical content are silently skipped.
- Source paths for destination files are resolved via the `.ft-metadata.json` file stored in the destination folder. This enables correct diffing even when the original file lives in a subdirectory of the source.

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

