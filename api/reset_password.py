"""
Password Reset Email Service using SMTP_SSL (Port 465).
RFC 8314 Compliant: Implicit TLS connection from the first byte.
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional, Tuple

# Load environment variables
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / ".env"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass


def send_password_reset_email(to_email: str, reset_url: str, recipient_name: Optional[str] = None) -> Tuple[bool, str]:
    """
    Sends a high-grade HTML & plaintext password reset email via SMTP_SSL (port 465).
    Safely resolves SMTP host (auto-correcting common email typos in SMTP_HOST to smtp.gmail.com).
    Returns (success: bool, message: str).
    """
    raw_host = os.getenv("SMTP_HOST", "smtp.gmail.com").strip()
    # If host was set to an email address like user@gmail.com, route to smtp.gmail.com
    if "@" in raw_host:
        smtp_host = "smtp.gmail.com"
    else:
        smtp_host = raw_host

    try:
        smtp_port = int(os.getenv("SMTP_PORT", "465"))
    except ValueError:
        smtp_port = 465

    smtp_user = os.getenv("SMTP_USER", "").strip()
    smtp_password = os.getenv("SMTP_PASSWORD", "").strip()

    if not smtp_user or not smtp_password:
        return False, "Configuration SMTP incomplète (SMTP_USER ou SMTP_PASSWORD manquant)."

    name_display = recipient_name if recipient_name else "Utilisateur"

    # Construct MIMEMultipart message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "STEG Solar - Réinitialisation de votre mot de passe (Valable 4 minutes)"
    msg["From"] = f"STEG Solar Support <{smtp_user}>"
    msg["To"] = to_email

    # Plaintext fallback
    text_content = f"""Bonjour {name_display},

Une demande de réinitialisation de votre mot de passe a été initiée pour votre compte STEG Solar.

Veuillez cliquer sur le lien ci-dessous pour choisir votre nouveau mot de passe :
{reset_url}

ATTENTION : Ce lien est à usage unique et expirera dans exactement 4 minutes pour des raisons de sécurité.
Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.

Cordialement,
L'équipe STEG Solar Tunisie
"""

    # Modern dark/amber themed HTML email matching STEG Solar UI
    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Réinitialisation de mot de passe STEG</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f1f5f9;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #090d16; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="580" cellpadding="0" cellspacing="0" style="max-width: 580px; background-color: #0f172a; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; text-align: center; border-bottom: 1px solid #1e293b; background: linear-gradient(180deg, rgba(251,191,36,0.08) 0%, transparent 100%);">
              <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 12px; background: linear-gradient(135deg, #f59e0b, #ea580c); font-size: 24px; color: #0f172a; text-align: center; margin-bottom: 12px;">
                ☀️
              </div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #fbbf24;">STEG Solar Platform</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Système National de Prévision Solaire &amp; Stockage Batterie</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h2 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 600; color: #f8fafc;">Bonjour {name_display},</h2>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #cbd5e1;">
                Nous avons reçu une demande de réinitialisation de mot de passe pour votre compte STEG Solar. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :
              </p>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="{reset_url}" target="_blank" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #f59e0b, #ea580c); color: #090d16; font-size: 14px; font-weight: 700; text-decoration: none; border-radius: 10px; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.35);">
                  Réinitialiser mon mot de passe →
                </a>
              </div>

              <!-- Security Notice -->
              <div style="background-color: rgba(245, 158, 11, 0.08); border-left: 4px solid #f59e0b; padding: 14px 16px; border-radius: 6px; margin: 24px 0;">
                <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #fcd34d;">
                  ⏱️ <strong>Sécurité renforcée :</strong> Ce lien est à <strong>usage unique</strong> et expirera dans exactement <strong>4 minutes</strong>.<br>
                  Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.
                </p>
              </div>

              <p style="margin: 24px 0 8px 0; font-size: 12px; color: #64748b;">
                Si le bouton ne fonctionne pas, copiez-collez l'adresse suivante dans votre navigateur :
              </p>
              <p style="margin: 0; font-size: 11px; word-break: break-all; color: #fbbf24; font-family: monospace; background-color: #020617; padding: 10px; border-radius: 6px; border: 1px solid #1e293b;">
                {reset_url}
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #090d16; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Société Tunisienne de l'Électricité et du Gaz (STEG) &bull; Direction des Énergies Renouvelables
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

    msg.attach(MIMEText(text_content, "plain", "utf-8"))
    msg.attach(MIMEText(html_content, "html", "utf-8"))

    # Connect over SMTP_SSL (Port 465)
    print(f"[SMTP DEBUG] Attempting to send email to '{to_email}' via {smtp_host}:{smtp_port} using user '{smtp_user}'...")
    try:
        with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=15) as server:
            print("[SMTP DEBUG] Connected to SMTP_SSL server. Authenticating...")
            server.login(smtp_user, smtp_password)
            print("[SMTP DEBUG] Authentication successful. Sending message...")
            server.sendmail(smtp_user, [to_email], msg.as_string())
            print(f"[SMTP DEBUG] Email successfully delivered to {to_email}!")
        return True, "Email de réinitialisation envoyé avec succès via SMTP_SSL (port 465)."
    except Exception as e:
        err_msg = f"Erreur lors de l'envoi SMTP (port {smtp_port}) : {str(e)}"
        print(f"[SMTP ERROR] {err_msg}")
        return False, err_msg
