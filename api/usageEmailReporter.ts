import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';

export const TARGET_EMAIL = 'richard.repka@gmail.com';

export interface TTSUsageEntry {
  id: string;
  timestamp: string;
  charactersUsed: number;
  text: string;
  provider: string;
  voiceId: string;
  clientIp: string;
  userAgent: string;
  deviceSummary: string;
  deviceId: string;
}

export interface TTSUsageStorage {
  totalCharacters: number;
  totalAnnouncements: number;
  lastUpdated: string;
  byDevice: Record<string, { deviceSummary: string; count: number; characters: number; lastSeen: string }>;
  recentLogs: TTSUsageEntry[];
}

const STORAGE_PATH = path.join('/tmp', 'pelham_speechify_usage_data.json');

function loadStorage(): TTSUsageStorage {
  try {
    if (fs.existsSync(STORAGE_PATH)) {
      const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.totalCharacters === 'number') {
        return parsed;
      }
    }
  } catch (_) {}

  return {
    totalCharacters: 0,
    totalAnnouncements: 0,
    lastUpdated: new Date().toISOString(),
    byDevice: {},
    recentLogs: [],
  };
}

function saveStorage(data: TTSUsageStorage): void {
  try {
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (_) {}
}

/** Parse user-agent and client metadata into a detailed, friendly identity summary */
export function getFriendlyDeviceSummary(ua: string, clientInfo?: any): string {
  let dev = 'Web Client';
  if (/iPhone/i.test(ua)) {
    dev = 'Apple iPhone (iOS)';
  } else if (/iPad/i.test(ua)) {
    dev = 'Apple iPad (iPadOS)';
  } else if (/Macintosh/i.test(ua) || /Mac/i.test(clientInfo?.platform || '')) {
    dev = 'Apple Mac (macOS)';
  } else if (/Windows/i.test(ua) || /Win/i.test(clientInfo?.platform || '')) {
    dev = 'Windows PC';
  } else if (/Android/i.test(ua)) {
    dev = 'Android Device';
  } else if (/CrOS/i.test(ua)) {
    dev = 'ChromeOS Device';
  } else if (/Linux/i.test(ua)) {
    dev = 'Linux Device';
  } else if (clientInfo?.platform && clientInfo.platform !== 'Unknown') {
    dev = clientInfo.platform;
  }

  let browser = '';
  if (/Edg/i.test(ua)) browser = 'Edge';
  else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
  else if (/Firefox/i.test(ua)) browser = 'Firefox';

  const parts = [dev];
  if (browser) parts.push(browser);
  if (clientInfo?.timeZone && clientInfo.timeZone !== 'UTC') {
    const tzClean = clientInfo.timeZone.split('/').pop()?.replace(/_/g, ' ') || clientInfo.timeZone;
    parts.push(tzClean);
  }

  return parts.join(' • ');
}

/**
 * Sends the TTS usage report email to richard.repka@gmail.com
 */
async function sendUsageEmail(entry: TTSUsageEntry, storage: TTSUsageStorage): Promise<boolean> {
  const subject = `[Pelham Arena PA] ${entry.charactersUsed} chars used for TTS (${entry.deviceSummary})`;

  const textBody = `Pelham Pelicans Arena PA - TTS Usage Report

Target Recipient: ${TARGET_EMAIL}
TTS Engine: Speechify (Simba 3.2)
Voice ID: ${entry.voiceId}
Timestamp: ${entry.timestamp}

==================================================
1. WHO IS USING THE APP (USER & DEVICE DETAILS)
==================================================
• User Device: ${entry.deviceSummary}
• Device Unique Identifier: ${entry.deviceId}
• Client IP Address: ${entry.clientIp}
• Browser / User-Agent: ${entry.userAgent}

==================================================
2. CHARACTER USAGE (TTS METRICS)
==================================================
• Characters Used In This Call: ${entry.charactersUsed} characters
• Spoken Announcement Text: "${entry.text}"
• Voice Identifier: ${entry.voiceId} (Speechify Simba 3.2)

==================================================
3. CUMULATIVE STATS (RUNNING TOTALS)
==================================================
• All-Time Characters Consumed: ${storage.totalCharacters.toLocaleString()} characters
• Total Announcements Generated: ${storage.totalAnnouncements.toLocaleString()}
• Active Devices Tracked: ${Object.keys(storage.byDevice).length}

Per-Device Breakdown:
${Object.entries(storage.byDevice)
  .map(
    ([id, dev]) =>
      `- [${id.slice(0, 8)}] ${dev.deviceSummary}: ${dev.characters.toLocaleString()} chars across ${dev.count} calls (last seen: ${dev.lastSeen})`
  )
  .join('\n')}

Note: This report is delivered privately to ${TARGET_EMAIL} and is NOT displayed in the application UI.`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; padding: 24px; background: #0f172a; color: #f8fafc; border-radius: 12px; border: 1px solid #1e293b;">
      <div style="border-bottom: 2px solid #8b5cf6; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #a78bfa; font-size: 20px; text-transform: uppercase; letter-spacing: 0.05em;">Pelham Arena PA • TTS Usage Report</h2>
        <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 13px;">Speechify Simba 3.2 announcer activity notification</p>
      </div>

      <!-- Spoken Text Box -->
      <div style="background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 20px; border-left: 4px solid #a78bfa;">
        <div style="font-size: 12px; color: #94a3b8; text-transform: uppercase; font-weight: bold; margin-bottom: 6px;">Spoken Announcement Script</div>
        <div style="font-size: 16px; font-weight: 600; color: #ffffff; line-height: 1.4;">&ldquo;${entry.text}&rdquo;</div>
      </div>

      <!-- Detail Table -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: bold; width: 40%;">Characters Used:</td>
          <td style="padding: 10px 0; color: #38bdf8; font-weight: bold; font-size: 16px;">${entry.charactersUsed} characters</td>
        </tr>
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 8px 0; color: #94a3b8; font-weight: bold;">Who Is Using The App:</td>
          <td style="padding: 8px 0; color: #f8fafc; font-weight: 600;">${entry.deviceSummary}</td>
        </tr>
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 8px 0; color: #94a3b8; font-weight: bold;">Device Identifier:</td>
          <td style="padding: 8px 0; color: #cbd5e1; font-family: monospace; font-size: 12px;">${entry.deviceId}</td>
        </tr>
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 8px 0; color: #94a3b8; font-weight: bold;">Client IP Address:</td>
          <td style="padding: 8px 0; color: #cbd5e1; font-family: monospace;">${entry.clientIp}</td>
        </tr>
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 8px 0; color: #94a3b8; font-weight: bold;">Timestamp:</td>
          <td style="padding: 8px 0; color: #cbd5e1;">${entry.timestamp}</td>
        </tr>
        <tr style="border-bottom: 1px solid #334155;">
          <td style="padding: 8px 0; color: #94a3b8; font-weight: bold;">Speechify Voice ID:</td>
          <td style="padding: 8px 0; color: #a78bfa; font-family: monospace; font-size: 12px;">${entry.voiceId}</td>
        </tr>
      </table>

      <!-- Cumulative Stats Banner -->
      <div style="background: #090d16; border-radius: 8px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #1e293b;">
        <h3 style="margin: 0 0 12px 0; color: #f8fafc; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em;">Cumulative Character Usage (All Time)</h3>
        <div style="display: flex; gap: 32px;">
          <div>
            <div style="font-size: 24px; font-weight: bold; color: #38bdf8;">${storage.totalCharacters.toLocaleString()}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Total Characters</div>
          </div>
          <div style="margin-left: 24px;">
            <div style="font-size: 24px; font-weight: bold; color: #a78bfa;">${storage.totalAnnouncements.toLocaleString()}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Announcements</div>
          </div>
          <div style="margin-left: 24px;">
            <div style="font-size: 24px; font-weight: bold; color: #34d399;">${Object.keys(storage.byDevice).length}</div>
            <div style="font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600;">Active Devices</div>
          </div>
        </div>
      </div>

      <div style="font-size: 11px; color: #64748b; text-align: center; border-top: 1px solid #1e293b; padding-top: 12px;">
        Private notification dispatched to ${TARGET_EMAIL} • Pelham Hockey PA Tracker • Private logging (not visible in UI)
      </div>
    </div>
  `;

  let delivered = false;

  // 1. Direct FormSubmit HTTP Relay to TARGET_EMAIL
  try {
    const formSubmitRes = await fetch(`https://formsubmit.co/ajax/${TARGET_EMAIL}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        User_Device: entry.deviceSummary,
        Characters_Used: `${entry.charactersUsed} characters`,
        Spoken_Announcement: entry.text,
        Device_ID: entry.deviceId,
        Client_IP: entry.clientIp,
        Voice_ID: entry.voiceId,
        Timestamp: entry.timestamp,
        Cumulative_Total_Characters: `${storage.totalCharacters.toLocaleString()} characters`,
        Cumulative_Announcements: `${storage.totalAnnouncements.toLocaleString()}`,
      }),
    });
    if (formSubmitRes.ok) {
      console.log(`[UsageReporter] Delivered usage email via FormSubmit relay to ${TARGET_EMAIL}`);
      delivered = true;
    }
  } catch (e: any) {
    console.warn('[UsageReporter] FormSubmit relay attempt:', e?.message);
  }

  // 2. Try Resend API if RESEND_API_KEY is available
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (resendKey) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Pelham Arena PA <onboarding@resend.dev>',
          to: [TARGET_EMAIL],
          subject,
          text: textBody,
          html: htmlBody,
        }),
      });
      if (res.ok) {
        console.log(`[UsageReporter] Delivered usage email via Resend to ${TARGET_EMAIL}`);
        delivered = true;
      }
    } catch (e: any) {
      console.warn('[UsageReporter] Resend dispatch failed:', e?.message);
    }
  }

  // 3. Try SendGrid API if SENDGRID_API_KEY is available
  const sendgridKey = process.env.SENDGRID_API_KEY?.trim();
  if (sendgridKey) {
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${sendgridKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: TARGET_EMAIL }] }],
          from: { email: process.env.EMAIL_FROM || 'notifications@pelhampelicans.com', name: 'Pelham Arena PA' },
          subject,
          content: [
            { type: 'text/plain', value: textBody },
            { type: 'text/html', value: htmlBody },
          ],
        }),
      });
      if (res.ok) {
        console.log(`[UsageReporter] Delivered usage email via SendGrid to ${TARGET_EMAIL}`);
        delivered = true;
      }
    } catch (e: any) {
      console.warn('[UsageReporter] SendGrid dispatch failed:', e?.message);
    }
  }

  // 4. Try Brevo (Sendinblue) API if BREVO_API_KEY is available
  const brevoKey = process.env.BREVO_API_KEY?.trim();
  if (brevoKey) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: 'Pelham Arena PA', email: process.env.EMAIL_FROM || 'notifications@pelhampelicans.com' },
          to: [{ email: TARGET_EMAIL, name: 'Richard Repka' }],
          subject,
          htmlContent: htmlBody,
          textContent: textBody,
        }),
      });
      if (res.ok) {
        console.log(`[UsageReporter] Delivered usage email via Brevo to ${TARGET_EMAIL}`);
        delivered = true;
      }
    } catch (e: any) {
      console.warn('[UsageReporter] Brevo dispatch failed:', e?.message);
    }
  }

  // 5. Try Nodemailer with SMTP credentials if configured
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || process.env.GMAIL_APP_PASSWORD;

  if (smtpHost || (smtpUser && smtpPass)) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost || 'smtp.gmail.com',
        port: Number(process.env.SMTP_PORT || 465),
        secure: Number(process.env.SMTP_PORT || 465) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: smtpUser || `"Pelham Arena PA" <noreply@pelhampelicans.com>`,
        to: TARGET_EMAIL,
        subject,
        text: textBody,
        html: htmlBody,
      });

      console.log(`[UsageReporter] Delivered usage email via SMTP to ${TARGET_EMAIL}`);
      delivered = true;
    } catch (e: any) {
      console.warn('[UsageReporter] SMTP dispatch failed:', e?.message);
    }
  }

  console.log(`[UsageReporter] Recorded usage for ${TARGET_EMAIL}: ${entry.charactersUsed} chars by ${entry.deviceSummary} (Cumulative: ${storage.totalCharacters})`);
  return delivered;
}

/**
 * Record a TTS call and dispatch usage email to richard.repka@gmail.com
 */
export async function recordAndReportTTSUsage(params: {
  charactersUsed: number;
  text: string;
  provider: string;
  voiceId: string;
  clientIp: string;
  userAgent: string;
  clientInfo?: {
    deviceId?: string;
    platform?: string;
    screenResolution?: string;
  };
}): Promise<void> {
  try {
    const storage = loadStorage();
    const count = Math.max(0, params.charactersUsed || params.text.length);
    const deviceSummary = getFriendlyDeviceSummary(params.userAgent, params.clientInfo);
    const deviceId = params.clientInfo?.deviceId || params.clientIp || 'device-unknown';

    storage.totalCharacters += count;
    storage.totalAnnouncements += 1;
    storage.lastUpdated = new Date().toISOString();

    if (!storage.byDevice[deviceId]) {
      storage.byDevice[deviceId] = {
        deviceSummary,
        count: 0,
        characters: 0,
        lastSeen: new Date().toISOString(),
      };
    }

    storage.byDevice[deviceId].count += 1;
    storage.byDevice[deviceId].characters += count;
    storage.byDevice[deviceId].deviceSummary = deviceSummary;
    storage.byDevice[deviceId].lastSeen = new Date().toISOString();

    const entry: TTSUsageEntry = {
      id: `tts_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toLocaleString('en-US', { timeZoneName: 'short' }),
      charactersUsed: count,
      text: params.text,
      provider: params.provider,
      voiceId: params.voiceId,
      clientIp: params.clientIp,
      userAgent: params.userAgent,
      deviceSummary,
      deviceId,
    };

    storage.recentLogs.unshift(entry);
    if (storage.recentLogs.length > 50) {
      storage.recentLogs = storage.recentLogs.slice(0, 50);
    }

    saveStorage(storage);

    // Asynchronously dispatch email notification to richard.repka@gmail.com
    sendUsageEmail(entry, storage).catch((err) => {
      console.warn('[UsageReporter] Background email sending error:', err?.message);
    });
  } catch (err: any) {
    console.warn('[UsageReporter] Error recording TTS usage:', err?.message);
  }
}

export function getTTSUsageStats(): TTSUsageStorage {
  return loadStorage();
}
