// api/newsletter.js
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'https://www.rugreform.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Preflight request için
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { email, token } = req.body;

  if (!email || !token) {
    return res.status(400).json({ success: false, message: 'Missing email or token' });
  }

  // 1️⃣ Google reCAPTCHA doğrulaması
  const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
  const recaptchaResponse = await fetch(
    'https://www.google.com/recaptcha/api/siteverify',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${recaptchaSecret}&response=${token}`,
    }
  );
  const recaptchaData = await recaptchaResponse.json();

  if (!recaptchaData.success) {
    return res.status(403).json({ success: false, message: 'reCAPTCHA verification failed' });
  }

  // 2️⃣ Shopify Customer oluşturma
  const shopDomain = process.env.SHOPIFY_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  try {
    const shopifyRes = await fetch(
      `https://${shopDomain}/admin/api/2024-10/customers.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': adminToken,
        },
        body: JSON.stringify({
          customer: {
            email: email,
            tags: 'prospect, newsletter',
            verified_email: true,
          },
        }),
      }
    );

    const shopifyData = await shopifyRes.json();

    if (!shopifyRes.ok) {
      // Email zaten kayıtlı olabilir
      if (shopifyData.errors && shopifyData.errors.email) {
        return res.status(200).json({ success: true, message: 'You are already subscribed!' });
      }
      return res.status(shopifyRes.status).json({ success: false, message: shopifyData });
    }

    return res.status(200).json({ success: true, message: 'Customer created successfully' });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
}
