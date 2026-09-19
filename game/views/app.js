/* Shared helpers for the three views. */

async function api(path, body, headers = {}) {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // some responses carry no body
  }
  if (!res.ok) throw Object.assign(new Error(data.error || 'Something went wrong.'), { status: res.status });
  return data;
}

/* Live updates over server-sent events, with a slow poll as a safety net so a
   dropped stream never leaves the TV showing a stale reveal. */
function connect(onState) {
  let lastVersion = -1;
  const apply = (state) => {
    if (state.version === lastVersion) return;
    lastVersion = state.version;
    onState(state);
  };

  const source = new EventSource('/api/events');
  source.onmessage = (event) => apply(JSON.parse(event.data));

  setInterval(async () => {
    if (source.readyState === EventSource.OPEN) return;
    try {
      apply(await api('/api/state'));
    } catch {
      // still offline; the stream will reconnect on its own
    }
  }, 4000);

  return source;
}

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== false) node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

let toastTimer = null;
function toast(message) {
  let node = document.querySelector('.toast');
  if (!node) {
    node = el('div', { class: 'toast', role: 'status' });
    document.body.append(node);
  }
  node.textContent = message;
  node.setAttribute('data-show', '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.removeAttribute('data-show'), 3600);
}

const store = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key) ?? 'null');
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // private browsing; the page still works for this visit
    }
  },
  clear(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // nothing to do
    }
  },
};
