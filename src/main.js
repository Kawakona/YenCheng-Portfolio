import { initCasualToolsViewer } from './model.JS/P4main.js';
// 可擴充更多 viewer：{ id: 'viewer-xxx', init: initXxxViewer }

const viewers = [
  { id: 'viewer-casualtools', init: initCasualToolsViewer }
];

document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const config = viewers.find(v => v.id === el.id);
        if (config) {
          config.init(el);
          obs.unobserve(el); // 只初始化一次
        }
      }
    });
  }, {
    root: null,
    rootMargin: '0px',
    threshold: 0.1
  });

  viewers.forEach(({ id }) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });

  // 在每個 canvas 上阻止頁面滾動
  document.querySelectorAll('canvas').forEach(canvas => {
    canvas.addEventListener('wheel', (event) => {
      event.stopPropagation(); // ✅ 只阻止冒泡，不擋掉滾動本身
    }, { passive: false });
  });
});
