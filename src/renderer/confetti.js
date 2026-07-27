"use strict";

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
const query = new URLSearchParams(location.search);
const origin = {
  x: Number(query.get("x")),
  y: Number(query.get("y"))
};
const scale = Math.max(1, window.devicePixelRatio || 1);
canvas.width = Math.round(innerWidth * scale);
canvas.height = Math.round(innerHeight * scale);
context.scale(scale, scale);

const particles = window.planePinConfetti.createRealisticParticles({
  x: Math.max(0, Math.min(innerWidth, origin.x)),
  y: Math.max(0, Math.min(innerHeight, origin.y)),
  height: innerHeight
});
const startedAt = performance.now();

function draw(now) {
  const elapsed = (now - startedAt) / 1000;
  let active = false;
  context.clearRect(0, 0, innerWidth, innerHeight);

  for (const particle of particles) {
    if (elapsed > particle.exitTime) continue;
    active = true;
    const position = window.planePinConfetti.particlePosition(particle, elapsed, innerWidth);
    context.save();
    context.translate(position.x, position.y);
    context.rotate(particle.rotation + (particle.spin * elapsed));
    context.scale(1, Math.cos(particle.flip * elapsed));
    context.fillStyle = particle.color;
    context.fillRect(
      -particle.width / 2,
      -particle.height / 2,
      particle.width,
      particle.height
    );
    context.restore();
  }

  if (active) requestAnimationFrame(draw);
  else window.planePin.finishCelebration();
}

requestAnimationFrame(draw);
