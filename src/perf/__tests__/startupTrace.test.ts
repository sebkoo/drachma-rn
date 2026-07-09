import {Clock, StartupReport, StartupTrace} from '../startupTrace';

/** A clock the test advances by hand — no real time, no flakiness. */
class FakeClock implements Clock {
  private t = 0;
  advance(ms: number) {
    this.t += ms;
  }
  now() {
    return this.t;
  }
}

describe('StartupTrace', () => {
  it('measures bundle-eval to first render and to content', () => {
    const clock = new FakeClock();
    let report: StartupReport | undefined;
    const trace = new StartupTrace(clock, r => (report = r));

    clock.advance(120);
    trace.markFirstRender();
    clock.advance(80);
    trace.markContentReady();

    expect(report).toEqual({toFirstRenderMs: 120, toContentMs: 200});
  });

  it('is idempotent — only the first of each mark counts', () => {
    const clock = new FakeClock();
    const trace = new StartupTrace(clock);

    clock.advance(100);
    trace.markFirstRender();
    clock.advance(50);
    trace.markFirstRender(); // ignored
    clock.advance(50);
    trace.markContentReady();
    clock.advance(50);
    trace.markContentReady(); // ignored

    expect(trace.report()).toEqual({toFirstRenderMs: 100, toContentMs: 200});
  });

  it('reports exactly once, even if content is marked again', () => {
    const clock = new FakeClock();
    const onReport = jest.fn();
    const trace = new StartupTrace(clock, onReport);

    trace.markFirstRender();
    trace.markContentReady();
    trace.markContentReady();

    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('does not report until both marks are set', () => {
    const clock = new FakeClock();
    const onReport = jest.fn();
    const trace = new StartupTrace(clock, onReport);

    trace.markContentReady(); // content before first render — incomplete
    expect(trace.report()).toBeNull();
    expect(onReport).not.toHaveBeenCalled();
  });
});
