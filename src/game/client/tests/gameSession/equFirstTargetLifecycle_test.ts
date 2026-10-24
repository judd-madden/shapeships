import { spawn, type ChildProcess } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createServer as createPortServer } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, loadConfigFromFile, type PluginOption, type ViteDevServer } from 'vite';
import { equBrowserEntry, loadEquCapture } from './fixtures/equFirstTargetReplay';
import { instrumentEquSource } from './helpers/equFirstTargetDiagnostics';

const enabled = process.env.EQU_BROWSER_REPLAY === '1';
const artifacts = path.resolve('tmp/maximum-update-depth');
const edge = process.env.EQU_EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sourceRoot = process.env.EQU_SOURCE_ROOT ? path.resolve(process.env.EQU_SOURCE_ROOT) : process.cwd();
const sourcePrefix = sourceRoot === process.cwd() ? '/src' : '/@fs/' + sourceRoot.replace(/\\/g, '/') + '/src';
const sourceLabel = process.env.EQU_SOURCE_LABEL ?? 'checkout';

class Browser {
  process!: ChildProcess;
  socket!: WebSocket;
  serial = 0;
  logs: any[] = [];
  pending = new Map<number, {resolve: (value: any) => void; reject: (error: Error) => void}>();
  async start(profile: string) {
    const profilePath = path.join(artifacts, 'profiles', profile + '-' + Date.now());
    await mkdir(profilePath, {recursive: true});
    this.process = spawn(edge, ['--headless=new', '--guest', '--disable-sync', '--disable-background-networking',
      '--disable-extensions', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--remote-debugging-port=0', '--user-data-dir=' + profilePath, 'about:blank'], {windowsHide: true, stdio: ['ignore', 'ignore', 'pipe']});
    this.process.stderr?.on('data', data => this.logs.push({stderr: String(data)}));
    this.process.on('error', error => this.logs.push({spawnError: String(error)}));
    const activePort = path.join(profilePath, 'DevToolsActivePort');
    let port = '';
    for (let attempt = 0; attempt < 150; attempt++) {
      try { port = (await readFile(activePort, 'utf8')).split('\n')[0]; break; } catch { await delay(100); }
    }
    if (!port) throw new Error('Edge did not expose a debugging port');
    const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`, {signal: AbortSignal.timeout(5000)})).json() as any[];
    const target = targets.find(target => target.type === 'page' && target.url === 'about:blank') ??
      await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
    await this.connect(target.webSocketDebuggerUrl);
    await this.call('Runtime.enable');
    await this.call('Page.enable');
  }
  async connect(url: string) {
    this.socket = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      this.socket.addEventListener('open', () => resolve(), {once: true});
      this.socket.addEventListener('error', (event: any) => {
        this.logs.push({webSocketError: String(event.error ?? event.message ?? 'connection failed'), url});
        reject(new Error('Browser WebSocket failed: ' + url));
      }, {once: true});
    });
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data));
      if (message.method === 'Runtime.exceptionThrown' || message.method === 'Runtime.consoleAPICalled') this.logs.push(message);
      const pending = this.pending.get(message.id);
      if (pending) {
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
      }
    });
    this.socket.addEventListener('close', () => {
      for (const pending of this.pending.values()) pending.reject(new Error('Edge debugging connection closed'));
      this.pending.clear();
    });
  }
  call(method: string, params: any = {}): Promise<any> {
    if (this.socket?.readyState !== WebSocket.OPEN) return Promise.reject(new Error('Edge is disconnected'));
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 10000);
      this.pending.set(id, {resolve: value => { clearTimeout(timeout); resolve(value); },
        reject: error => { clearTimeout(timeout); reject(error); }});
      this.socket.send(JSON.stringify({id, method, params}));
    });
  }
  async evaluate(expression: string) {
    const reply = await this.call('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
    if (reply.exceptionDetails) throw new Error(reply.exceptionDetails.exception?.description ?? reply.exceptionDetails.text);
    return reply.result?.value;
  }
  async until(expression: string) {
    for (let attempt = 0; attempt < 200; attempt++) {
      try {
        const errors = await this.evaluate('globalThis.__equDiagnostic?.errors');
        if (errors?.length) throw new Error(errors[0]);
        if (await this.evaluate(expression)) return;
      } catch (error) {
        if (!/navigated|context was destroyed|Cannot find context/.test(String(error))) throw error;
      }
      await delay(100);
    }
    throw new Error('Browser condition timed out: ' + expression);
  }
  async close() {
    try { if (this.socket?.readyState === WebSocket.OPEN) await this.call('Browser.close'); } catch { /* already closed */ }
    this.socket?.close();
    this.process?.kill();
  }
}

/** Installed Firefox speaks WebDriver BiDi directly; no extra driver package. */
class FirefoxBrowser extends Browser {
  context = '';
  override async start(profile: string) {
    const profilePath = path.join(artifacts, 'profiles', profile + '-' + Date.now());
    await mkdir(profilePath, {recursive: true});
    // BiDi's adapter has no media override; set the actual Firefox preference.
    await writeFile(path.join(profilePath, 'user.js'),
      `user_pref("ui.prefersReducedMotion", ${process.env.EQU_REDUCED_MOTION === '1' ? 1 : 0});\n`);
    const listener = createPortServer();
    await new Promise<void>(resolve => listener.listen(0, '127.0.0.1', resolve));
    const port = (listener.address() as {port: number}).port;
    await new Promise<void>(resolve => listener.close(() => resolve()));
    this.process = spawn(process.env.EQU_FIREFOX_PATH ?? 'C:/Program Files/Mozilla Firefox/firefox.exe',
      ['--headless', '--no-remote', '--profile', profilePath, '--remote-debugging-port=' + port],
      {windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
    this.process.stdout?.on('data', data => this.logs.push({stderr: String(data)}));
    this.process.stderr?.on('data', data => this.logs.push({stderr: String(data)}));
    this.process.on('error', error => this.logs.push({spawnError: String(error)}));
    for (let attempt = 0; attempt < 300; attempt++) {
      if (this.logs.some(log => log.stderr?.includes('WebDriver BiDi listening'))) break;
      await delay(100);
    }
    await this.connect(`ws://127.0.0.1:${port}/session`);
    await super.call('session.new', {capabilities: {alwaysMatch: {}}});
    this.context = (await super.call('browsingContext.create', {type: 'tab'})).context;
  }
  override call(method: string, params: any = {}): Promise<any> {
    if (method === 'Emulation.setDeviceMetricsOverride') return super.call('browsingContext.setViewport',
      {context: this.context, viewport: {width: params.width, height: params.height}, devicePixelRatio: 1});
    if (method === 'Emulation.setTouchEmulationEnabled' || method === 'Emulation.setEmulatedMedia') return Promise.resolve({});
    if (method === 'Page.navigate') return super.call('browsingContext.navigate', {context: this.context, url: params.url, wait: 'complete'});
    if (method === 'Input.dispatchMouseEvent') {
      const action = params.type === 'mouseMoved' ? {type: 'pointerMove', x: Math.round(params.x), y: Math.round(params.y), duration: 0}
        : {type: params.type === 'mousePressed' ? 'pointerDown' : 'pointerUp', button: 0};
      return super.call('input.performActions', {context: this.context,
        actions: [{type: 'pointer', id: 'mouse', parameters: {pointerType: 'mouse'}, actions: [action]}]});
    }
    if (method === 'Browser.close') return super.call('browser.close');
    return super.call(method, params);
  }
  override async evaluate(expression: string) {
    const reply = await super.call('script.evaluate', {expression: `(async () => JSON.stringify(await (${expression})))()`,
      target: {context: this.context}, awaitPromise: true});
    if (reply.type === 'exception') throw new Error(reply.exceptionDetails.text);
    return reply.result?.type === 'string' ? JSON.parse(reply.result.value) : undefined;
  }
}
function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

describe.skipIf(!enabled)('EQU captured first-target actual React investigation', () => {
  let server: ViteDevServer;
  let origin: string;
  beforeAll(async () => {
    const capture = await loadEquCapture();
    const builtCss = (await readdir(path.resolve('build/assets'))).find(name => name.endsWith('.css'));
    if (!builtCss) throw new Error('Run npm run build to supply production CSS for the browser replay');
    const stylesheet = await readFile(path.resolve('build/assets', builtCss), 'utf8');
    await mkdir(artifacts, {recursive: true});
    const loaded = await loadConfigFromFile({command: 'serve', mode: 'development'});
    if (!loaded) throw new Error('Repository Vite configuration unavailable');
    // Reuse aliases and React transform. CSS is the existing build artifact, so the
    // investigation server does not need Tailwind's workspace-scanning plugin.
    const basePlugins = (loaded.config.plugins as any[]).flat(Infinity)
      .filter(plugin => plugin && !plugin.name?.includes('tailwindcss')) as PluginOption[];
    server = await createServer({
      ...loaded.config, configFile: false,
      resolve: {...loaded.config.resolve, dedupe: ['react', 'react-dom'],
        alias: Object.fromEntries(Object.entries(loaded.config.resolve?.alias ?? {}).map(([key, value]) =>
          [key, typeof value === 'string' && value.startsWith(path.resolve('src'))
            ? path.join(sourceRoot, 'src', path.relative(path.resolve('src'), value)) : value]))},
      optimizeDeps: {entries: [path.join(sourceRoot, 'src/game/display/GameScreen.tsx')],
        include: ['react', 'react-dom', 'react-dom/client', 'typescript', 'clsx', 'tailwind-merge',
          '@radix-ui/react-slot', '@radix-ui/react-separator', 'class-variance-authority',
          '@supabase/supabase-js', 'next-themes', 'sonner', 'lucide-react']},
      server: {host: '127.0.0.1', port: 0, open: false,
        watch: {ignored: ['**/tmp/maximum-update-depth/**']}},
      plugins: [...basePlugins, {name: 'equ-investigation-only', enforce: 'pre',
        resolveId(id) { if (id === '/__equ/entry') return '\0equ-entry'; },
        load(id) {
          if (id === '\0equ-entry') return equBrowserEntry(sourcePrefix);
        },
        transform(code, id) {
          const file = id.split('?')[0].replace(/\\/g, '/');
          if (['/useGameSession.ts', '/gameSession/destroyTargeting.ts', '/FleetArea.tsx',
            '/useSessionHealthBarPresentation.ts', '/useEndOfTurnPresentation.ts',
            '/GameScreen.tsx', '/MobileGameLayout.tsx', '/useBoardStatHover.tsx'].some(suffix => file.endsWith(suffix))) {
            return {code: instrumentEquSource(code, file, process.env.EQU_STATS_GUARD === '1', process.env.EQU_DETAILED === '1', process.env.EQU_DRAFT_GUARD === '1'), map: null};
          }
        },
        configureServer(vite) {
          vite.middlewares.use(async (request, response, next) => {
            if (request.url === '/__equ/styles') {
              response.setHeader('Content-Type', 'text/css'); response.end(stylesheet); return;
            }
            if (request.url?.startsWith('/__equ/capture')) {
              response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(capture)); return;
            }
            if (request.url?.startsWith('/__equ/entry')) { next(); return; }
            if (request.url?.startsWith('/__equ/')) {
              response.setHeader('Content-Type', 'text/html');
              response.end(await vite.transformIndexHtml('/__equ/', '<meta name="viewport" content="width=device-width, initial-scale=1.0"><link rel="stylesheet" href="/__equ/styles"><div id="root" style="height:100vh"></div><script type="module" src="/__equ/entry"></script>'));
              return;
            }
            next();
          });
        },
      }],
    });
    await server.listen();
    await server.environments.client.depsOptimizer?.scanProcessing;
    const address = server.httpServer!.address() as {port: number};
    origin = `http://127.0.0.1:${address.port}`;
  }, 30000);
  afterAll(async () => { await server?.close(); });

  it('scheduling mechanism: isolates identical-state dispatch starvation and its guard', async () => {
    const browserName = process.env.EQU_BROWSER ?? 'edge';
    const browser = browserName === 'firefox' ? new FirefoxBrowser() : new Browser();
    const label = sourceLabel + '-scheduler-' + browserName + '-guard' + (process.env.EQU_STATS_GUARD ?? '0');
    try {
      await browser.start(label);
      await browser.call('Page.navigate', {url: `${origin}/__equ/?probe=scheduling&guard=${process.env.EQU_STATS_GUARD === '1'}`});
      await browser.until('!!globalThis.__equDiagnostic?.triggerScheduling');
      try { await browser.evaluate('globalThis.__equDiagnostic.triggerScheduling()'); }
      catch (error) { await browser.evaluate(`globalThis.__equDiagnostic.errors.push(${JSON.stringify(String(error))})`); }
      await delay(150);
      const result = await browser.evaluate('globalThis.__equDiagnostic.export()');
      const guarded = process.env.EQU_STATS_GUARD === '1';
      expect(result.errors.some((error: string) => error.includes('Maximum update depth')),
        'This reduced causal experiment deliberately retains the original dispatch pattern when unguarded').toBe(!guarded);
      expect(result.events.filter((event: any) => event.kind === 'updater.scheduler.stats' && event.value.changed)).toEqual([]);
      const commits = result.events.filter((event: any) => event.kind === 'scheduler.commit').length;
      if (guarded) expect(commits).toBeLessThan(10);
      else expect(commits).toBeGreaterThan(40);
    } finally {
      try { await writeFile(path.join(artifacts, label + '.json'), JSON.stringify(await browser.evaluate('globalThis.__equDiagnostic?.export()'), null, 2)); } catch { /* startup failure */ }
      await browser.close();
    }
  }, 30000);

  for (const side of ['my', 'opponent']) for (const scenario of [
    {preview: 'received', staleRefresh: false},
    {preview: 'pending', staleRefresh: false},
    {preview: 'received', staleRefresh: true},
  ]) {
    const {preview, staleRefresh} = scenario;
    it(`${side} target first, WIS preview ${preview}: ${staleRefresh ? 'reconciles a stale selected target after authoritative refresh' : 'retains an incomplete pair without an update loop'}`, async () => {
      const browserName = process.env.EQU_BROWSER ?? 'edge';
      const browser = browserName === 'firefox' ? new FirefoxBrowser() : new Browser();
      const lifecycle = process.env.EQU_LIFECYCLE ?? 'direct';
      const layout = process.env.EQU_LAYOUT ?? 'mobile';
      const input = process.env.EQU_INPUT ?? 'overlap';
      const label = `${sourceLabel}-${browserName}-${lifecycle}-${layout}-${input}-${process.env.EQU_PROBE === '1' ? 'probe' : 'screen'}-strict${process.env.EQU_STRICT ?? '0'}-motion${process.env.EQU_REDUCED_MOTION ?? '0'}-guard${process.env.EQU_STATS_GUARD ?? '0'}-draft${process.env.EQU_DRAFT_GUARD ?? '0'}-${side}-${preview}${staleRefresh ? '-stale-refresh' : ''}`;
      try {
        await browser.start(label);
        const mobile = layout === 'mobile';
        await browser.call('Emulation.setDeviceMetricsOverride', {width: mobile ? 375 : 1280, height: mobile ? 667 : 900, deviceScaleFactor: 1, mobile});
        await browser.call('Emulation.setTouchEmulationEnabled', {enabled: mobile});
        await browser.call('Emulation.setEmulatedMedia', {features: [{name: 'prefers-reduced-motion', value: process.env.EQU_REDUCED_MOTION === '1' ? 'reduce' : 'no-preference'}]});
        await browser.call('Page.navigate', {url: `${origin}/__equ/?preview=${preview}&lifecycle=${lifecycle}&strict=${process.env.EQU_STRICT === '1'}&probe=${process.env.EQU_PROBE === '1'}`});
        await browser.until('globalThis.__equDiagnostic?.ready && !!globalThis.__equDiagnostic.session && !globalThis.__equDiagnostic.session.vm.isBootstrapping');
        expect(await browser.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches"),
          'browser applies the requested motion preference').toBe(process.env.EQU_REDUCED_MOTION === '1');
        await browser.evaluate(`globalThis.__equDiagnostic.emit('validation.source', ${JSON.stringify({sourceRoot,
          draftGuard: process.env.EQU_DRAFT_GUARD ?? null, statsGuard: process.env.EQU_STATS_GUARD ?? null})})`);
        if (lifecycle === 'turn4') await browser.evaluate('globalThis.__equDiagnostic.replayTurn4()');
        if (preview === 'received') await browser.until("globalThis.__equDiagnostic.events.filter(e => e.kind === 'session.render').at(-1)?.value.preview.kind === 'estimated'");
        else await browser.until("globalThis.__equDiagnostic.events.filter(e => e.kind === 'session.render').at(-1)?.value.preview.kind === 'pending' && globalThis.__equDiagnostic.events.some(e => e.kind === 'network.request' && e.value.route.includes('/charge-declaration-preview/'))");
        await delay(150);
        expect(await browser.evaluate('globalThis.__equDiagnostic.errors')).toEqual([]);
        const requestFilter = "e => e.kind === 'network.request' && /\\/(charge-declaration-preview|intent)\\//.test(e.value.route)";
        const requestsBeforeChoice = await browser.evaluate(`globalThis.__equDiagnostic.events.filter(${requestFilter})`);
        await browser.evaluate("globalThis.__equDiagnostic.interact('choice')");
        await delay(150);
        const zero = await browser.evaluate("globalThis.__equDiagnostic.events.filter(e => e.kind === 'target.render').at(-1)");
        expect(Object.values(zero.value.allocated).flat(), 'zero-target control').toHaveLength(0);
        expect(await browser.evaluate('globalThis.__equDiagnostic.session.vm.bottomActionRail.readyDisabled')).toBe(true);
        expect(await browser.evaluate("globalThis.__equDiagnostic.events.filter(e => e.kind === 'session.render').at(-1).value.candidate")).toBeNull();
        if (input === 'overlap') {
          try { await browser.evaluate(`globalThis.__equDiagnostic.targetOverlap('${side}')`); }
          catch (error) {
            if (!String(error).includes('Maximum update depth')) throw error;
            // React also reports this through window.error; keep the trace before asserting.
          }
        } else if (input === 'burst') await browser.evaluate(`globalThis.__equDiagnostic.targetBurst('${side}')`);
        else if (input === 'dom') {
          const point = await browser.evaluate(`globalThis.__equDiagnostic.targetPoint('${side}')`);
          await browser.call('Input.dispatchMouseEvent', {type: 'mouseMoved', ...point});
          await browser.call('Input.dispatchMouseEvent', {type: 'mousePressed', button: 'left', clickCount: 1, ...point});
          await browser.call('Input.dispatchMouseEvent', {type: 'mouseReleased', button: 'left', clickCount: 1, ...point});
        } else await browser.evaluate(`globalThis.__equDiagnostic.interact('target', '${side}')`);
        await delay(300);
        const result = await browser.evaluate('globalThis.__equDiagnostic.export()');
        await writeFile(path.join(artifacts, label + '.json'), JSON.stringify(result, null, 2));
        expect(result.errors, 'actual React runtime errors').toEqual([]);
        const last = result.events.filter((event: any) => event.kind === 'target.render').at(-1);
        const selected = Object.values(last.value.allocated).flat();
        expect(selected).toEqual([await browser.evaluate(`globalThis.__equDiagnostic.capture.action.${side === 'my' ? 'validOwnTargets' : 'validOpponentTargets'}[0].instanceId`)]);
        expect(Object.values(last.value.draft.locatorKeysBySourceInstanceId).flat()).toHaveLength(1);
        expect(Object.values(last.value.draft.exactTargetIdsBySourceInstanceId).flat()).toEqual(selected);
        const analysis: any = Object.values(last.value.analysis)[0];
        expect(analysis.isSatisfied).toBe(false);
        expect(analysis.hasAllocatableNextLocator).toBe(true);
        expect(result.firstTargetSerial, 'first interaction is retained independently of the bounded trace').not.toBeNull();
        const commits = result.countsAfterFirstTarget['session.commit'] ?? 0;
        expect(commits, 'session commits after first click; excludes independent animation frames').toBeLessThan(20);
        expect(result.events.filter((event: any) => event.kind === 'network.unexpected')).toEqual([]);
        const session = result.events.filter((event: any) => event.kind === 'session.render').at(-1).value;
        expect(session.declaration).toEqual({ok: false, reason: 'incomplete_targeting'});
        expect(session.candidate).toBeNull();
        expect(session.recovered.me.healing.last.total, 'captured prior-turn healing remains fresh').toBe(3);
        expect(session.stats.presented).toEqual(session.recovered);
        expect(await browser.evaluate('globalThis.__equDiagnostic.session.vm.bottomActionRail.readyDisabled')).toBe(true);
        await browser.evaluate('globalThis.__equDiagnostic.session.actions.onReadyToggle()');
        await browser.evaluate("globalThis.__equDiagnostic.emit('assertion.incomplete-pair-passed', {})");
        await browser.evaluate('globalThis.__equDiagnostic.releasePreviews()');
        await delay(300);
        const afterLatePreview = await browser.evaluate("globalThis.__equDiagnostic.events.filter(e => e.kind === 'session.render').at(-1).value");
        expect(afterLatePreview.candidate, 'late WIS preview cannot restore an incomplete EQU declaration').toBeNull();
        expect(afterLatePreview.declaration).toEqual({ok: false, reason: 'incomplete_targeting'});
        expect(await browser.evaluate('globalThis.__equDiagnostic.session.vm.bottomActionRail.readyDisabled')).toBe(true);
        expect(await browser.evaluate(`globalThis.__equDiagnostic.events.filter(${requestFilter})`),
          'incomplete targeting schedules neither preview nor submission, including after Ready and a late WIS response').toEqual(requestsBeforeChoice);
        const settledTarget = await browser.evaluate("globalThis.__equDiagnostic.events.filter(e => e.kind === 'target.render').at(-1).value");
        expect(settledTarget.draft).toEqual(last.value.draft);
        expect(settledTarget.allocated).toEqual(last.value.allocated);
        expect(Object.values(settledTarget.analysis)[0]).toEqual(analysis);
        expect(await browser.evaluate("globalThis.__equDiagnostic.countsAfterFirstTarget['session.commit'] ?? 0")).toBeLessThan(20);
        if (staleRefresh) {
          await browser.evaluate(`(async () => {
            const diagnostic = globalThis.__equDiagnostic;
            // Capture-derived legality refresh: not another captured server response.
            const state = structuredClone(diagnostic.capture.state);
            state.stateRevision += 1;
            const action = state.requester.availableActions.find(a => a.shipDefId === 'EQU');
            action['${side === 'my' ? 'validOwnTargets' : 'validOpponentTargets'}'] = [];
            diagnostic.emit('replay.capture-derived-stale-target', {revision: state.stateRevision, side: '${side}'});
            diagnostic.setState(state);
            await diagnostic.refresh();
          })()`);
          await browser.until(`(() => {
            const d = globalThis.__equDiagnostic;
            const draft = d.events.filter(e => e.kind === 'target.render').at(-1)?.value.draft;
            return d.events.some(e => e.kind === 'network.response' && e.value.route.includes('/game-state/') && e.value.revision === d.capture.state.stateRevision + 1)
              && draft && Object.values(draft.locatorKeysBySourceInstanceId).flat().length === 0
              && Object.values(draft.exactTargetIdsBySourceInstanceId).flat().length === 0;
          })()`);
          await delay(300);
          const refreshed = await browser.evaluate('globalThis.__equDiagnostic.export()');
          const target = refreshed.events.filter((event: any) => event.kind === 'target.render').at(-1).value;
          expect(target.draft).toEqual({locatorKeysBySourceInstanceId: {}, exactTargetIdsBySourceInstanceId: {}});
          expect(target.cleaned).toEqual({});
          expect(target.allocated).toEqual({});
          expect(refreshed.errors).toEqual([]);
          expect(refreshed.countsAfterFirstTarget['session.commit']).toBeLessThan(30);
          expect(refreshed.events.filter((event: any) => event.kind === 'network.unexpected')).toEqual([]);
          await browser.evaluate("globalThis.__equDiagnostic.emit('assertion.stale-target-reconciled', {})");
          return;
        }
        await browser.evaluate(`globalThis.__equDiagnostic.interact('target', '${side === 'my' ? 'opponent' : 'my'}')`);
        await delay(600);
        const complete = await browser.evaluate("globalThis.__equDiagnostic.events.filter(e => e.kind === 'target.render').at(-1)");
        expect(Object.values(complete.value.allocated).flat(), 'completed-pair control').toHaveLength(2);
        expect((Object.values(complete.value.analysis)[0] as any).isSatisfied).toBe(true);
        expect(await browser.evaluate('globalThis.__equDiagnostic.errors')).toEqual([]);
        const completedRequests = await browser.evaluate(`globalThis.__equDiagnostic.events.filter(${requestFilter})`);
        expect(completedRequests.length - requestsBeforeChoice.length, 'completed pair schedules at most one new preview').toBeLessThanOrEqual(1);
        expect(completedRequests.filter((event: any) => event.value.route.includes('/intent/'))).toEqual([]);
        expect(await browser.evaluate("globalThis.__equDiagnostic.countsAfterFirstTarget['session.commit'] ?? 0")).toBeLessThan(30);
        await browser.evaluate("globalThis.__equDiagnostic.emit('assertion.completed-pair-passed', {})");
      } finally {
        try { await writeFile(path.join(artifacts, label + '.json'), JSON.stringify(await browser.evaluate('globalThis.__equDiagnostic?.export()'), null, 2)); } catch { /* startup failure */ }
        await browser.close();
        await writeFile(path.join(artifacts, label + '-browser.json'), JSON.stringify(browser.logs, null, 2));
      }
    }, 60000);
  }
});
