"use strict";

// Shared by the transparent celebration window and node --test.
(function (root) {
  const palette = ["#27d3ea", "#1685ff", "#34d399", "#fbbf24", "#fb7185", "#a78bfa", "#f8fafc"];
  const layers = [
    { count: 50, spread: 26, speed: 1080, scale: 1 },
    { count: 40, spread: 60, speed: 820, scale: 1 },
    { count: 70, spread: 100, speed: 690, scale: 0.8 },
    { count: 20, spread: 120, speed: 470, scale: 1.2 },
    { count: 20, spread: 120, speed: 850, scale: 1 }
  ];

  function bottomCrossingTime(originY, velocityY, gravity, bottomY) {
    const distance = Math.max(0, bottomY - originY);
    return (-velocityY + Math.sqrt((velocityY * velocityY) + (2 * gravity * distance))) / gravity;
  }

  function reflectedX(value, width) {
    if (width <= 0) return 0;
    const period = width * 2;
    const wrapped = ((value % period) + period) % period;
    return wrapped > width ? period - wrapped : wrapped;
  }

  function particlePosition(particle, elapsed, width) {
    return {
      x: reflectedX(particle.x + (particle.velocityX * elapsed), width),
      y: particle.y + (particle.velocityY * elapsed) + (0.5 * particle.gravity * elapsed * elapsed)
    };
  }

  function createRealisticParticles({ x, y, height, random = Math.random }) {
    const particles = [];
    for (const layer of layers) {
      for (let index = 0; index < layer.count; index += 1) {
        const angle = (-90 + ((random() - 0.5) * layer.spread)) * (Math.PI / 180);
        const speed = layer.speed * (0.82 + (random() * 0.3));
        const gravity = 720 + (random() * 260);
        const width = (4 + (random() * 5)) * layer.scale;
        const particleHeight = (random() > 0.28 ? width * (1.3 + random()) : width) * layer.scale;
        const particle = {
          x,
          y,
          width,
          height: particleHeight,
          color: palette[Math.floor(random() * palette.length)],
          velocityX: Math.cos(angle) * speed,
          velocityY: Math.sin(angle) * speed,
          gravity,
          rotation: random() * Math.PI * 2,
          spin: (random() - 0.5) * 13,
          flip: 7 + (random() * 11)
        };
        particle.exitTime = bottomCrossingTime(y, particle.velocityY, gravity, height + particleHeight);
        particles.push(particle);
      }
    }
    return particles;
  }

  const api = { bottomCrossingTime, createRealisticParticles, particlePosition, reflectedX };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.planePinConfetti = api;
})(typeof window !== "undefined" ? window : null);
