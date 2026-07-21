export class ProvinceTimeline {
  constructor({ onStage, onFinish, reduced = false }) { this.onStage = onStage; this.onFinish = onFinish; this.reduced = reduced; this.timer = 0; this.paused = false; this.queue = []; this.index = 0; }
  play(province) {
    this.stop(); const universities = province.universities.length;
    this.queue = this.reduced ? [['province', 0], ['cards', 80], ['complete', 180]] : [['province', 0], ['cities', 420], ...province.universities.map((_item, index) => ['university', 760 + index * 400]), ['complete', 1200 + universities * 400]];
    this.index = 0; this.schedule();
  }
  schedule() { if (this.paused || this.index >= this.queue.length) return; const [stage, delay] = this.queue[this.index++]; this.timer = window.setTimeout(() => { this.onStage(stage); if (stage === 'complete') this.onFinish?.(); this.schedule(); }, delay); }
  pause() { this.paused = true; clearTimeout(this.timer); }
  resume() { if (!this.paused) return; this.paused = false; this.schedule(); }
  stop() { clearTimeout(this.timer); this.queue = []; this.index = 0; this.paused = false; }
}
