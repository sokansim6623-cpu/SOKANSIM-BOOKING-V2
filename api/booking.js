const ALLOWED_GET = new Set(["health", "settings", "availability"]);
const ALLOWED_POST = new Set(["lookup", "change", "cancel"]);

module.exports = async function handler(req, res) {
  try {
    const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
    const apiKey = process.env.PATIENT_API_KEY;

    if (!scriptUrl || !apiKey) {
      return res.status(500).json({
        ok: false,
        error: "missing_environment"
      });
    }

    res.setHeader("Cache-Control", "no-store");

    // =========================
    // GET
    // =========================
    if (req.method === "GET") {
      const action = String(req.query.action || "health");

      if (!ALLOWED_GET.has(action)) {
        return res.status(400).json({
          ok: false,
          error: "invalid_action"
        });
      }

      const url = new URL(scriptUrl);
      url.searchParams.set("key", apiKey);
      url.searchParams.set("action", action);

      if (action === "availability") {
        const month = String(req.query.month || "");

        if (!/^\d{4}-\d{2}$/.test(month)) {
          return res.status(400).json({
            ok: false,
            error: "invalid_month"
          });
        }

        url.searchParams.set("month", month);
      }

      return await forwardJson(url.toString(), {
        method: "GET",
        redirect: "follow",
        headers: {
          Accept: "application/json"
        }
      }, res);
    }

    // =========================
    // POST
    // =========================
    if (req.method === "POST") {
      const body =
        typeof req.body === "string"
          ? JSON.parse(req.body || "{}")
          : (req.body || {});

      const action = String(body.action || "");

      if (!ALLOWED_POST.has(action)) {
        return res.status(400).json({
          ok: false,
          error: "invalid_action"
        });
      }

      const url = new URL(scriptUrl);
      url.searchParams.set("key", apiKey);

      try {
        // 중요:
        // 별도 4초 타임아웃을 두지 않습니다.
        // Apps Script 변경 요청이 실제 테스트에서 약 4.6초 걸렸기 때문입니다.
        const upstream = await fetch(url.toString(), {
          method: "POST",
          redirect: "follow",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
          },
          body: JSON.stringify(body)
        });

        const text = await upstream.text();

        try {
          const data = JSON.parse(text);
          return res.status(200).json(data);

        } catch (parseError) {
          console.error(
            "Apps Script non JSON:",
            upstream.status,
            text.slice(0, 300)
          );

          // 변경/취소 요청은 실제 시트에는 성공했는데
          // 응답만 깨지는 경우가 있으므로 한 번 확인
          if (action === "change" || action === "cancel") {
            const success = await verifyMutation(
              scriptUrl,
              apiKey,
              action,
              body
            );

            if (success) {
              return res.status(200).json({
                ok: true,
                recovered: true
              });
            }
          }

          return res.status(502).json({
            ok: false,
            error: "invalid_upstream_response"
          });
        }

      } catch (error) {
        console.error("Apps Script POST error:", error);

        if (action === "change" || action === "cancel") {
          const success = await verifyMutation(
            scriptUrl,
            apiKey,
            action,
            body
          );

          if (success) {
            return res.status(200).json({
              ok: true,
              recovered: true
            });
          }
        }

        return res.status(502).json({
          ok: false,
          error: "upstream_request_failed"
        });
      }
    }

    res.setHeader("Allow", "GET, POST");

    return res.status(405).json({
      ok: false,
      error: "method_not_allowed"
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      ok: false,
      error: "server_error"
    });
  }
};


// =========================
// GET 전달
// =========================
async function forwardJson(url, options, res) {
  try {
    const upstream = await fetch(url, options);
    const text = await upstream.text();

    try {
      const data = JSON.parse(text);
      return res.status(200).json(data);

    } catch (error) {
      console.error(
        "Apps Script GET non JSON:",
        upstream.status,
        text.slice(0, 300)
      );

      return res.status(502).json({
        ok: false,
        error: "invalid_upstream_response"
      });
    }

  } catch (error) {
    console.error("Apps Script GET error:", error);

    return res.status(502).json({
      ok: false,
      error: "upstream_request_failed"
    });
  }
}


// =========================
// 변경/취소 실제 반영 확인
// =========================
async function verifyMutation(
  scriptUrl,
  apiKey,
  action,
  body
) {
  try {
    const patientName =
      String(body.patientName || "").trim();

    const phoneLast4 =
      String(body.phoneLast4 || "").trim();

    if (
      !patientName ||
      !/^\d{4}$/.test(phoneLast4)
    ) {
      return false;
    }

    const url = new URL(scriptUrl);

    url.searchParams.set("key", apiKey);
    url.searchParams.set("action", "lookup");
    url.searchParams.set("patientName", patientName);
    url.searchParams.set("phoneLast4", phoneLast4);

    const response = await fetch(url.toString(), {
      method: "GET",
      redirect: "follow",
      headers: {
        Accept: "application/json"
      }
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch (error) {
      return false;
    }

    const reservations =
      Array.isArray(data.reservations)
        ? data.reservations
        : [];

    // 변경 성공 여부
    if (action === "change") {
      const newDate =
        String(body.appointmentDate || "");

      const newTime =
        String(body.appointmentTime || "");

      return reservations.some((item) =>
        String(item.appointmentDate || "") === newDate &&
        String(item.appointmentTime || "") === newTime
      );
    }

    // 취소 성공 여부
    if (action === "cancel") {
      const oldDate =
        String(body.originalDate || "");

      const oldTime =
        String(body.originalTime || "");

      return !reservations.some((item) =>
        String(item.appointmentDate || "") === oldDate &&
        String(item.appointmentTime || "") === oldTime
      );
    }

    return false;

  } catch (error) {
    console.error("verifyMutation error:", error);
    return false;
  }
}