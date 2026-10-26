const test = require("node:test");
const assert = require("node:assert/strict");
const { formatClock, playbackTimes, findSegmentIndex, spectrumLevels, decay } = require("../Extensions/pioneerVFDClaude.js");

test("formatClock renders minutes and zero-padded seconds", () => {
  assert.equal(formatClock(0), "0:00");
  assert.equal(formatClock(35000), "0:35");
  assert.equal(formatClock(349000), "5:49");
  assert.equal(formatClock(3599000), "59:59");
});

test("formatClock rejects values that are not a valid duration", () => {
  assert.throws(() => formatClock(-1), RangeError);
  assert.throws(() => formatClock(NaN), RangeError);
  assert.throws(() => formatClock(Infinity), RangeError);
});

test("playbackTimes accepts a normal position", () => {
  assert.deepEqual(playbackTimes(35000, 349000), { valid: true, progMs: 35000, durMs: 349000 });
});

test("playbackTimes tolerates a position slightly past the end and clamps it", () => {
  assert.deepEqual(playbackTimes(101500, 100000), { valid: true, progMs: 100000, durMs: 100000 });
});

test("playbackTimes flags the epoch-sized progress Spicetify can return (Liked Songs)", () => {
  assert.equal(playbackTimes(Date.now(), 200000).valid, false);
  assert.equal(playbackTimes(Date.now(), 0).valid, false);
});

test("playbackTimes flags negative, NaN and zero-duration input", () => {
  assert.equal(playbackTimes(-5, 100000).valid, false);
  assert.equal(playbackTimes(NaN, 100000).valid, false);
  assert.equal(playbackTimes(1000, 0).valid, false);
});

const segs = [{ start: 0 }, { start: 1 }, { start: 2.5 }];

test("findSegmentIndex picks the last segment that started at or before t", () => {
  assert.equal(findSegmentIndex(segs, 0.5), 0);
  assert.equal(findSegmentIndex(segs, 1), 1);
  assert.equal(findSegmentIndex(segs, 2.4), 1);
  assert.equal(findSegmentIndex(segs, 99), 2);
});

test("findSegmentIndex clamps before the first segment and rejects empty input", () => {
  assert.equal(findSegmentIndex(segs, -1), 0);
  assert.throws(() => findSegmentIndex([], 1), RangeError);
});

const pitches = Array.from({ length: 12 }, (_, i) => (i + 1) / 12);

test("spectrumLevels scales pitch energy by loudness and returns bandCount values in [0,1]", () => {
  const loud = spectrumLevels({ pitches, loudness_max: 0 }, 12);
  assert.equal(loud.length, 12);
  assert.ok(loud.every((v) => v >= 0 && v <= 1));
  assert.equal(loud[11], 1);
  const silent = spectrumLevels({ pitches, loudness_max: -60 }, 12);
  assert.ok(silent.every((v) => v === 0));
  const half = spectrumLevels({ pitches, loudness_max: -30 }, 12);
  assert.equal(half[11], 0.5);
});

test("spectrumLevels maps pitches onto a different band count", () => {
  assert.equal(spectrumLevels({ pitches, loudness_max: 0 }, 6).length, 6);
});

test("spectrumLevels rejects a segment without 12 pitches and reports the input", () => {
  assert.throws(() => spectrumLevels({ pitches: [1, 2], loudness_max: 0 }, 12), (e) => e instanceof TypeError && e.message.includes("[1,2]"));
});

test("decay falls gradually but jumps up immediately", () => {
  assert.equal(decay(1, 0, 0.8), 0.8);
  assert.equal(decay(0.2, 0.9, 0.8), 0.9);
  assert.equal(decay(0, 0, 0.8), 0);
});
