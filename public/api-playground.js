const OUTPUT = document.getElementById("api-output");
const REQUEST_URL = document.getElementById("api-request-url");
const RATE_LIMIT = document.getElementById("api-rate-limit");
const RATE_REMAINING = document.getElementById("api-rate-remaining");
const RATE_RETRY_AFTER = document.getElementById("api-rate-retry-after");
const RATE_SOURCE = document.getElementById("api-rate-source");
const RATE_HINT = document.getElementById("api-rate-hint");

function setOutput(value) {
  if (!OUTPUT) return;
  OUTPUT.textContent = value;
}

function setOutputState(status) {
  if (!OUTPUT) return;
  OUTPUT.classList.remove("is-http-error", "is-rate-limited");
  if (status === 429) {
    OUTPUT.classList.add("is-rate-limited");
    return;
  }
  if (typeof status === "number" && status >= 400) {
    OUTPUT.classList.add("is-http-error");
  }
}

function setRequestUrl(value) {
  if (!REQUEST_URL) return;
  REQUEST_URL.textContent = value;
}

function setRateField(element, value, fallback = "N/A") {
  if (!element) return;
  element.textContent = value || fallback;
}

function setRateSnapshot({ limit, remaining, retryAfter, source, status }) {
  setRateField(RATE_LIMIT, limit);
  setRateField(RATE_REMAINING, remaining);
  setRateField(RATE_RETRY_AFTER, retryAfter);
  setRateField(RATE_SOURCE, source);

  if (!RATE_HINT) return;
  if (status === 429) {
    RATE_HINT.innerHTML = "Rate limit reached. Wait the <code>retry-after</code> seconds, then retry.";
    return;
  }
  RATE_HINT.innerHTML = "<code>x-ratelimit-*</code> headers are guaranteed on <code>429</code> responses.";
}

function buildFormatsQuery(form) {
  const params = new URLSearchParams();

  const category = form.elements.namedItem("category")?.value?.trim();
  const from = form.elements.namedItem("from")?.value?.trim();
  const to = form.elements.namedItem("to")?.value?.trim();
  const q = form.elements.namedItem("q")?.value?.trim();

  if (category) params.set("category", category);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (q) params.set("q", q);

  const query = params.toString();
  return query ? `?${query}` : "";
}

async function runApiRequest(path) {
  const url = new URL(path, window.location.origin);
  setRequestUrl(`${url.pathname}${url.search}`);
  setOutputState(null);
  setOutput("Loading...");

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { accept: "application/json" }
    });

    const bodyText = await response.text();
    let jsonValue = null;
    try {
      jsonValue = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      jsonValue = { raw: bodyText };
    }

    const meta = {
      http: {
        ok: response.ok,
        status: response.status,
        statusText: response.statusText
      },
      rateLimit: {
        limit: response.headers.get("x-ratelimit-limit"),
        remaining: response.headers.get("x-ratelimit-remaining"),
        source: response.headers.get("x-ratelimit-source"),
        retryAfter: response.headers.get("retry-after")
      },
      data: jsonValue
    };

    setOutputState(response.status);
    setRateSnapshot({
      ...meta.rateLimit,
      status: response.status
    });
    setOutput(JSON.stringify(meta, null, 2));
  } catch (error) {
    setOutputState(500);
    setRateSnapshot({
      limit: null,
      remaining: null,
      retryAfter: null,
      source: null,
      status: 500
    });
    setOutput(
      JSON.stringify(
        {
          http: { ok: false },
          error: error?.message || String(error)
        },
        null,
        2
      )
    );
  }
}

function registerForm(selector, handler) {
  const form = document.querySelector(selector);
  if (!(form instanceof HTMLFormElement)) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await handler(form);
  });
}

registerForm('form[data-api-form="status"]', async () => {
  await runApiRequest("/api/v1/status");
});

registerForm('form[data-api-form="handlers"]', async () => {
  await runApiRequest("/api/v1/handlers");
});

registerForm('form[data-api-form="formats"]', async (form) => {
  const query = buildFormatsQuery(form);
  await runApiRequest(`/api/v1/formats${query}`);
});

setRequestUrl("/api/v1/status");
setRateSnapshot({
  limit: null,
  remaining: null,
  retryAfter: null,
  source: null,
  status: null
});
setOutput(
  JSON.stringify(
    {
      note: "Use the playground buttons above to call /api/v1/* endpoints.",
      tips: [
        "Try formats: category=image&from=true&q=png",
        "Run requests repeatedly to test rate-limit behavior"
      ]
    },
    null,
    2
  )
);
