import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getWebviewContent } from './webviewContent';
import { listDestinationFiles, copyFile, deleteFile, listDirContents, copyFileToDir, fileExists, moveFile } from './fileManager';
import * as metadata from './metadataManager';
import { computeDiffCandidates, computeDiffFlags } from './diffSelector';
let panel: vscode.WebviewPanel | undefined;
let sourceFolderPath: string | undefined;
let destFolderPath: string | undefined;
let currentSourceBrowsePath: string | undefined;
let currentDestMetadata: Record<string, string> = {};
let currentDestDiffFlags: Record<string, boolean> = {};
let extensionContext: vscode.ExtensionContext;
let sourceFolderWatcher: vscode.FileSystemWatcher | undefined;
let destFolderWatcher: vscode.FileSystemWatcher | undefined;
let refreshTimer: ReturnType<typeof setTimeout> | undefined;
let pendingSourceRefresh = false;
let pendingDestRefresh = false;

export function activate(context: vscode.ExtensionContext) {
  extensionContext = context;

  sourceFolderPath = context.workspaceState.get('fileTransfer.sourceFolderPath');
  destFolderPath = context.workspaceState.get('fileTransfer.destFolderPath');
  currentSourceBrowsePath = context.workspaceState.get('fileTransfer.currentSourceBrowsePath');

  setupSourceFolderWatcher(sourceFolderPath);
  setupDestFolderWatcher(destFolderPath);

  let disposable = vscode.commands.registerCommand(
    'fileTransfer.openPanel',
    () => {
      openFileTransferPanel(context);
    }
  );

  context.subscriptions.push(disposable);
  context.subscriptions.push(
    vscode.workspace.onDidSaveTextDocument(async (doc) => {
      await handleSavedFile(doc.uri.fsPath);
    })
  );

  if (vscode.window.registerWebviewPanelSerializer) {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer('fileTransfer', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: any) {
          // Reuse the restored panel rather than disposing and recreating it.
          // Folder paths are persisted in workspace state and restored via requestInitialState.
          panel = webviewPanel;
          webviewPanel.webview.options = { enableScripts: true, enableCommandUris: true };
          webviewPanel.webview.html = getWebviewContent();
          setupPanelMessageHandling(webviewPanel);
          webviewPanel.onDidDispose(() => { panel = undefined; });
        }
      })
    );
  }
}

function openFileTransferPanel(context: vscode.ExtensionContext) {
  if (panel) {
    panel.reveal(vscode.ViewColumn.One);
    return;
  }

  panel = vscode.window.createWebviewPanel(
    'fileTransfer',
    'File Transfer',
    vscode.ViewColumn.One,
    {
      enableScripts: true,
      enableCommandUris: true
    }
  );

  panel.webview.html = getWebviewContent();
  setupPanelMessageHandling(panel);
  panel.onDidDispose(() => {
    panel = undefined;
  });
}

function setupPanelMessageHandling(panelInstance: vscode.WebviewPanel) {
  panelInstance.webview.onDidReceiveMessage(
    async (message) => {
      console.log('[FT] Received message:', message.command, 'with files:', message.files?.length || 0);
      switch (message.command) {
        case 'selectSourceFolder':
          await selectFolder('source');
          break;
        case 'selectDestFolder':
          await selectFolder('destination');
          break;
        case 'refreshSource':
          if (sourceFolderPath && currentSourceBrowsePath && panel) {
            const files = await listDirContents(currentSourceBrowsePath!);
            panel.webview.postMessage({ command: 'sourceRefreshed', files: mapDirEntries(files) });
            await refreshDestinationIndicators();
          }
          break;
        case 'enterDirectory':
          if (message.path && sourceFolderPath && message.path.startsWith(sourceFolderPath) && panel) {
            currentSourceBrowsePath = message.path;
            persistState();
            const files = await listDirContents(currentSourceBrowsePath!);
            panel.webview.postMessage({ command: 'enteredDirectory', path: currentSourceBrowsePath, files: mapDirEntries(files) });
          }
          break;
        case 'navigateUp':
          if (currentSourceBrowsePath && sourceFolderPath && panel) {
            const parent = path.dirname(currentSourceBrowsePath);
            if (parent && parent.length >= sourceFolderPath.length) {
              currentSourceBrowsePath = parent;
              persistState();
              const files = await listDirContents(currentSourceBrowsePath!);
              panel.webview.postMessage({ command: 'enteredDirectory', path: currentSourceBrowsePath, files: mapDirEntries(files) });
            }
          }
          break;
        case 'refreshDestination':
          if (destFolderPath && panel) {
            await refreshFolder('destination');
          }
          break;
        case 'requestInitialState':
          await restorePanelState(panelInstance);
          break;
        case 'transferToDestination':
          await transferFilesWithOverwriteConfirm('source', 'destination', message.files);
          break;
        case 'transferToSource':
          await transferFilesWithConfirm('destination', 'source', message.files);
          break;
        case 'deleteFiles':
          await deleteFilesInFolder(message.folder, message.files);
          break;
        case 'showDiff':
          await showDiffPanel(message.files);
          break;
        case 'showDiffForFile':
          if (message.file) {
            await showDiffPanel([message.file]);
          }
          break;
      }
    },
    undefined,
    extensionContext.subscriptions
  );
}

async function persistState() {
  if (!extensionContext) return;
  await extensionContext.workspaceState.update('fileTransfer.sourceFolderPath', sourceFolderPath);
  await extensionContext.workspaceState.update('fileTransfer.destFolderPath', destFolderPath);
  await extensionContext.workspaceState.update('fileTransfer.currentSourceBrowsePath', currentSourceBrowsePath);
}

async function restorePanelState(panelInstance?: vscode.WebviewPanel) {
  const webviewPanel = panelInstance || panel;
  if (!webviewPanel) return;

  if (sourceFolderPath) {
    const browsePath = currentSourceBrowsePath || sourceFolderPath;
    const entries = await listDirContents(browsePath);
    webviewPanel.webview.postMessage({
      command: 'sourceFolderSelected',
      path: sourceFolderPath,
      browsePath,
      files: mapDirEntries(entries)
    });
  }

  if (!destFolderPath && vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
    destFolderPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
    await persistState();
  }

  if (destFolderPath) {
    await postDestinationState(webviewPanel, 'destinationFolderSelected');
  }
}

async function selectFolder(folderType: 'source' | 'destination') {
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    title: `Select ${folderType} folder`
  });

  if (folderUri && folderUri[0]) {
    const folderPath = folderUri[0].fsPath;
    if (folderType === 'source') {
      sourceFolderPath = folderPath;
      currentSourceBrowsePath = folderPath;
      setupSourceFolderWatcher(sourceFolderPath);
      await persistState();
      const entries = await listDirContents(folderPath);
      if (panel) {
        panel.webview.postMessage({ command: 'sourceFolderSelected', path: folderPath, browsePath: currentSourceBrowsePath, files: mapDirEntries(entries) });
        await refreshDestinationIndicators();
      }
    } else {
      destFolderPath = folderPath;
      setupDestFolderWatcher(destFolderPath);
      await persistState();
      if (panel) {
        await postDestinationState(panel, 'destinationFolderSelected');
      }
    }
  }
}

async function transferFiles(
  sourceFolder: 'source' | 'destination',
  destFolder: 'source' | 'destination',
  files: { name: string; path: string }[]
) {
  if (!panel) return;
  try {
    if (sourceFolder === 'source' && destFolder === 'destination') {
      if (!destFolderPath) { vscode.window.showErrorMessage('Select destination folder first.'); return; }
      for (const file of files) {
        const stats = await fs.promises.stat(file.path);
        if (!stats.isFile()) continue;
        const destinationPath = path.join(destFolderPath, path.basename(file.path));
        const exists = await fileExists(destinationPath);
        let destName: string;
        if (exists) {
          await copyFile(file.path, destinationPath);
          destName = path.basename(file.path);
        } else {
          destName = await copyFileToDir(file.path, destFolderPath);
        }
        await metadata.updateMetadata(destFolderPath, destName, file.path);
      }
      await postDestinationState(panel, 'metadataUpdated');
      panel.webview.postMessage({ command: 'transferComplete', message: `${files.length} file(s) transferred to destination` });
    } else if (sourceFolder === 'destination' && destFolder === 'source') {
      if (!sourceFolderPath) { vscode.window.showErrorMessage('Select source folder first.'); return; }
      if (!destFolderPath) { vscode.window.showErrorMessage('Destination folder not set.'); return; }
      console.log('[FT] Transferring back to source. Files:', files);
      console.log('[FT] Current metadata:', currentDestMetadata);
      let transferredCount = 0;
      for (const file of files) {
        console.log(`[FT] Processing file: ${file.name}, looking up in metadata...`);
        const orig = currentDestMetadata[file.name];
        const targetPath = orig || path.join(sourceFolderPath, file.name);
        if (!orig) {
          console.warn(`[FT] No metadata found for ${file.name}, copying back to source folder at ${targetPath}`);
        }
        console.log(`[FT] Copying ${file.path} back to ${targetPath}`);
        try {
          await copyFile(file.path, targetPath);
          transferredCount++;
        } catch (e: any) {
          console.error(`[FT] Failed to transfer ${file.name}:`, e.message);
        }
      }
      await postDestinationState(panel, 'metadataUpdated');
      panel.webview.postMessage({ command: 'transferComplete', message: `${transferredCount} file(s) transferred back to source` });
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Transfer failed: ${error.message}`);
  }
}

async function transferFilesWithConfirm(
  sourceFolder: 'source' | 'destination',
  destFolder: 'source' | 'destination',
  files: { name: string; path: string }[]
) {
  const confirmed = await vscode.window.showWarningMessage(
    `Transfer ${files.length} file(s) back to source? Original files will be overwritten.`,
    { modal: true },
    'Yes'
  );
  
  if (confirmed === 'Yes') {
    await transferFiles(sourceFolder, destFolder, files);
  }
}

async function transferFilesWithOverwriteConfirm(
  sourceFolder: 'source' | 'destination',
  destFolder: 'source' | 'destination',
  files: { name: string; path: string }[]
) {
  if (!destFolderPath) {
    vscode.window.showErrorMessage('Select destination folder first.');
    return;
  }

  const collisions: string[] = [];
  for (const file of files) {
    if (!file.path) continue;
    const destinationPath = path.join(destFolderPath, path.basename(file.path));
    if (await fileExists(destinationPath)) {
      collisions.push(path.basename(file.path));
    }
  }

  if (collisions.length > 0) {
    const confirmed = await vscode.window.showWarningMessage(
      `The following file(s) already exist in destination and will be overwritten: ${collisions.join(', ')}`,
      { modal: true },
      'Yes'
    );

    if (confirmed !== 'Yes') {
      return;
    }
  }

  await transferFiles(sourceFolder, destFolder, files);
}

function mapDirEntries(entries: Array<{ name: string; path: string; isDirectory: boolean }>) {
  return entries.map(e => ({ name: e.name, path: e.path, isDirectory: e.isDirectory }));
}

function mapRecursiveEntries(entries: Array<{ name: string; path: string; relativePath: string }>) {
  return entries.map(e => ({ name: e.name, path: e.path, relativePath: e.relativePath }));
}

async function refreshFolder(folderType: 'source' | 'destination') {
  const folderPath = folderType === 'source' ? sourceFolderPath : destFolderPath;
  if (!folderPath || !panel) {
    return;
  }

  if (folderType === 'source') {
    const files = await listDirContents(currentSourceBrowsePath || folderPath);
    panel.webview.postMessage({ command: 'sourceRefreshed', files: mapDirEntries(files) });
  } else {
    await postDestinationState(panel, 'refreshDestinationComplete');
  }
}

async function buildDestinationState(folderPath: string): Promise<{
  metadata: Record<string, string>;
  files: Array<{ name: string; path: string }>;
  diffFlags: Record<string, boolean>;
}> {
  const loadedMetadata = await metadata.loadMetadata(folderPath);
  const files = await listDestinationFiles(folderPath);
  const diffFlags = await computeDiffFlags(files, loadedMetadata);

  currentDestMetadata = loadedMetadata;
  currentDestDiffFlags = diffFlags;

  return {
    metadata: loadedMetadata,
    files,
    diffFlags
  };
}

async function postDestinationState(
  targetPanel: vscode.WebviewPanel,
  command: 'destinationFolderSelected' | 'metadataUpdated' | 'refreshDestinationComplete'
) {
  if (!destFolderPath) {
    return;
  }

  const state = await buildDestinationState(destFolderPath);
  targetPanel.webview.postMessage({
    command,
    path: destFolderPath,
    files: state.files.map(f => ({ name: f.name, path: f.path })),
    metadata: state.metadata,
    diffFlags: state.diffFlags
  });
}

function setupSourceFolderWatcher(folderPath: string | undefined) {
  if (sourceFolderWatcher) {
    sourceFolderWatcher.dispose();
    sourceFolderWatcher = undefined;
  }

  if (!folderPath) {
    return;
  }

  sourceFolderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(folderPath), '**/*'));
  sourceFolderWatcher.onDidCreate(() => scheduleRefresh(true, true));
  sourceFolderWatcher.onDidChange(() => scheduleRefresh(true, true));
  sourceFolderWatcher.onDidDelete(() => scheduleRefresh(true, true));
}

function setupDestFolderWatcher(folderPath: string | undefined) {
  if (destFolderWatcher) {
    destFolderWatcher.dispose();
    destFolderWatcher = undefined;
  }

  if (!folderPath) {
    return;
  }

  destFolderWatcher = vscode.workspace.createFileSystemWatcher(new vscode.RelativePattern(vscode.Uri.file(folderPath), '**/*'));
  destFolderWatcher.onDidCreate(() => scheduleRefresh(false, true));
  destFolderWatcher.onDidChange(() => scheduleRefresh(false, true));
  destFolderWatcher.onDidDelete(() => scheduleRefresh(false, true));
}

function scheduleRefresh(refreshSource: boolean, refreshDestination: boolean) {
  pendingSourceRefresh = pendingSourceRefresh || refreshSource;
  pendingDestRefresh = pendingDestRefresh || refreshDestination;

  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(async () => {
    const doSource = pendingSourceRefresh;
    const doDest = pendingDestRefresh;
    pendingSourceRefresh = false;
    pendingDestRefresh = false;

    if (doSource) {
      await refreshFolder('source');
    }
    if (doDest) {
      await refreshFolder('destination');
    }
  }, 250);
}

async function handleSavedFile(savedFilePath: string) {
  if (!panel) {
    return;
  }

  const inSourceFolder = isPathInsideFolder(savedFilePath, sourceFolderPath);
  const inDestFolder = isPathInsideFolder(savedFilePath, destFolderPath);

  if (!inSourceFolder && !inDestFolder) {
    return;
  }

  scheduleRefresh(inSourceFolder, true);
}

async function refreshDestinationIndicators() {
  if (!panel || !destFolderPath) {
    return;
  }

  await postDestinationState(panel, 'destinationFolderSelected');
}

function normalizePathForCompare(p: string): string {
  const resolved = path.resolve(p);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function isPathInsideFolder(filePath: string, folderPath: string | undefined): boolean {
  if (!folderPath) {
    return false;
  }

  const normalizedFilePath = normalizePathForCompare(filePath);
  const normalizedFolderPath = normalizePathForCompare(folderPath);
  return normalizedFilePath === normalizedFolderPath || normalizedFilePath.startsWith(`${normalizedFolderPath}${path.sep}`);
}

async function deleteFilesInFolder(
  folderPath: string,
  files: { name: string; path: string }[]
) {
  if (!panel) return;

  try {
    for (const file of files) {
      await deleteFile(file.path);
    }

    panel.webview.postMessage({
      command: 'deleteComplete',
      message: `${files.length} file(s) deleted successfully`
    });
  } catch (error: any) {
    vscode.window.showErrorMessage(`Delete failed: ${error.message}`);
  }
}

async function showDiffPanel(selectedFiles: Array<{ name: string; path: string }> = []) {
  if (!destFolderPath) {
    vscode.window.showErrorMessage('Please select a destination folder first');
    return;
  }

  try {
    const destFiles = selectedFiles.length > 0 ? selectedFiles : await listDestinationFiles(destFolderPath);
    const diffCandidates = await computeDiffCandidates(destFiles, currentDestMetadata);

    if (diffCandidates.length === 0) {
      vscode.window.showInformationMessage('No changed files found to diff.');
      return;
    }

    for (const candidate of diffCandidates) {
      await vscode.commands.executeCommand(
        'vscode.diff',
        vscode.Uri.file(candidate.sourcePath),
        vscode.Uri.file(candidate.destPath),
        `Diff: ${candidate.name}`,
        { preview: false, viewColumn: vscode.ViewColumn.Beside }
      );
    }
  } catch (error: any) {
    vscode.window.showErrorMessage(`Failed to open diff: ${error.message}`);
  }
}

async function getSelectedSourcePath(): Promise<string | undefined> {
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    title: 'Select source folder'
  });

  return folderUri?.[0]?.fsPath;
}

async function getSelectedDestPath(): Promise<string | undefined> {
  const folderUri = await vscode.window.showOpenDialog({
    canSelectFolders: true,
    canSelectFiles: false,
    canSelectMany: false,
    title: 'Select destination folder'
  });

  return folderUri?.[0]?.fsPath;
}

export function deactivate() {
  if (sourceFolderWatcher) {
    sourceFolderWatcher.dispose();
    sourceFolderWatcher = undefined;
  }
  if (destFolderWatcher) {
    destFolderWatcher.dispose();
    destFolderWatcher = undefined;
  }
  if (refreshTimer) {
    clearTimeout(refreshTimer);
    refreshTimer = undefined;
  }
  if (panel) {
    panel.dispose();
  }
}
