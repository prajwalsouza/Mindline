// The existing UI keeps its request-shaped interface; all /api operations are
// messages to the local worker. No /api request reaches the static host.
(() => {
  const base = new URL("../", document.currentScript.src).href;
  const originalFetch = window.fetch.bind(window),
    pending = new Map();
  let worker = null,
    seq = 0,
    busy = 0,
    failed = null,
    warning = "";
  function notice(text) {
    let el = document.getElementById("static-status");
    if (!el) {
      el = document.createElement("div");
      el.id = "static-status";
      el.setAttribute("role", "status");
      el.style.cssText =
        "position:fixed;bottom:12px;left:50%;transform:translateX(-50%);z-index:99999;background:#17251e;color:white;border-radius:8px;padding:10px 16px;font:13px system-ui;max-width:80vw;box-shadow:0 2px 12px #0003";
      document.body.append(el);
    }
    el.textContent = text;
    el.hidden = !text;
  }
  function start() {
    if (worker) return;
    worker = new Worker(new URL("runtime/worker.mjs", base), {
      type: "module",
    });
    worker.onmessage = ({ data: m }) => {
      if (m.warning) {
        warning = m.warning;
        notice(warning);
        return;
      }
      const p = pending.get(m.id);
      if (!p) return;
      pending.delete(m.id);
      busy--;
      if (!busy) notice(warning);
      m.error ? p.reject(Error(m.error)) : p.resolve(m.result);
    };
    worker.onerror = (e) => {
      failed = Error(
        "Unable to start browser calculations: " +
          (e.message || "check that all static files were uploaded."),
      );
      for (const p of pending.values()) p.reject(failed);
      pending.clear();
      busy = 0;
      notice(failed.message);
    };
  }
  async function execute(path, method = "GET", body = {}) {
    // The embedded simulator shares the parent worker, including generated runs.
    if (window.parent !== window) {
      try {
        if (parent.location.origin === location.origin && parent.MindlineStatic)
          return parent.MindlineStatic.execute(path, method, body);
      } catch (e) {}
    }
    if (failed) throw failed;
    start();
    const id = ++seq;
    busy++;
    notice(
      path === "/api/runs"
        ? "Generating lab data in your browser…"
        : path.includes("calendar")
          ? "Calculating the feed calendar…"
          : "Calculating in your browser…",
    );
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, path, method, body });
    });
  }
  const apiPath = (input) => {
    const s =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const u = new URL(s, location.href);
    return u.origin === location.origin && u.pathname.startsWith("/api/")
      ? u.pathname + u.search
      : null;
  };
  window.MindlineStatic = {
    base,
    isAdmin: location.pathname
      .slice(new URL(base).pathname.length)
      .startsWith("admin"),
    execute,
  };
  window.fetch = async (input, opt = {}) => {
    const path = apiPath(input);
    if (!path) return originalFetch(input, opt);
    try {
      const body =
          typeof opt.body === "string" ? JSON.parse(opt.body) : opt.body || {},
        r = await execute(path, opt.method || "GET", body);
      return new Response(r.download ?? JSON.stringify(r), {
        headers: { "Content-Type": r.type || "application/json" },
      });
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  };
  class LocalEventSource extends EventTarget {
    constructor(url) {
      super();
      this.closed = false;
      this.readyState = 0;
      const q = new URL(url, location.href),
        rate = Math.max(
          0.2,
          Math.min(60, Number(q.searchParams.get("rate") || 4)),
        ),
        from = Number(q.searchParams.get("from") || 0);
      execute(q.pathname + q.search)
        .then((bins) => {
          if (this.closed) return;
          this.readyState = 1;
          this.dispatchEvent(new Event("open"));
          let i = from;
          const tick = () => {
            if (this.closed) return;
            if (i >= bins.length) {
              this.dispatchEvent(new MessageEvent("done", { data: "{}" }));
              this.close();
              return;
            }
            const e = new MessageEvent("message", {
              data: JSON.stringify(bins[i++]),
            });
            this.onmessage?.(e);
            this.dispatchEvent(e);
            this.timer = setTimeout(tick, 1000 / rate);
          };
          tick();
        })
        .catch((e) => {
          this.onerror?.(e);
          this.dispatchEvent(new Event("error"));
          this.close();
        });
    }
    close() {
      this.closed = true;
      this.readyState = 2;
      clearTimeout(this.timer);
    }
  }
  const NativeEventSource = window.EventSource;
  window.EventSource = function (url, options) {
    return apiPath(url)
      ? new LocalEventSource(url)
      : new NativeEventSource(url, options);
  };
  document.addEventListener("click", async (e) => {
    const a = e.target.closest("a[href]");
    if (!a) return;
    const path = apiPath(a.href);
    if (!path) return;
    e.preventDefault();
    try {
      const r = await execute(path),
        u = URL.createObjectURL(new Blob([r.download], { type: r.type })),
        link = document.createElement("a");
      link.href = u;
      link.download = r.filename;
      link.hidden = true;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(u), 30000);
    } catch (err) {
      notice(err.message);
    }
  });
})();
