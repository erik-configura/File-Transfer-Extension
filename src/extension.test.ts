jest.mock('./webviewContent', () => ({
  getWebviewContent: () => '<html></html>'
}));

jest.mock('./metadataManager', () => ({
  loadMetadata: jest.fn(async () => ({})),
  saveMetadata: jest.fn(async () => undefined),
  updateMetadata: jest.fn(async () => undefined),
  removeMetadataEntry: jest.fn(async () => undefined)
}));

jest.mock('./diffSelector', () => ({
  computeDiffCandidates: jest.fn(async () => []),
  computeDiffFlags: jest.fn(async () => ({}))
}));

jest.mock('./fileManager', () => ({
  listDestinationFiles: jest.fn(async () => []),
  copyFile: jest.fn(async () => undefined),
  deleteFile: jest.fn(async () => undefined),
  listDirContents: jest.fn(async () => []),
  copyFileToDir: jest.fn(async () => 'copied.txt'),
  fileExists: jest.fn(async () => false),
  moveFile: jest.fn(async () => undefined)
}));

type WatcherCallbacks = {
  create?: () => void;
  change?: () => void;
  del?: () => void;
};

type MockWatcher = {
  callbacks: WatcherCallbacks;
  onDidCreate: (cb: () => void) => void;
  onDidChange: (cb: () => void) => void;
  onDidDelete: (cb: () => void) => void;
  dispose: () => void;
};

let registeredOpenPanel: (() => void) | undefined;
let panelMessageHandler: ((message: any) => Promise<void>) | undefined;
let panelPostMessage: jest.Mock;
let watchers: MockWatcher[];

(jest as any).mock('vscode', () => {
  watchers = [];
  panelPostMessage = jest.fn();

  const mkWatcher = (): MockWatcher => {
    const callbacks: WatcherCallbacks = {};
    return {
      callbacks,
      onDidCreate: (cb: () => void) => {
        callbacks.create = cb;
      },
      onDidChange: (cb: () => void) => {
        callbacks.change = cb;
      },
      onDidDelete: (cb: () => void) => {
        callbacks.del = cb;
      },
      dispose: jest.fn()
    };
  };

  return {
    commands: {
      registerCommand: jest.fn((_command: string, cb: () => void) => {
        registeredOpenPanel = cb;
        return { dispose: jest.fn() };
      }),
      executeCommand: jest.fn(async () => undefined)
    },
    window: {
      createWebviewPanel: jest.fn(() => ({
        webview: {
          html: '',
          options: {},
          onDidReceiveMessage: jest.fn((cb: (message: any) => Promise<void>) => {
            panelMessageHandler = cb;
            return { dispose: jest.fn() };
          }),
          postMessage: panelPostMessage
        },
        reveal: jest.fn(),
        onDidDispose: jest.fn()
      })),
      showOpenDialog: jest.fn(async () => []),
      showWarningMessage: jest.fn(async () => 'Yes'),
      showErrorMessage: jest.fn(),
      registerWebviewPanelSerializer: undefined,
      ViewColumn: { One: 1 }
    },
    workspace: {
      workspaceFolders: [{ uri: { fsPath: 'C:/dest' } }],
      createFileSystemWatcher: jest.fn(() => {
        const watcher = mkWatcher();
        watchers.push(watcher);
        return watcher;
      }),
      onDidSaveTextDocument: jest.fn(() => ({ dispose: jest.fn() }))
    },
    RelativePattern: class {
      constructor(_baseUri: any, _pattern: string) {}
    },
    Uri: {
      file: (fsPath: string) => ({ fsPath })
    },
    ViewColumn: { One: 1 }
  };
}, { virtual: true });

const extension = require('./extension') as typeof import('./extension');
const fileManager = require('./fileManager') as typeof import('./fileManager');

function createContext() {
  const state: Record<string, string | undefined> = {
    'fileTransfer.sourceFolderPath': 'C:/source',
    'fileTransfer.currentSourceBrowsePath': 'C:/source',
    'fileTransfer.destFolderPath': 'C:/dest'
  };

  return {
    subscriptions: [] as Array<{ dispose?: () => void }>,
    workspaceState: {
      get: jest.fn((key: string) => state[key]),
      update: jest.fn(async (key: string, value: string | undefined) => {
        state[key] = value;
      })
    }
  };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('extension watcher refresh', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    registeredOpenPanel = undefined;
    panelMessageHandler = undefined;
    watchers = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('updates UI messages when new files are created in source and destination folders', async () => {
    const listDirContentsMock = fileManager.listDirContents as jest.MockedFunction<typeof fileManager.listDirContents>;
    listDirContentsMock
      .mockResolvedValueOnce([{ name: 'initial.txt', path: 'C:/source/initial.txt', isDirectory: false }])
      .mockResolvedValueOnce([{ name: 'new.txt', path: 'C:/source/new.txt', isDirectory: false }]);

    const context = createContext();
    extension.activate(context as any);
    expect(registeredOpenPanel).toBeDefined();

    registeredOpenPanel!();
    expect(panelMessageHandler).toBeDefined();

    await panelMessageHandler!({ command: 'requestInitialState' });
    panelPostMessage.mockClear();

    const sourceWatcher = watchers[0];
    expect(sourceWatcher).toBeDefined();

    sourceWatcher.callbacks.create!();
    jest.advanceTimersByTime(300);
    await flushAsync();

    expect(panelPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        command: 'sourceRefreshed',
        files: [{ name: 'new.txt', path: 'C:/source/new.txt', isDirectory: false }]
      })
    );
    panelPostMessage.mockClear();

    const destWatcher = watchers[1];
    expect(destWatcher).toBeDefined();

    destWatcher.callbacks.create!();
    jest.advanceTimersByTime(300);
    await flushAsync();

    expect(panelPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({ command: 'refreshDestinationComplete' })
    );
  });
});
