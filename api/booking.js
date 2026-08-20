const ALLOWED_GET = new Set(["health", "settings", "availability"]);
const ALLOWED_POST = new Set(["lookup", "create", "change", "cancel"]);

module.exports = async function handler(req, res) {
  try {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    const apiKey = process.env.PATIENT_API_KEY;

    if (!scriptUrl || !apiKey) {
      return res.status(500).json({
        ok: false,
        error: "환경변수 GOOGLE_SCRIPT_URL 또는 PATIENT_API_KEY가 설정되지 않았습니다."
      });
    }

    if (req.method === "GET") {
      const action = String(req.query.action || "health");

      if (!ALLOWED_GET.has(action)) {
        return res.status(400).json({ ok: false, error: "invalid_action" });
      }

      const url = new URL(scriptUrl);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("action", action);

      if (action === "availability") {
        const month = String(req.query.month || "");
        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({ ok: false, error: "invalid_month" });
        }
        url.searchParams.set("month", month);
      }

      const upstream = await fetch(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: { "Accept": "application/json" }
      });

      const text = await upstream.text();
      return sendUpstream(res, upstream.status, text);
    }

    if (req.method === "POST") {
      const body = typeof req.body === "string"
        ? JSON.parse(req.body || "{}")
        : (req.body || {});

      const action = String(body.action || "");

      if (!ALLOWED_POST.has(action)) {
        return res.status(400).json({ ok: false, error: "invalid_action" });
      }

      const url = new URL(scriptUrl);
      url.searchParams.set("key", apiKey);

      const upstream = await fetch(url.toString(), {
        method: "POST",
        redirect: "follow",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(body)
      });

      const text = await upstream.text();
      return sendUpstream(res, upstream.status, text);
    }

    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      ok: false,
      error: "server_error"
    });
  }
};

function sendUpstream(res, status, text) {
  res.setHeader("Cache-Control", "no-store");

  try {
    const data = JSON.parse(text);
    return res.status(status >= 200 && status < 500 ? status : 502).json(data);
  } catch {
    return res.status(502).json({
      ok: false,
      error: "invalid_upstream_response"
    });
  }
}
