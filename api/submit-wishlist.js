import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body;

  if (!body.name || !body.email || !body.items?.length) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Escape all user-supplied strings before interpolating into email HTML
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));

  const name  = esc(body.name);
  const email = esc(body.email);
  const phone = esc(body.phone);
  const notes = esc(body.notes);
  const total_plants = parseInt(body.total_plants) || 0;
  const total_units  = parseInt(body.total_units) || 0;
  const items = body.items.map(item => ({
    qty: parseInt(item.qty) || 1,
    size: esc(item.size),
    plant: { name: esc(item.plant?.name), category: esc(item.plant?.category) },
  }));

  // Build the plant rows HTML
  const plantRows = items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#f8f4ec' : '#ffffff'}">
      <td style="padding:10px 14px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#1a2e1a;border-bottom:1px solid #ede6d6;">
        <strong style="font-family:Georgia,serif;font-size:14px;">${item.plant.name}</strong><br>
        <span style="font-size:11px;color:#6b8f63;text-transform:uppercase;letter-spacing:.08em;">${item.plant.category}</span>
      </td>
      <td style="padding:10px 14px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#3d5c38;text-align:center;border-bottom:1px solid #ede6d6;">
        ${item.qty}
      </td>
      <td style="padding:10px 14px;font-family:'DM Sans',Arial,sans-serif;font-size:13px;color:#3d5c38;border-bottom:1px solid #ede6d6;">
        ${item.size && item.size !== 'Any / Not Sure' ? item.size : '<span style="color:#6b8f63">Any / Not Sure</span>'}
      </td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0ebe0;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0ebe0;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr>
          <td style="background:#1a2e1a;border-radius:12px 12px 0 0;padding:28px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td>
                  <div style="display:inline-block;width:36px;height:36px;background:#4a7c3f;border-radius:50% 50% 50% 0;transform:rotate(-45deg);vertical-align:middle;margin-right:12px;"></div>
                  <span style="font-family:Georgia,serif;font-size:20px;color:#ffffff;font-weight:bold;vertical-align:middle;">Plant Wizard</span>
                  <span style="display:block;font-size:10px;color:#c8dfc0;letter-spacing:.12em;text-transform:uppercase;margin-top:2px;margin-left:48px;">by Nature's Cradle</span>
                </td>
                <td align="right">
                  <span style="background:#4a7c3f;color:#ffffff;font-size:11px;font-weight:700;padding:6px 14px;border-radius:20px;letter-spacing:.05em;">NEW WISHLIST</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Subheader -->
        <tr>
          <td style="background:#2d5a27;padding:14px 32px;">
            <p style="margin:0;color:#c8dfc0;font-size:13px;font-family:Arial,sans-serif;">
              A customer has submitted their plant wishlist and is ready to be contacted.
            </p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="background:#ffffff;padding:28px 32px;">

            <!-- Customer info -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
              <tr>
                <td colspan="2" style="padding-bottom:10px;border-bottom:2px solid #eef4eb;margin-bottom:12px;">
                  <span style="font-family:Georgia,serif;font-size:16px;color:#1a2e1a;font-weight:bold;">Customer Information</span>
                </td>
              </tr>
              <tr><td height="12"></td></tr>
              <tr>
                <td width="50%" style="padding:6px 0;">
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Name</span><br>
                  <span style="font-size:15px;color:#1a2e1a;font-weight:bold;font-family:Arial,sans-serif;">${name}</span>
                </td>
                <td width="50%" style="padding:6px 0;">
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Email</span><br>
                  <a href="mailto:${email}" style="font-size:15px;color:#2d5a27;font-weight:bold;font-family:Arial,sans-serif;text-decoration:none;">${email}</a>
                </td>
              </tr>
              <tr>
                <td style="padding:6px 0;">
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Phone</span><br>
                  <span style="font-size:15px;color:#1a2e1a;font-family:Arial,sans-serif;">${phone || 'Not provided'}</span>
                </td>
                <td style="padding:6px 0;">
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Notes</span><br>
                  <span style="font-size:14px;color:#3d5c38;font-family:Arial,sans-serif;">${notes || 'None'}</span>
                </td>
              </tr>
            </table>

            <!-- Summary chips -->
            <table cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
              <tr>
                <td style="background:#eef4eb;border:1px solid #c8dfc0;border-radius:8px;padding:10px 18px;margin-right:10px;">
                  <span style="font-size:22px;font-weight:bold;color:#1a2e1a;font-family:Georgia,serif;">${total_plants}</span><br>
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Plant Varieties</span>
                </td>
                <td width="10"></td>
                <td style="background:#eef4eb;border:1px solid #c8dfc0;border-radius:8px;padding:10px 18px;">
                  <span style="font-size:22px;font-weight:bold;color:#1a2e1a;font-family:Georgia,serif;">${total_units}</span><br>
                  <span style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#6b8f63;font-family:Arial,sans-serif;">Total Units</span>
                </td>
              </tr>
            </table>

            <!-- Plant table -->
            <span style="font-family:Georgia,serif;font-size:16px;color:#1a2e1a;font-weight:bold;display:block;margin-bottom:12px;padding-bottom:10px;border-bottom:2px solid #eef4eb;">Wishlist</span>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #ede6d6;">
              <tr style="background:#2d5a27;">
                <th style="padding:10px 14px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#c8dfc0;text-align:left;font-weight:600;">Plant</th>
                <th style="padding:10px 14px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#c8dfc0;text-align:center;font-weight:600;">Qty</th>
                <th style="padding:10px 14px;font-family:Arial,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#c8dfc0;text-align:left;font-weight:600;">Size</th>
              </tr>
              ${plantRows}
            </table>

          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td style="background:#f8f4ec;padding:20px 32px;text-align:center;border-top:1px solid #ede6d6;">
            <a href="mailto:${email}?subject=Re: Your Plant Wizard Wishlist"
               style="display:inline-block;background:#1a2e1a;color:#ffffff;font-family:Arial,sans-serif;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:24px;text-decoration:none;letter-spacing:.03em;">
              Reply to ${name.split(' ')[0]} →
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#1a2e1a;border-radius:0 0 12px 12px;padding:18px 32px;">
            <p style="margin:0;color:#c8dfc0;font-size:11px;font-family:Arial,sans-serif;text-align:center;">
              Nature's Cradle Nursery &amp; Landscape Design · 55 Mill Road, Eastchester NY · (914) 779-8723
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>
  `;

  try {
    await resend.emails.send({
      from:     'Plant Wizard <onboarding@resend.dev>',
      to:       ['estevan400@gmail.com'],
      replyTo:  body.email,
      subject:  `🌿 New Wishlist — ${body.name} (${total_plants} plant${total_plants !== 1 ? 's' : ''})`,
      html,
    });

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Resend error:', err);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
