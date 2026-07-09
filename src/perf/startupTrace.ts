/**
 * Cold-start instrumentation. Upstart's whole native-vs-webview heuristic is a
 * performance argument ("native animation will be snappier"), so a candidate
 * who measures startup before optimizing is speaking their language.
 *
 * This measures the JS-visible portion of launch: t0 is when this module is
 * first evaluated (the JS bundle is running), then the app marks its first
 * render and its first meaningful content (rates on screen = TTI). A native
 * mark would additionally capture pre-JS time; that is a documented next step,
 * not a claim made here.
 */

export interface Clock {
  now(): number;
}

const defaultClock: Clock = {
  // Hermes exposes performance.now(); fall back to Date.now() where it isn't
  // typed/available (e.g. some test runtimes). Reached via globalThis so TS
  // doesn't need the DOM lib.
  now: () => {
    const perf = (globalThis as {performance?: {now?: () => number}}).performance;
    return typeof perf?.now === 'function' ? perf.now() : Date.now();
  },
};

export interface StartupReport {
  /** Bundle eval → first render committed. */
  toFirstRenderMs: number;
  /** Bundle eval → first meaningful content (rates on screen). */
  toContentMs: number;
}

export class StartupTrace {
  private readonly startedAt: number;
  private firstRenderAt?: number;
  private contentAt?: number;
  private reported = false;

  constructor(
    private readonly clock: Clock = defaultClock,
    private readonly onReport: (report: StartupReport) => void = () => {},
  ) {
    this.startedAt = clock.now();
  }

  /** Idempotent: only the first render counts. */
  markFirstRender(): void {
    if (this.firstRenderAt === undefined) {
      this.firstRenderAt = this.clock.now();
    }
  }

  /** Idempotent: only the first meaningful content counts; reports once ready. */
  markContentReady(): void {
    if (this.contentAt !== undefined) {
      return;
    }
    this.contentAt = this.clock.now();
    this.maybeReport();
  }

  report(): StartupReport | null {
    if (this.firstRenderAt === undefined || this.contentAt === undefined) {
      return null;
    }
    return {
      toFirstRenderMs: this.firstRenderAt - this.startedAt,
      toContentMs: this.contentAt - this.startedAt,
    };
  }

  private maybeReport(): void {
    const report = this.report();
    if (report && !this.reported) {
      this.reported = true;
      this.onReport(report);
    }
  }
}

/** Dev-only reporter — surfaces the numbers without shipping logging in release. */
function devReporter(report: StartupReport): void {
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    console.log(
      `[startup] first render ${report.toFirstRenderMs.toFixed(0)}ms · ` +
        `content ${report.toContentMs.toFixed(0)}ms`,
    );
  }
}

/** The app-wide trace, started the moment this module evaluates. */
export const startupTrace = new StartupTrace(defaultClock, devReporter);
