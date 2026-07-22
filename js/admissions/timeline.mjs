export class ProvinceTimeline {
  constructor({ onStage, onFinish, reduced = false }) {
    this.onStage = onStage;
    this.onFinish = onFinish;
    this.reduced = reduced;
    this.queue = [];
    this.index = 0;
    this.timer = 0;
    this.paused = false;
    this.remaining = 0;
    this.startedAt = 0;
    this.token = 0;
  }

  play(province) {
    this.stop();
    const cityPause = this.reduced ? 0 : 260;
    const universityPause = this.reduced ? 0 : 340;
    const handoffPause = this.reduced ? 0 : 220;
    this.queue = [
      ['focus', 0],
      // City boundaries are introduced at the exact end of the focus move;
      // city labels themselves begin shortly afterwards.
      ['cities', 0],
      ...province.cities.map((_city, index) => ['city', index === 0 ? this.reduced ? 0 : 100 : cityPause, index]),
      ...province.universities.map((_university, index) => ['university', index === 0 ? this.reduced ? 0 : 260 : universityPause, index]),
      ...province.universities.map((_university, index) => ['handoff', index === 0 ? this.reduced ? 0 : 300 : handoffPause, index]),
      ['complete', this.reduced ? 0 : 220]
    ];
    this.index = 0;
    this.token += 1;
    this.schedule(this.queue[0]?.[1] || 0);
  }

  schedule(delay) {
    if (this.paused || this.index >= this.queue.length) return;
    const token = this.token;
    this.remaining = delay;
    this.startedAt = performance.now();
    this.timer = window.setTimeout(async () => {
      if (this.paused || token !== this.token) return;
      const [stage, _delay, stageIndex] = this.queue[this.index++];
      this.timer = 0;
      await this.onStage?.(stage, stageIndex);
      if (token !== this.token) return;
      if (stage === 'complete') this.onFinish?.();
      this.schedule(this.queue[this.index]?.[1] || 0);
    }, delay);
  }

  pause() {
    if (this.paused || !this.timer) return;
    this.remaining = Math.max(0, this.remaining - (performance.now() - this.startedAt));
    this.paused = true;
    clearTimeout(this.timer);
    this.timer = 0;
  }

  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.schedule(this.remaining);
  }

  stop() {
    this.token += 1;
    clearTimeout(this.timer);
    this.timer = 0;
    this.queue = [];
    this.index = 0;
    this.paused = false;
    this.remaining = 0;
  }
}
