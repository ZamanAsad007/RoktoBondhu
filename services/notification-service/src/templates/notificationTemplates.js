/**
 * Notification templates for all channels and types defined in Section 7 of the design doc.
 */

function renderInApp(type, payload = {}) {
  switch (type) {
    case 'request.nearby':
      return {
        title: `Urgent: ${payload.bloodGroup || 'Blood'} Needed Nearby`,
        message: `Patient ${payload.patientName || 'in need'} requires ${payload.unitsNeeded || 1} unit(s) of ${payload.bloodGroup || ''} at ${payload.hospitalName || 'hospital'}.`,
        actionUrl: `/donor/requests/${payload.requestId}`,
      };

    case 'donor.accepted':
      return {
        title: `Donor Accepted Your Request!`,
        message: `${payload.donorName || 'A donor'} has accepted your blood request for ${payload.patientName || 'patient'}. Contact details are now available.`,
        actionUrl: `/requests/${payload.requestId}`,
      };

    case 'request.fulfilled':
      return {
        title: `Blood Request Fulfilled!`,
        message: `Great news! Blood request for ${payload.patientName || 'patient'} has been fulfilled with all required units.`,
        actionUrl: `/requests/${payload.requestId}`,
      };

    case 'request.expired':
      return {
        title: `Blood Request Expired`,
        message: `Your blood request for ${payload.patientName || 'patient'} (${payload.bloodGroup || ''}) has expired.`,
        actionUrl: `/requests/${payload.requestId}`,
      };

    case 'request.cancelled':
      return {
        title: `Blood Request Cancelled`,
        message: `The blood request for ${payload.patientName || 'patient'} at ${payload.hospitalName || 'hospital'} was cancelled by the requester.`,
        actionUrl: `/donor/feed`,
      };

    case 'donation.reminder':
      return {
        title: `Blood Donation Reminder`,
        message: `Reminder: You committed to donate blood for ${payload.patientName || 'patient'} at ${payload.hospitalName || 'hospital'}. Needed by ${payload.neededBy ? new Date(payload.neededBy).toLocaleString() : 'soon'}.`,
        actionUrl: `/donor/feed`,
      };

    default:
      return {
        title: `Notification`,
        message: `You have a new update.`,
        actionUrl: `/`,
      };
  }
}

function renderEmail(type, payload = {}, recipient = {}) {
  const recipientName = recipient.name || 'Friend';

  switch (type) {
    case 'request.nearby': {
      const subject = `Urgent Blood Request Nearby: ${payload.bloodGroup} needed at ${payload.hospitalName}`;
      const text = `Hello ${recipientName},\n\nA patient named ${payload.patientName || 'Anonymous'} urgently requires ${payload.unitsNeeded || 1} unit(s) of ${payload.bloodGroup} blood at ${payload.hospitalName}.\nDistance: approx ${payload.distanceKm || '?'} km.\n\nPlease log in to RoktoBondhu to accept or decline: https://roktobondhu.org\n\nThank you,\nRoktoBondhu Team`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #e53935; margin-top: 0;">Urgent Blood Request Nearby</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>A nearby patient needs your help:</p>
          <div style="background-color: #fbe9e7; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Blood Group:</strong> <span style="font-size: 1.2em; color: #d32f2f;">${payload.bloodGroup}</span></p>
            <p style="margin: 4px 0;"><strong>Hospital:</strong> ${payload.hospitalName}</p>
            <p style="margin: 4px 0;"><strong>Patient:</strong> ${payload.patientName || 'Confidential'}</p>
            <p style="margin: 4px 0;"><strong>Units Needed:</strong> ${payload.unitsNeeded || 1}</p>
            <p style="margin: 4px 0;"><strong>Urgency:</strong> <span style="color: #d32f2f; font-weight: bold;">${payload.urgency || 'URGENT'}</span></p>
            <p style="margin: 4px 0;"><strong>Distance:</strong> approx ${payload.distanceKm || '?'} km away</p>
          </div>
          <p><a href="https://roktobondhu.org" style="background-color: #e53935; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View and Respond</a></p>
          <p style="color: #757575; font-size: 0.9em; margin-top: 24px;">Your contact details remain completely private until you choose to accept this request.</p>
        </div>
      `;
      return { subject, text, html };
    }

    case 'donor.accepted': {
      const subject = `Donor Accepted: ${payload.donorName || 'A donor'} has accepted your request!`;
      const text = `Hello ${recipientName},\n\nGreat news! Donor ${payload.donorName || 'A volunteer'} has accepted your blood request for ${payload.patientName}.\nDonor Phone: ${payload.donorPhone || 'View in app'}\n\nPlease coordinate with the donor promptly.\n\nRoktoBondhu Team`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2e7d32; margin-top: 0;">Donor Accepted Your Request!</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>A volunteer donor has just accepted your blood request for <strong>${payload.patientName}</strong> (${payload.bloodGroup}):</p>
          <div style="background-color: #e8f5e9; padding: 16px; border-radius: 6px; margin: 16px 0;">
            <p style="margin: 4px 0;"><strong>Donor Name:</strong> ${payload.donorName || 'Volunteer Donor'}</p>
            <p style="margin: 4px 0;"><strong>Donor Phone:</strong> ${payload.donorPhone || 'Visible in app'}</p>
            <p style="margin: 4px 0;"><strong>Hospital:</strong> ${payload.hospitalName}</p>
          </div>
          <p>Please contact the donor to confirm timing and hospital arrival.</p>
        </div>
      `;
      return { subject, text, html };
    }

    case 'request.fulfilled': {
      const subject = `Blood Request Fulfilled: ${payload.patientName}`;
      const text = `Hello ${recipientName},\n\nThe blood request for ${payload.patientName} (${payload.bloodGroup}) has reached its full quota of confirmed donors.\nThank you to all who responded!\n\nRoktoBondhu Team`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #2e7d32; margin-top: 0;">Request Fulfilled!</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>All required units of blood for <strong>${payload.patientName}</strong> at <strong>${payload.hospitalName}</strong> have now been confirmed.</p>
          <p>Every donation saves lives. Thank you for being a part of this mission.</p>
        </div>
      `;
      return { subject, text, html };
    }

    case 'request.expired': {
      const subject = `Blood Request Expired: ${payload.patientName}`;
      const text = `Hello ${recipientName},\n\nYour blood request for ${payload.patientName} (${payload.bloodGroup}) has expired.\nIf blood is still urgently needed, you may create a new request in the portal.\n\nRoktoBondhu Team`;
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h2 style="color: #d32f2f; margin-top: 0;">Blood Request Expired</h2>
          <p>Hello <strong>${recipientName}</strong>,</p>
          <p>Your blood request for <strong>${payload.patientName}</strong> has elapsed its target timeframe and is now closed.</p>
          <p>If you still need donors, please submit a new request on the platform.</p>
        </div>
      `;
      return { subject, text, html };
    }

    default: {
      return {
        subject: `Update from RoktoBondhu`,
        text: `Hello ${recipientName},\n\nYou have an update regarding blood donation activities.\n\nRoktoBondhu Team`,
        html: `<p>Hello ${recipientName}, you have an update on RoktoBondhu.</p>`,
      };
    }
  }
}

function renderSms(type, payload = {}) {
  switch (type) {
    case 'request.nearby':
      return {
        message: `[RoktoBondhu] Urgent: ${payload.bloodGroup || ''} blood needed at ${payload.hospitalName || 'hospital'}. Can you donate? Open app to accept: https://roktobondhu.org`,
      };

    case 'donation.reminder':
      return {
        message: `[RoktoBondhu] Reminder: Blood donation scheduled at ${payload.hospitalName || 'hospital'} for ${payload.patientName || 'patient'}. Needed by ${payload.neededBy ? new Date(payload.neededBy).toLocaleTimeString() : 'soon'}. Thank you!`,
      };

    default:
      return {
        message: `[RoktoBondhu] Update regarding your blood donation request. Please check the app.`,
      };
  }
}

module.exports = {
  renderInApp,
  renderEmail,
  renderSms,
};
