const { bloodRequestService } = require('../services/bloodRequestService');
const { sendSuccess } = require('../utils/response');

class BloodRequestController {
  async createRequest(req, res, next) {
    try {
      const request = await bloodRequestService.createRequest(req.user, req.body);
      return sendSuccess(res, { request }, 201);
    } catch (err) {
      next(err);
    }
  }

  async getMyRequests(req, res, next) {
    try {
      const limit = parseInt(req.query.limit, 10) || 20;
      const offset = parseInt(req.query.offset, 10) || 0;
      const requests = await bloodRequestService.listMyRequests(req.user, { limit, offset });
      return sendSuccess(res, { requests });
    } catch (err) {
      next(err);
    }
  }

  async getNearbyRequests(req, res, next) {
    try {
      const requests = await bloodRequestService.getNearbyRequestsForDonor(req.user, req.query);
      return sendSuccess(res, { requests });
    } catch (err) {
      next(err);
    }
  }

  async getRequestById(req, res, next) {
    try {
      const request = await bloodRequestService.getRequestById(req.params.id, req.user);
      return sendSuccess(res, { request });
    } catch (err) {
      next(err);
    }
  }

  async cancelRequest(req, res, next) {
    try {
      const request = await bloodRequestService.cancelRequest(req.params.id, req.user);
      return sendSuccess(res, { request }, 200);
    } catch (err) {
      next(err);
    }
  }

  async confirmDonation(req, res, next) {
    try {
      const donation = await bloodRequestService.confirmDonation(
        req.params.id,
        req.params.matchId,
        req.user
      );
      return sendSuccess(res, { donation }, 200);
    } catch (err) {
      next(err);
    }
  }

  async escalate(req, res, next) {
    try {
      const request = await bloodRequestService.escalateRequest(req.params.id, req.user);
      return sendSuccess(res, { request }, 200);
    } catch (err) {
      next(err);
    }
  }

  async getByShareToken(req, res, next) {
    try {
      const bloodRequestRepository = require('../repositories/bloodRequestRepository');
      const request = await bloodRequestRepository.findByShareToken(req.params.shareToken);
      if (!request) {
        return res.status(404).json({
          success: false,
          error: { message: 'Emergency request not found' },
        });
      }
      return sendSuccess(res, { request }, 200);
    } catch (err) {
      next(err);
    }
  }

  async renderSharePage(req, res, next) {
    try {
      const { shareToken } = req.params;
      const bloodRequestRepository = require('../repositories/bloodRequestRepository');
      const request = await bloodRequestRepository.findByShareToken(shareToken);

      if (!request) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html><head><title>Request Not Found - RoktoBondhu</title></head>
          <body style="font-family:sans-serif;text-align:center;padding:50px;">
            <h2>Emergency Blood Request Not Found</h2>
            <p>This request may have expired or was cancelled.</p>
            <a href="/" style="color:#b91c1c;">Go to RoktoBondhu Home</a>
          </body></html>
        `);
      }

      const title = `${request.is_sos ? '🚨 [SOS EMERGENCY] ' : '🩸 Urgent: '}${request.blood_group} Blood Needed in ${request.city || 'Bangladesh'}`;
      const description = `${request.units_needed} unit(s) of ${request.blood_group} needed urgently at ${request.hospital_name || 'Hospital'}. Can you donate or share?`;
      const url = `https://roktobondhu.org/s/${request.share_token}`;
      const statusColor = request.is_sos ? '#dc2626' : '#b91c1c';

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph / Facebook / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${url}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="https://roktobondhu.org/images/og-blood-request.png" />

  <!-- Twitter -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:url" content="${url}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />

  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 20px; }
    .card { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); overflow: hidden; }
    .banner { background: ${statusColor}; color: white; padding: 18px 24px; text-align: center; }
    .badge { display: inline-block; background: #fee2e2; color: #991b1b; padding: 4px 12px; border-radius: 9999px; font-weight: 700; font-size: 14px; }
    .content { padding: 24px; }
    .blood-group { font-size: 48px; font-weight: 900; color: #b91c1c; margin: 12px 0 4px; }
    .btn { display: inline-block; width: 100%; box-sizing: border-box; background: #b91c1c; color: white; padding: 14px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; text-align: center; margin-top: 20px; }
    .btn-share { background: #2563eb; margin-top: 10px; }
    .info-row { display: flex; justify-content: space-between; border-bottom: 1px solid #f1f5f9; padding: 10px 0; font-size: 15px; }
    .privacy-notice { font-size: 12px; color: #64748b; background: #f8fafc; padding: 10px 14px; border-radius: 6px; margin-top: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="banner">
      <h2 style="margin:0;font-size:1.3rem;">${request.is_sos ? '🚨 CRITICAL SOS EMERGENCY' : '🩸 Blood Donation Appeal'}</h2>
      <p style="margin:4px 0 0;font-size:0.9rem;opacity:0.9;">Verified emergency request on RoktoBondhu</p>
    </div>
    <div class="content">
      <div style="text-align:center;">
        <span class="badge">${request.urgency} URGENCY</span>
        <div class="blood-group">${request.blood_group}</div>
        <p style="color:#64748b;margin:0 0 16px;"><strong>${request.units_needed} unit(s)</strong> needed (${request.accepted_count || 0} accepted)</p>
      </div>

      <div class="info-row"><span>Hospital:</span><strong>${request.hospital_name || 'Hospital Area'}</strong></div>
      <div class="info-row"><span>Location:</span><strong>${request.city || 'Dhaka, Bangladesh'}</strong></div>
      <div class="info-row"><span>Status:</span><strong>${request.status}</strong></div>

      <div class="privacy-notice">
        🔒 <strong>Patient Privacy Protected:</strong> Patient name and contact number are never shown publicly to prevent scams and protect patient dignity. Contact details are revealed securely to donors who accept the request.
      </div>

      <a href="/register?redirect=/s/${request.share_token}" class="btn">I Can Donate Blood</a>
      <a href="https://wa.me/?text=${encodeURIComponent(description + ' ' + url)}" target="_blank" class="btn btn-share">Share on WhatsApp</a>
    </div>
  </div>
</body>
</html>`;

      return res.status(200).send(html);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BloodRequestController();
