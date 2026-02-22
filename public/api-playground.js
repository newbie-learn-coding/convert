const OUTPUT = document.getElementById("api-output");
const REQUEST_URL = document.getElementById("api-request-url");

function setOutput(value) {
  if (!OUTPUT) return;
  OUTPUT.textContent = value;
}

function setRequestUrl(value) {
  if (!REQUEST_URL) return;
  REQUEST_URL.textContent = value;
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

    setOutput(JSON.stringify(meta, null, 2));
  } catch (error) {
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
setOutput(
  JSON.stringify(
    {
      note: "Use the playground buttons above to call /api/v1/* endpoints.",
      tips: ["Try formats: category=image&from=true&q=png"]
    },
    null,
    2
  )
);

