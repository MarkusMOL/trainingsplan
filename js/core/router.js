// Minimaler Hash-Router. Ein View hat die Form: { mount(root, params) -> optional cleanup() }.
const routes = [];
let rootEl = null;
let cleanup = null;

export function addRoutes(list) { routes.push(...list); }

export function go(path, { replace = false } = {}) {
  const hash = '#' + path;
  if (replace) location.replace(hash); else location.hash = hash;
}

export function render() {
  if (typeof cleanup === 'function') cleanup();
  cleanup = null;
  const path = location.hash.replace(/^#/, '') || '/';
  const hit = routes.find((r) => r.pattern.test(path)) ?? routes[0];
  const params = hit.pattern.exec(path)?.slice(1) ?? [];
  rootEl.replaceChildren();
  window.scrollTo(0, 0);
  cleanup = hit.view.mount(rootEl, params) ?? null;
}

export function start(root) {
  rootEl = root;
  window.addEventListener('hashchange', render);
  render();
}
