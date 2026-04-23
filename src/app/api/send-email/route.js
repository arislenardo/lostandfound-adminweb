import { NextResponse } from 'next/server';

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const VERIFIED_SENDER_EMAIL = "ladagaas.820.stud@cdd.edu.ph";
const SENDER_NAME = "Balik-Calasiao";

/**
 * Handles POST requests to send an email using the Brevo API.
 * @param {Request} request - The incoming HTTP request containing email details (toEmail, toName, subject, htmlContent).
 * @returns {NextResponse} The JSON response indicating success or failure.
 */
export async function POST(request) {
  try {
    const { toEmail, toName, subject, htmlContent } = await request.json();

    if (!BREVO_API_KEY) {
      return NextResponse.json({ error: 'API key missing' }, { status: 500 });
    }

    const toRecord = { email: toEmail };
    if (toName) {
      toRecord.name = toName;
    }

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: VERIFIED_SENDER_EMAIL },
        to: [toRecord],
        subject: subject,
        htmlContent: htmlContent
      })
    });

    const data = await response.json();

    if (response.ok) {
      return NextResponse.json({ success: true, messageId: data.messageId });
    } else {
      console.error('Brevo API Error:', data);
      return NextResponse.json({ error: data.message || 'Brevo error' }, { status: response.status });
    }
  } catch (err) {
    console.error('API Route Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
