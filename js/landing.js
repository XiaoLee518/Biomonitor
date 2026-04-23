// Landing page
document.getElementById('landingEnter')?.addEventListener('click', () => {
  const lp = document.getElementById('landingPage');
  if (lp) {
    lp.style.opacity = '0';
    lp.style.transition = 'opacity .35s';
    setTimeout(() => {
      lp.style.display = 'none';
      // ★ Auto-open BLE modal after landing fades out
      setTimeout(() => {
        const bleModal = document.getElementById('bleModal');
        if (bleModal) bleModal.classList.add('show');
      }, 180);
    }, 350);
  }
});

// ★ Sensor card pop animation on click/tap
document.querySelectorAll('.landing-sensor-card').forEach(card => {
  card.addEventListener('click', () => {
    card.classList.remove('pop');
    // Force reflow so re-adding .pop restarts the animation
    void card.offsetWidth;
    card.classList.add('pop');
  });
});
