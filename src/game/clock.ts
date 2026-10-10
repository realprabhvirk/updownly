/**
 * Competitive clock for Sprint. Elapsed time is the larger of a monotonic
 * reading (performance.now — immune to wall-clock changes) and a wall-clock
 * reading (Date.now — keeps counting while a suspended tab's monotonic
 * clock may pause). Backgrounding the app therefore never buys free time,
 * and moving the system clock backwards cannot either.
 */
export type TimeSource = { mono: () => number; wall: () => number };

export const systemTime: TimeSource = {
  mono: () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  wall: () => Date.now(),
};

export class CompetitiveClock {
  private mono0 = 0;
  private wall0 = 0;
  private started = false;

  constructor(private readonly source: TimeSource = systemTime) {}

  start(): void {
    this.mono0 = this.source.mono();
    this.wall0 = this.source.wall();
    this.started = true;
  }

  get isStarted(): boolean {
    return this.started;
  }

  elapsed(): number {
    if (!this.started) return 0;
    const mono = this.source.mono() - this.mono0;
    const wall = this.source.wall() - this.wall0;
    return Math.max(mono, wall, 0);
  }
}
