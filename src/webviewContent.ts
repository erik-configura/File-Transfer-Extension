export function getWebviewContent(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>File Transfer</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }

    .container {
      display: flex;
      gap: 20px;
      height: 100vh;
      padding: 20px;
    }

    .pane {
      flex: 1;
      display: flex;
      flex-direction: column;
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      overflow: hidden;
      background-color: var(--vscode-editor-background);
    }

    .pane-header {
      padding: 12px;
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-input-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .pane-title {
      font-weight: bold;
      font-size: 14px;
    }

    .pane-path {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-top: 4px;
      word-break: break-all;
    }

    .open-folder-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
    }

    .open-folder-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .file-list {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      list-style: none;
    }

    .file-item {
      padding: 8px;
      margin: 4px 0;
      border-radius: 2px;
      cursor: pointer;
      background-color: var(--vscode-editor-background);
      border: 1px solid transparent;
      display: flex;
      align-items: center;
      gap: 8px;
      user-select: none;
    }

    .file-item:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .file-item.selected {
      background-color: var(--vscode-list-activeSelectionBackground);
      color: var(--vscode-list-activeSelectionForeground);
    }

    .file-item .subpath {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-left: 8px;
      white-space: nowrap;
      opacity: 0.8;
    }

    .file-icon {
      width: 16px;
      height: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
    }

    .file-name {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 13px;
    }

    .diff-indicator {
      font-size: 11px;
      line-height: 1;
      border: 1px solid var(--vscode-charts-red);
      color: var(--vscode-charts-red);
      border-radius: 999px;
      padding: 2px 6px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .center-controls {
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 12px;
      padding: 0 10px;
      min-width: 60px;
    }

    .transfer-btn {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 8px 12px;
      border-radius: 2px;
      cursor: pointer;
      font-size: 12px;
      font-weight: bold;
      min-width: 45px;
    }

    .transfer-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .transfer-btn:disabled {
      background-color: var(--vscode-button-secondaryBackground);
      cursor: not-allowed;
      opacity: 0.5;
    }

    .status-message {
      padding: 8px;
      margin-top: 8px;
      border-radius: 2px;
      font-size: 12px;
      color: var(--vscode-notificationCenter-border);
    }

    .status-message.success {
      background-color: rgba(87, 166, 74, 0.3);
      color: var(--vscode-testing-message-success-foreground);
    }

    .status-message.error {
      background-color: rgba(245, 75, 75, 0.3);
      color: var(--vscode-errorForeground);
    }

    .empty-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      font-size: 13px;
      text-align: center;
      padding: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Source Pane -->
    <div class="pane">
      <div class="pane-header">
        <div>
          <div class="pane-title">Source</div>
          <div style="display:flex;gap:8px;align-items:center;flex-direction:column;">
            <div class="pane-path" id="sourcePath">No folder selected</div>
            <div style="display:flex;gap:6px;align-items:center;">
              <button class="open-folder-btn" onclick="navigateUp()" id="upBtn" title="Up">⬆</button>
              <button class="open-folder-btn" onclick="refreshSource()" id="refreshBtn" title="Refresh">⟳</button>
            </div>
          </div>
        </div>
        <button class="open-folder-btn" onclick="selectSourceFolder()">Open Folder</button>
      </div>
      <ul class="file-list" id="sourceList">
        <div class="empty-state">Select a source folder to begin</div>
      </ul>
    </div>

    <!-- Center Controls -->
    <div class="center-controls">
      <button class="transfer-btn" title="Transfer to destination" onclick="transferToDestination()">→</button>
      <button class="transfer-btn" title="Transfer to source" onclick="transferToSource()">←</button>
      <button class="transfer-btn" title="Show file differences" onclick="showDiff()" style="margin-top: 8px;">◬</button>
    </div>

    <!-- Destination Pane -->
    <div class="pane">
      <div class="pane-header">
        <div>
          <div class="pane-title">Destination</div>
          <div class="pane-path" id="destPath">No folder selected</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <button class="open-folder-btn" onclick="refreshDestination()" id="destRefreshBtn" title="Refresh">⟳</button>
          <button class="open-folder-btn" onclick="selectDestFolder()">Open Folder</button>
        </div>
      </div>
      <ul class="file-list" id="destList">
        <div class="empty-state">Select a destination folder to begin</div>
      </ul>
    </div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    
    let sourceFolderPath = '';
    let destFolderPath = '';
    let currentSourceBrowsePath = '';
    let sourceFiles = [];
    let destFiles = [];
    let selectedSourceFiles = [];
    let selectedDestFiles = [];
    let destMetadata = {}; // destName -> originalPath
    let destDiffFlags = {}; // destName -> true when different from referenced source

    function selectSourceFolder() {
      vscode.postMessage({ command: 'selectSourceFolder' });
    }

    function refreshSource() {
      if (!sourceFolderPath) { showMessage('No source folder selected', 'error'); return; }
      vscode.postMessage({ command: 'refreshSource' });
    }

    function navigateUp() {
      if (!sourceFolderPath) { return; }
      vscode.postMessage({ command: 'navigateUp' });
    }

    function enterDirectory(index) {
      const file = sourceFiles[index];
      if (!file || !file.isDirectory) {
        return;
      }
      vscode.postMessage({ command: 'enterDirectory', path: file.path });
    }

    function refreshDestination() {
      if (!destFolderPath) { showMessage('No destination folder selected', 'error'); return; }
      vscode.postMessage({ command: 'refreshDestination' });
    }

    function selectDestFolder() {
      vscode.postMessage({ command: 'selectDestFolder' });
    }

    function transferToDestination() {
      if (selectedSourceFiles.length === 0) {
        showMessage('Select files to transfer', 'error');
        return;
      }
      vscode.postMessage({
        command: 'transferToDestination',
        files: selectedSourceFiles
      });
      selectedSourceFiles = [];
      updateSourceUI();
    }

    function transferToSource() {
      if (selectedDestFiles.length === 0) {
        showMessage('Select files to transfer', 'error');
        return;
      }
      vscode.postMessage({
        command: 'transferToSource',
        files: selectedDestFiles
      });
    }

    function showDiff() {
      vscode.postMessage({ command: 'showDiff', files: selectedDestFiles });
    }

    function toggleSourceFileSelection(index) {
      const file = sourceFiles[index];
      const idx = selectedSourceFiles.findIndex(f => f.path === file.path);
      
      if (idx > -1) {
        selectedSourceFiles.splice(idx, 1);
      } else {
        selectedSourceFiles.push(file);
      }
      
      updateSourceUI();
    }

    function toggleDestFileSelection(index) {
      const file = destFiles[index];
      const idx = selectedDestFiles.findIndex(f => f.path === file.path);
      
      if (idx > -1) {
        selectedDestFiles.splice(idx, 1);
      } else {
        selectedDestFiles.push(file);
      }
      
      updateDestUI();
    }

    function updateSourceUI() {
      const list = document.getElementById('sourceList');
      if (sourceFiles.length === 0) {
        list.innerHTML = '<div class="empty-state">No files in this folder</div>';
        return;
      }
      
      list.innerHTML = sourceFiles.map(function(file, index) {
        const isSelected = selectedSourceFiles.some(f => f.path === file.path);
        const icon = file.isDirectory ? '📁' : '📄';
        var parts = [];
        parts.push('<li class="file-item ' + (isSelected ? 'selected' : '') + '" data-index="' + index + '" data-is-directory="' + file.isDirectory + '">');
        parts.push('<span class="file-icon">' + icon + '</span>');
        parts.push('<span class="file-name">' + file.name + '</span>');
        if (!file.isDirectory) {
          parts.push('<span class="subpath">' + (file.relativePath || '') + '</span>');
        }
        parts.push('</li>');
        return parts.join('');
      }).join('');

      attachSourceItemHandlers();
    }

    function updateDestUI() {
      const list = document.getElementById('destList');
      if (destFiles.length === 0) {
        list.innerHTML = '<div class="empty-state">No files in this folder</div>';
        return;
      }
      
      list.innerHTML = destFiles.map(function(file, index) {
        const isSelected = selectedDestFiles.some(f => f.path === file.path);
        const orig = destMetadata[file.name] || file.path;
        const isDifferent = !!destDiffFlags[file.name];
        var parts = [];
        parts.push('<li class="file-item ' + (isSelected ? 'selected' : '') + '" data-index="' + index + '" title="' + orig + (isDifferent ? ' (Different from source)' : '') + '">');
        parts.push('<span class="file-icon">📄</span>');
        parts.push('<span class="file-name">' + file.name + '</span>');
        if (isDifferent) {
          parts.push('<span class="diff-indicator" title="Different from referenced source">DIFF</span>');
        }
        parts.push('</li>');
        return parts.join('');
      }).join('');

      attachDestItemHandlers();
    }

    function attachSourceItemHandlers() {
      const list = document.getElementById('sourceList');
      const items = list.querySelectorAll('.file-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const index = Number(item.getAttribute('data-index'));
          const file = sourceFiles[index];
          if (!file) {
            return;
          }
          if (item.getAttribute('data-is-directory') === 'true') {
            enterDirectory(index);
          } else {
            toggleSourceFileSelection(index);
          }
        });
      });
    }

    function attachDestItemHandlers() {
      const list = document.getElementById('destList');
      const items = list.querySelectorAll('.file-item');
      items.forEach(item => {
        item.addEventListener('click', () => {
          const index = Number(item.getAttribute('data-index'));
          toggleDestFileSelection(index);
        });
      });
    }

    function showMessage(message, type) {
      console.log(message);
      // Messages are shown via VS Code notifications
    }

    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'sourceFolderSelected':
          sourceFolderPath = message.path;
          currentSourceBrowsePath = message.browsePath || message.path;
          sourceFiles = message.files || [];
          selectedSourceFiles = [];
          document.getElementById('sourcePath').textContent = currentSourceBrowsePath;
          updateSourceUI();
          break;
          
        case 'destinationFolderSelected':
          destFolderPath = message.path;
          destFiles = message.files || [];
          destMetadata = message.metadata || {};
          destDiffFlags = message.diffFlags || {};
          selectedDestFiles = [];
          document.getElementById('destPath').textContent = destFolderPath;
          updateDestUI();
          break;
          
        case 'refreshDestinationComplete':
          destFiles = message.files || [];
          destMetadata = message.metadata || destMetadata;
          destDiffFlags = message.diffFlags || {};
          updateDestUI();
          break;
          
        case 'sourceRefreshed':
          sourceFiles = message.files || [];
          updateSourceUI();
          break;

        case 'enteredDirectory':
          currentSourceBrowsePath = message.path;
          sourceFiles = message.files || [];
          document.getElementById('sourcePath').textContent = currentSourceBrowsePath;
          selectedSourceFiles = [];
          updateSourceUI();
          break;

        case 'metadataUpdated':
          destMetadata = message.metadata || {};
          destFiles = message.files || [];
          destDiffFlags = message.diffFlags || {};
          updateDestUI();
          break;

        case 'destinationIndicatorsUpdated':
          destDiffFlags = message.diffFlags || {};
          updateDestUI();
          break;
          
        case 'transferComplete':
          showMessage(message.message, 'success');
          selectedSourceFiles = [];
          selectedDestFiles = [];
          updateSourceUI();
          updateDestUI();
          break;
      }
    });

    window.addEventListener('load', () => {
      vscode.postMessage({ command: 'requestInitialState' });
    });
  </script>
</body>
</html>`;
}
