/**
 * src/lib/emailService.js
 * Client-side proxy to call our secure internal API route.
 */
import { collection, getDocs } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Helper to generate the base HTML layout for all emails.
 */
function getBaseHtmlTemplate(headerColor, headerTitle, headerSubtitle, contentHtml, footerText, buttonHtml = "") {
  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 0; margin: 0; color: #333; line-height: 1.6; background-color: #F5F5F5;">
        <div style="max-width: 600px; margin: 20px auto; background-color: #FFFFFF; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1); border: 1px solid #E0E0E0;">
            <!-- Header -->
            <div style="background-color: ${headerColor}; padding: 30px; text-align: center;">
                <h1 style="color: #FFFFFF; margin: 0; font-size: 24px; letter-spacing: 1px;">${headerTitle}</h1>
                <p style="color: #FFFFFF; opacity: 0.85; margin: 8px 0 0 0; font-size: 14px;">${headerSubtitle}</p>
            </div>
            
            <!-- Content Body -->
            <div style="padding: 35px;">
                ${contentHtml}
                
                ${buttonHtml ? `
                    <div style="text-align: center; margin: 35px 0 10px 0;">
                        ${buttonHtml}
                    </div>
                ` : ""}
                
                <hr style="border: none; border-top: 1px solid #EEEEEE; margin: 30px 0;" />
                
                <!-- Footer -->
                <div style="font-size: 12px; color: #999; text-align: center;">
                    <p style="margin: 5px 0;"><strong>Balik-Calasiao</strong> | Official Community Service App</p>
                    <p style="margin: 5px 0; font-style: italic;">${footerText}</p>
                </div>
            </div>
        </div>
    </div>
  `;
}

/**
 * Core function to proxy to the server-side API Route.
 */
async function sendEmailProxy(toEmail, toName, subject, htmlContent) {
  try {
    const response = await fetch('/api/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toEmail, toName, subject, htmlContent })
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Email Send Error:', data.error);
      return false;
    }

    console.log('Email sent successfully:', data.messageId);
    return true;
  } catch (err) {
    console.error('Email Proxy Error:', err.message);
    return false;
  }
}

/**
 * Notifies a user of a new chat message
 */
export async function sendNewMessageNotification(receiverEmail, senderName, messageText) {
  if (!receiverEmail) return;
  const timestamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });

  const content = `
    <p style="font-size: 16px; margin-top: 0;">Hi there,</p>
    <p><strong>${senderName}</strong> has sent you a direct message regarding your active report.</p>
    
    <div style="background-color: #F9F9F9; border-left: 4px solid #2E7D32; padding: 20px; margin: 25px 0; color: #444; font-style: italic;">
        "${messageText}"
    </div>

    <p>To reply, please open the <strong>Balik-Calasiao</strong> mobile application on your device.</p>
  `;

  const html = getBaseHtmlTemplate(
    "#2E7D32",
    "📩 New Message Received",
    `Received on ${timestamp}`,
    content,
    "This is an automated notification. For your security, do not share your login credentials.",
    `<p style="font-weight: bold; color: #2E7D32;">Check your "Messages" tab inside the app.</p>`
  );

  return sendEmailProxy(receiverEmail, "", `New Message from ${senderName}`, html);
}

/**
 * Sends an alert to all accounts in the 'admins' collection
 */
export async function sendAdminNotification(type, itemName, reporterName, reporterEmail, details) {
  try {
    const snap = await getDocs(collection(db, 'admins'));
    const emails = snap.docs.map(d => d.data().email).filter(e => !!e);

    const timestamp = new Date().toLocaleString('en-US', { 
      month: 'short', day: 'numeric', year: 'numeric', 
      hour: 'numeric', minute: 'numeric', second: 'numeric', 
      hour12: true 
    });

    const content = `
        <p style="font-size: 16px; margin-top: 0; color: #C62828; font-weight: bold;">High Priority Task Detected</p>
        <p>The system has logged a new activity that requires administrative review within the Balik-Calasiao platform.</p>
        
        <table style="width: 100%; margin: 25px 0; border-collapse: collapse; font-size: 14px;">
            <tr style="background-color: #F9F9F9;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #EEEEEE; width: 140px;">Activity Type:</td>
                <td style="padding: 12px; border-bottom: 1px solid #EEEEEE;">
                    <span style="background-color: #FFEBEE; color: #C62828; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; text-transform: uppercase;">${type}</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #EEEEEE;">Related Item:</td>
                <td style="padding: 12px; border-bottom: 1px solid #EEEEEE;">${itemName}</td>
            </tr>
            <tr style="background-color: #F9F9F9;">
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #EEEEEE;">Reported By:</td>
                <td style="padding: 12px; border-bottom: 1px solid #EEEEEE;">${reporterName}</td>
            </tr>
            <tr>
                <td style="padding: 12px; font-weight: bold; border-bottom: 1px solid #EEEEEE;">Contact Email:</td>
                <td style="padding: 12px; border-bottom: 1px solid #EEEEEE; color: #C62828; font-weight: bold;">${reporterEmail || 'Unknown'}</td>
            </tr>
        </table>

        <div style="background-color: #F5F5F5; border-left: 5px solid #757575; padding: 20px; margin: 25px 0; border-radius: 4px;">
            <h3 style="margin: 0 0 10px 0; color: #424242; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Actionable Details:</h3>
            <p style="margin: 0; color: #616161; font-size: 15px;">${details}</p>
        </div>
    `;

    const html = getBaseHtmlTemplate(
      "#C62828",
      "🚨 System Alert",
      `Automated System Notification | ${timestamp}`,
      content,
      "This is a system-generated broadcast sent to all station administrators.",
      `<a href="https://balikcalasiao.web.app/dashboard" style="background-color: #1B5E20; color: #FFFFFF; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 5px rgba(0,0,0,0.1);">Login to Admin Dashboard</a>`
    );

    for (const email of emails) {
      await sendEmailProxy(email, "Official Admin", `🚨 System Alert: ${type} - ${itemName}`, html);
    }
  } catch (err) {
    console.error("Failed to broadcast admin notification:", err);
  }
}

/**
 * Notify user about claim status changes.
 */
export async function sendClaimStatusNotification(receiverEmail, itemName, status) {
  if (!receiverEmail) return;

  const isApproved = status.toUpperCase() === "APPROVED";
  const headerColor = isApproved ? "#2E7D32" : "#C62828";
  const statusLabel = isApproved ? "APPROVED ✅" : "REJECTED ❌";
  
  const content = `
    <p style="font-size: 16px; margin-top: 0;">Hello Citizen,</p>
    <p>This is an official update regarding your filed claim for the item: <strong>${itemName}</strong>.</p>
    
    <div style="background-color: ${isApproved ? "#F1F8E9" : "#FFEBEE"}; border-left: 5px solid ${headerColor}; padding: 20px; margin: 25px 0;">
        <p style="margin: 0; font-weight: bold; color: ${isApproved ? "#2E7D32" : "#C62828"};">
            STATUS: ${statusLabel}
        </p>
        <p style="margin: 5px 0 0 0; color: #555; font-size: 15px;">
            ${isApproved 
                ? "Your claim has been verified and approved by the station administrator." 
                : "Your claim has been reviewed and was unfortunately rejected."}
        </p>
    </div>

    ${isApproved ? `
        <h3 style="color: #333; font-size: 16px; margin-bottom: 10px;">Steps for Retrieval:</h3>
        <ol style="padding-left: 20px; color: #555;">
            <li style="margin-bottom: 8px;">Proceed to the <strong>Calasiao Police Station</strong> lobby.</li>
            <li style="margin-bottom: 8px;">Bring a <strong>Valid Government ID</strong> for identity verification.</li>
            <li style="margin-bottom: 8px;">Present your <strong>Claim Reference ID</strong> to the officer on duty.</li>
        </ol>
        <p style="font-size: 13px; color: #777; margin-top: 15px; background: #F9F9F9; padding: 10px; border-radius: 4px; display: inline-block;">
            🕒 Station hours: 8:00 AM - 5:00 PM, Mon-Fri
        </p>
    ` : `
        <p>If you believe this decision was made in error, please visit the Calasiao Police Station to speak with an administrator or file a formal dispute through the app.</p>
    `}
  `;

  const html = getBaseHtmlTemplate(
    headerColor,
    "Claim Resolution",
    `Case Update: ${itemName}`,
    content,
    "Calasiao Police Department - Community Relations Division"
  );

  return sendEmailProxy(receiverEmail, "", `Update: Your claim for ${itemName} has been ${status}`, html);
}
