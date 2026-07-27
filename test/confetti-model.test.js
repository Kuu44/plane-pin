"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  bottomCrossingTime,
  createRealisticParticles,
  particlePosition
} = require("../src/renderer/confetti-model");

test("every realistic particle remains active until it crosses the display bottom", () => {
  const particles = createRealisticParticles({
    x: 12,
    y: 80,
    height: 1080,
    random: () => 0.5
  });

  assert.equal(particles.length, 200);
  for (const particle of particles) {
    const crossing = bottomCrossingTime(80, particle.velocityY, particle.gravity, 1080 + particle.height);
    assert.equal(particle.exitTime, crossing);
    assert.ok(particlePosition(particle, crossing - 0.001, 1920).y < 1080 + particle.height);
    assert.ok(particlePosition(particle, crossing + 0.001, 1920).y > 1080 + particle.height);
  }
});
