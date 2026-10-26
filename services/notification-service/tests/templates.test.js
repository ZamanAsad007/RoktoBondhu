const {
  renderInApp,
  renderEmail,
  renderSms,
} = require('../src/templates/notificationTemplates');

describe('Notification Templates (Section 7)', () => {
  const samplePayload = {
    requestId: 'req-123',
    patientName: 'Karim Rahman',
    bloodGroup: 'B+',
    unitsNeeded: 2,
    hospitalName: 'Dhaka Medical College Hospital',
    urgency: 'CRITICAL',
    neededBy: '2026-10-27T18:00:00Z',
    distanceKm: 3.5,
    donorName: 'Dr. Rafiqul',
    donorPhone: '+8801712345678',
  };

  const sampleRecipient = {
    name: 'Asif Zaman',
    email: 'asif@example.com',
  };

  test('request.nearby renders for all 3 channels', () => {
    const inApp = renderInApp('request.nearby', samplePayload);
    expect(inApp.title).toContain('B+');
    expect(inApp.message).toContain('Dhaka Medical College Hospital');

    const email = renderEmail('request.nearby', samplePayload, sampleRecipient);
    expect(email.subject).toContain('Urgent Blood Request Nearby');
    expect(email.subject).toContain('B+');
    expect(email.html).toContain('Karim Rahman');
    expect(email.html).toContain('3.5 km');

    const sms = renderSms('request.nearby', samplePayload);
    expect(sms.message).toContain('[RoktoBondhu]');
    expect(sms.message).toContain('B+');
    expect(sms.message).toContain('Dhaka Medical College Hospital');
  });

  test('donor.accepted renders for in-app and email', () => {
    const inApp = renderInApp('donor.accepted', samplePayload);
    expect(inApp.title).toContain('Donor Accepted');
    expect(inApp.message).toContain('Dr. Rafiqul');

    const email = renderEmail('donor.accepted', samplePayload, sampleRecipient);
    expect(email.subject).toContain('Donor Accepted');
    expect(email.html).toContain('Dr. Rafiqul');
    expect(email.html).toContain('+8801712345678');
  });

  test('request.fulfilled renders for in-app and email', () => {
    const inApp = renderInApp('request.fulfilled', samplePayload);
    expect(inApp.title).toContain('Request Fulfilled');
    expect(inApp.message).toContain('Karim Rahman');

    const email = renderEmail('request.fulfilled', samplePayload, sampleRecipient);
    expect(email.subject).toContain('Blood Request Fulfilled');
    expect(email.html).toContain('confirmed');
  });

  test('request.expired renders for in-app and email', () => {
    const inApp = renderInApp('request.expired', samplePayload);
    expect(inApp.title).toContain('Request Expired');

    const email = renderEmail('request.expired', samplePayload, sampleRecipient);
    expect(email.subject).toContain('Blood Request Expired');
  });

  test('request.cancelled renders for in-app', () => {
    const inApp = renderInApp('request.cancelled', samplePayload);
    expect(inApp.title).toContain('Request Cancelled');
    expect(inApp.message).toContain('cancelled by the requester');
  });

  test('donation.reminder renders for in-app and mock SMS', () => {
    const inApp = renderInApp('donation.reminder', samplePayload);
    expect(inApp.title).toContain('Donation Reminder');
    expect(inApp.message).toContain('Karim Rahman');

    const sms = renderSms('donation.reminder', samplePayload);
    expect(sms.message).toContain('[RoktoBondhu] Reminder');
    expect(sms.message).toContain('Dhaka Medical College Hospital');
  });
});
