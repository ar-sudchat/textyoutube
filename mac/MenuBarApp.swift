// GetText AI — menu bar controller.
//
// A real NSApplication, unlike the shell launcher it replaces: the Dock never
// bounces waiting for a launch signal that a script cannot send, and there is a
// permanent, obvious place to start and stop the server from.
//
// __PROJECT_DIR__ and __PORT__ are substituted by build-macapp.sh.
import Cocoa

let projectDir = "__PROJECT_DIR__"
let port = __PORT__
let serverURL = URL(string: "http://127.0.0.1:\(port)/")!
let logPath = NSString(string: "~/Library/Logs/GetTextAI.log").expandingTildeInPath

enum ServerState {
    case stopped, starting, running, settingUp, failed(String)
}

@main
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem!
    private var server: Process?
    private var state: ServerState = .stopped
    private var pollTimer: Timer?
    private var signalSources: [DispatchSourceSignal] = []

    private var pythonPath: String { "\(projectDir)/venv/bin/python" }

    static func main() {
        let app = NSApplication.shared
        let delegate = AppDelegate()
        app.delegate = delegate
        app.setActivationPolicy(.accessory)   // menu bar only, no Dock tile
        app.run()
    }

    // MARK: - Lifecycle

    func applicationDidFinishLaunching(_ notification: Notification) {
        statusItem = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        if let button = statusItem.button {
            button.image = NSImage(systemSymbolName: "play.rectangle.fill",
                                   accessibilityDescription: "GetText AI")
            button.image?.isTemplate = true
        }
        rebuildMenu()
        installSignalHandlers()
        start()

        // The page can stop the server on its own; keep the menu honest about it.
        pollTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            self?.syncState()
        }
    }

    /// Cocoa does not route SIGTERM through applicationWillTerminate, so a `pkill`
    /// or a logout would leave uvicorn orphaned — still holding the port while the
    /// next launch believes a healthy server is already there.
    private func installSignalHandlers() {
        for sig in [SIGTERM, SIGINT, SIGHUP] {
            signal(sig, SIG_IGN)
            let source = DispatchSource.makeSignalSource(signal: sig, queue: .main)
            source.setEventHandler { [weak self] in
                self?.stopServer()
                NSApp.terminate(nil)
            }
            source.resume()
            signalSources.append(source)
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        stopServer()
    }

    // MARK: - Server control

    private func start() {
        guard FileManager.default.isExecutableFile(atPath: pythonPath) else {
            setState(.settingUp)
            DispatchQueue.global().async { [weak self] in
                let ok = self?.createVirtualenv() ?? false
                DispatchQueue.main.async {
                    if ok {
                        self?.launchServer()
                    } else {
                        self?.setState(.failed("Setup failed — see \(logPath)"))
                    }
                }
            }
            return
        }
        launchServer()
    }

    /// First run only: build the venv and install requirements.
    private func createVirtualenv() -> Bool {
        func run(_ launchPath: String, _ args: [String]) -> Bool {
            let task = Process()
            task.executableURL = URL(fileURLWithPath: launchPath)
            task.arguments = args
            task.currentDirectoryURL = URL(fileURLWithPath: projectDir)
            if let handle = FileHandle(forWritingAtPath: logPath) {
                handle.seekToEndOfFile()
                task.standardOutput = handle
                task.standardError = handle
            }
            do {
                try task.run()
                task.waitUntilExit()
                return task.terminationStatus == 0
            } catch {
                return false
            }
        }
        FileManager.default.createFile(atPath: logPath, contents: nil)
        guard run("/usr/bin/env", ["python3", "-m", "venv", "\(projectDir)/venv"]) else { return false }
        return run("\(projectDir)/venv/bin/pip",
                   ["install", "-q", "--disable-pip-version-check", "-r", "\(projectDir)/requirements.txt"])
    }

    private func launchServer() {
        // A server left over from a previous run (or killed parent) is adopted
        // rather than fought with — but still show the page, since launching the
        // app should always end with something on screen.
        guard !isReachable() else {
            setState(.running)
            NSWorkspace.shared.open(serverURL)
            return
        }

        setState(.starting)
        let task = Process()
        task.executableURL = URL(fileURLWithPath: pythonPath)
        task.arguments = ["-m", "uvicorn", "server:app", "--host", "127.0.0.1", "--port", "\(port)"]
        task.currentDirectoryURL = URL(fileURLWithPath: projectDir)

        var env = ProcessInfo.processInfo.environment
        env["GETTEXT_ALLOW_SHUTDOWN"] = "1"
        if env["YOUTUBE_COOKIES_FROM_BROWSER"] == nil {
            env["YOUTUBE_COOKIES_FROM_BROWSER"] = "chrome"
        }
        task.environment = env

        if !FileManager.default.fileExists(atPath: logPath) {
            FileManager.default.createFile(atPath: logPath, contents: nil)
        }
        if let handle = FileHandle(forWritingAtPath: logPath) {
            handle.seekToEndOfFile()
            task.standardOutput = handle
            task.standardError = handle
        }

        do {
            try task.run()
            server = task
        } catch {
            setState(.failed("Could not start the server"))
            return
        }

        waitUntilReachable(attempts: 60) { [weak self] ok in
            guard let self else { return }
            if ok {
                self.setState(.running)
                NSWorkspace.shared.open(serverURL)
            } else {
                self.setState(.failed("Server did not start — see \(logPath)"))
            }
        }
    }

    private func stopServer() {
        pollTimer?.invalidate()
        if let server, server.isRunning {
            server.terminate()
            // Give uvicorn a moment to shut down before the app disappears.
            let deadline = Date().addingTimeInterval(3)
            while server.isRunning && Date() < deadline {
                usleep(100_000)
            }
        }
        server = nil
    }

    // MARK: - Health

    private func isReachable() -> Bool {
        guard let url = URL(string: "http://127.0.0.1:\(port)/api/health") else { return false }
        var request = URLRequest(url: url)
        request.timeoutInterval = 1.5
        var reachable = false
        let semaphore = DispatchSemaphore(value: 0)
        URLSession.shared.dataTask(with: request) { data, response, _ in
            if let http = response as? HTTPURLResponse, http.statusCode == 200, data != nil {
                reachable = true
            }
            semaphore.signal()
        }.resume()
        _ = semaphore.wait(timeout: .now() + 2)
        return reachable
    }

    private func waitUntilReachable(attempts: Int, completion: @escaping (Bool) -> Void) {
        DispatchQueue.global().async { [weak self] in
            for _ in 0..<attempts {
                if self?.isReachable() == true {
                    DispatchQueue.main.async { completion(true) }
                    return
                }
                usleep(250_000)
            }
            DispatchQueue.main.async { completion(false) }
        }
    }

    private func syncState() {
        switch state {
        case .starting, .settingUp:
            return                      // a transition is already in flight
        default:
            setState(isReachable() ? .running : .stopped)
        }
    }

    // MARK: - Menu

    private func setState(_ newState: ServerState) {
        state = newState
        rebuildMenu()
    }

    private func rebuildMenu() {
        let menu = NSMenu()

        let title: String
        switch state {
        case .stopped:    title = "GetText AI — Stopped"
        case .starting:   title = "GetText AI — Starting…"
        case .settingUp:  title = "GetText AI — Setting up…"
        case .running:    title = "GetText AI — Running on \(port)"
        case .failed(let why): title = why
        }
        let header = NSMenuItem(title: title, action: nil, keyEquivalent: "")
        header.isEnabled = false
        menu.addItem(header)
        menu.addItem(.separator())

        switch state {
        case .running:
            menu.addItem(item("Open in Browser", #selector(openBrowser), "o"))
            menu.addItem(item("Restart Server", #selector(restart), "r"))
        case .stopped, .failed:
            menu.addItem(item("Start GetText AI", #selector(startFromMenu), "o"))
        case .starting, .settingUp:
            break
        }

        menu.addItem(.separator())
        menu.addItem(item("Open Log", #selector(openLog), ""))
        menu.addItem(.separator())
        menu.addItem(item("Quit", #selector(quit), "q"))

        statusItem.menu = menu
    }

    private func item(_ title: String, _ action: Selector, _ key: String) -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: key)
        menuItem.target = self
        return menuItem
    }

    // MARK: - Actions

    @objc private func openBrowser() {
        NSWorkspace.shared.open(serverURL)
    }

    @objc private func startFromMenu() {
        start()
    }

    @objc private func restart() {
        stopServer()
        pollTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            self?.syncState()
        }
        launchServer()
    }

    @objc private func openLog() {
        NSWorkspace.shared.open(URL(fileURLWithPath: logPath))
    }

    @objc private func quit() {
        stopServer()
        NSApp.terminate(nil)
    }
}
