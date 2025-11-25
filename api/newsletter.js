// api/newsletter.js

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ message: "Missing email or token" });
  }

  // 1️⃣ Google reCAPTCHA v2 Invisible doğrulaması
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;

  const recaptchaResponse = await fetch(
    "https://www.google.com/recaptcha/api/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `secret=${recaptchaSecret}&response=${token}`,
    }
  );

  const recaptchaData = await recaptchaResponse.json();

  // v2 Invisible → sadece success kontrol edilir
  if (!recaptchaData.success) {
    return res.status(403).json({ message: "reCAPTCHA verification failed" });
  }

  // 2️⃣ Shopify Customer oluşturma
  const shopDomain = process.env.SHOPIFY_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  try {
    const shopifyRes = await fetch(
      `https://${shopDomain}/admin/api/2024-10/customers.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": adminToken,
        },
        body: JSON.stringify({
          customer: {
            email: email,
            tags: "prospect, newsletter",
            verified_email: true,
          },
        }),
      }
    );

    const shopifyData = await shopifyRes.json();

    if (!shopifyRes.ok) {
      return res.status(shopifyRes.status).json({ message: shopifyData });
    }

    return res
      .status(200)
      .json({ message: "Customer created successfully" });
  } catch (err) {
    console.error("Server error:", err);
    return res.status(500).json({ message: "Server error" });
  }
}
