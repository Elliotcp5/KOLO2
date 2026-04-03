"""
KOLO Email Service - Transactional and Marketing Emails
Uses Resend API for email delivery
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Email templates
def get_welcome_email_html(user_name: str, is_trial: bool = False, trial_plan: str = "pro") -> str:
    """Welcome email for new accounts"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    if is_trial:
        features_html = """
        <div style="background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(147,51,234,0.1)); border-radius: 16px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #6C63FF; margin: 0 0 16px 0; font-size: 18px;">🎁 Votre essai {plan_name} inclut :</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li><strong>Prospects illimités</strong> — ajoutez tous vos contacts</li>
                <li><strong>Suggestions IA illimitées</strong> — ne manquez plus aucune relance</li>
                <li><strong>SMS 1-clic</strong> — messages rédigés par l'IA</li>
                {pro_plus_features}
            </ul>
        </div>
        """.format(
            plan_name=plan_name,
            pro_plus_features='<li><strong>Score de chaleur</strong> — identifiez vos prospects chauds</li><li><strong>Dashboard ROI</strong> — suivez vos commissions</li>' if trial_plan == "pro_plus" else ''
        )
        
        cta_text = "Découvrir KOLO"
        subtitle = f"Votre essai gratuit {plan_name} de 14 jours commence maintenant."
    else:
        features_html = """
        <div style="background: #f7f7fa; border-radius: 16px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #0E0B1E; margin: 0 0 16px 0; font-size: 18px;">✨ Avec KOLO Starter, vous pouvez :</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                <li>Gérer jusqu'à <strong>30 prospects</strong></li>
                <li>Recevoir <strong>1 suggestion IA par jour</strong></li>
                <li>Organiser vos <strong>tâches et suivis</strong></li>
            </ul>
        </div>
        """
        cta_text = "Commencer maintenant"
        subtitle = "Bienvenue dans votre nouvel assistant commercial."
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7fa; margin: 0; padding: 40px 20px;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 800; color: #6C63FF; margin: 0;">KOLO</h1>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 24px; margin: 0 0 8px 0;">Bienvenue {user_name} ! 👋</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">{subtitle}</p>
            
            {features_html}
            
            <a href="https://app.trykolo.io/app" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">{cta_text}</a>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                Une question ? Répondez simplement à cet email.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 KOLO · <a href="https://trykolo.io" style="color: #6C63FF; text-decoration: none;">trykolo.io</a>
            </p>
        </div>
    </body>
    </html>
    """


def get_trial_reminder_email_html(user_name: str, days_left: int, trial_plan: str = "pro") -> str:
    """Trial reminder emails (J+7, J+12)"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    if days_left == 7:
        title = f"Il vous reste 7 jours d'essai {plan_name}"
        subtitle = "Voici ce que vous avez déjà accompli avec KOLO !"
        urgency_color = "#f59e0b"  # Orange
    elif days_left == 2:
        title = f"Plus que 2 jours pour profiter de {plan_name}"
        subtitle = "Ne perdez pas vos avantages premium !"
        urgency_color = "#ef4444"  # Red
    else:
        title = f"Votre essai {plan_name} se termine bientôt"
        subtitle = f"Il vous reste {days_left} jours."
        urgency_color = "#6C63FF"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7fa; margin: 0; padding: 40px 20px;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 800; color: #6C63FF; margin: 0;">KOLO</h1>
            </div>
            
            <div style="background: {urgency_color}; color: white; text-align: center; padding: 12px 20px; border-radius: 12px; margin-bottom: 24px;">
                <span style="font-size: 14px; font-weight: 600;">⏰ {days_left} jours restants</span>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">{title}</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">Bonjour {user_name}, {subtitle}</p>
            
            <div style="background: #f7f7fa; border-radius: 16px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #0E0B1E; margin: 0 0 16px 0; font-size: 16px;">Ce que vous perdrez en passant en Starter :</h3>
                <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>❌ Prospects illimités → limité à 30</li>
                    <li>❌ Suggestions IA illimitées → 1/jour</li>
                    <li>❌ SMS 1-clic rédigés par l'IA</li>
                    {'<li>❌ Score de chaleur et Dashboard ROI</li>' if trial_plan == "pro_plus" else ''}
                </ul>
            </div>
            
            <a href="https://app.trykolo.io/pricing" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">Passer en {plan_name} — {"24,99" if trial_plan == "pro_plus" else "9,99"}€/mois</a>
            
            <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 16px 0 0 0;">
                Ou continuez gratuitement avec Starter (30 prospects max)
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 KOLO · <a href="https://trykolo.io" style="color: #6C63FF; text-decoration: none;">trykolo.io</a>
            </p>
        </div>
    </body>
    </html>
    """


def get_trial_expired_email_html(user_name: str, trial_plan: str = "pro") -> str:
    """Trial expiration email (J+14)"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7fa; margin: 0; padding: 40px 20px;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 800; color: #6C63FF; margin: 0;">KOLO</h1>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">Votre essai {plan_name} est terminé</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">Bonjour {user_name}, merci d'avoir essayé KOLO {plan_name} !</p>
            
            <div style="background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(147,51,234,0.1)); border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="color: #374151; margin: 0 0 16px 0; font-size: 15px;">
                    <strong>Vos données sont conservées.</strong><br>
                    Passez en {plan_name} à tout moment pour retrouver vos prospects et fonctionnalités.
                </p>
            </div>
            
            <a href="https://app.trykolo.io/pricing" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">Passer en {plan_name}</a>
            
            <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 16px 0 0 0;">
                Vous êtes automatiquement passé en Starter (gratuit, 30 prospects max)
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 KOLO · <a href="https://trykolo.io" style="color: #6C63FF; text-decoration: none;">trykolo.io</a>
            </p>
        </div>
    </body>
    </html>
    """


def get_password_reset_email_html(user_name: str, reset_link: str) -> str:
    """Password reset email"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f7f7fa; margin: 0; padding: 40px 20px;">
        <div style="max-width: 520px; margin: 0 auto; background: white; border-radius: 24px; padding: 40px; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 28px; font-weight: 800; color: #6C63FF; margin: 0;">KOLO</h1>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">Réinitialiser votre mot de passe</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">Bonjour {user_name}, vous avez demandé à réinitialiser votre mot de passe.</p>
            
            <a href="{reset_link}" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">Créer un nouveau mot de passe</a>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                Ce lien expire dans 1 heure.<br>
                Si vous n'avez pas fait cette demande, ignorez cet email.
            </p>
        </div>
        
        <div style="text-align: center; margin-top: 24px;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © 2026 KOLO · <a href="https://trykolo.io" style="color: #6C63FF; text-decoration: none;">trykolo.io</a>
            </p>
        </div>
    </body>
    </html>
    """


async def send_email(to_email: str, subject: str, html_content: str) -> dict:
    """Send email via Resend API"""
    import resend
    
    resend_api_key = os.environ.get("RESEND_API_KEY")
    sender_email = os.environ.get("SENDER_EMAIL", "contact@trykolo.io")
    
    if not resend_api_key:
        logger.error("RESEND_API_KEY not configured")
        return {"success": False, "error": "Email service not configured"}
    
    try:
        resend.api_key = resend_api_key
        
        params = {
            "from": f"KOLO <{sender_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        result = resend.Emails.send(params)
        logger.info(f"Email sent to {to_email}: {subject}")
        return {"success": True, "id": result.get("id") if isinstance(result, dict) else str(result)}
        
    except Exception as e:
        logger.error(f"Failed to send email to {to_email}: {e}")
        return {"success": False, "error": str(e)}


async def send_welcome_email(to_email: str, user_name: str, is_trial: bool = False, trial_plan: str = "pro") -> dict:
    """Send welcome email to new user"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    if is_trial:
        subject = f"🎉 Bienvenue dans votre essai KOLO {plan_name}"
    else:
        subject = "🎉 Bienvenue sur KOLO !"
    
    html = get_welcome_email_html(user_name, is_trial, trial_plan)
    return await send_email(to_email, subject, html)


async def send_trial_reminder_email(to_email: str, user_name: str, days_left: int, trial_plan: str = "pro") -> dict:
    """Send trial reminder email"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    if days_left == 7:
        subject = f"⏰ Il vous reste 7 jours d'essai {plan_name}"
    elif days_left == 2:
        subject = f"⚠️ Plus que 2 jours pour profiter de KOLO {plan_name}"
    else:
        subject = f"⏰ {days_left} jours restants sur votre essai {plan_name}"
    
    html = get_trial_reminder_email_html(user_name, days_left, trial_plan)
    return await send_email(to_email, subject, html)


async def send_trial_expired_email(to_email: str, user_name: str, trial_plan: str = "pro") -> dict:
    """Send trial expiration email"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    subject = f"Votre essai KOLO {plan_name} est terminé"
    
    html = get_trial_expired_email_html(user_name, trial_plan)
    return await send_email(to_email, subject, html)


async def send_password_reset_email(to_email: str, user_name: str, reset_token: str, base_url: str) -> dict:
    """Send password reset email"""
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    subject = "🔐 Réinitialiser votre mot de passe KOLO"
    
    html = get_password_reset_email_html(user_name, reset_link)
    return await send_email(to_email, subject, html)


async def send_subscription_confirmation_email(
    email: str, 
    name: str, 
    plan: str, 
    is_trial: bool = False,
    trial_end: Optional[datetime] = None,
    locale: str = "fr"
) -> dict:
    """Send subscription/trial confirmation email"""
    plan_display = "Pro+" if plan == "pro_plus" else "Pro"
    
    if locale == "fr":
        if is_trial:
            subject = f"🎉 Votre essai {plan_display} est activé !"
            days_left = (trial_end - datetime.now(timezone.utc)).days if trial_end else 7
            message = f"Bienvenue {name} ! Votre essai gratuit {plan_display} de {days_left} jours est maintenant actif."
            features_title = f"Votre essai {plan_display} inclut :"
        else:
            subject = f"✅ Bienvenue dans KOLO {plan_display} !"
            message = f"Merci {name} ! Votre abonnement {plan_display} est maintenant actif."
            features_title = f"Votre abonnement {plan_display} inclut :"
    else:
        if is_trial:
            subject = f"🎉 Your {plan_display} trial is active!"
            days_left = (trial_end - datetime.now(timezone.utc)).days if trial_end else 7
            message = f"Welcome {name}! Your {days_left}-day {plan_display} free trial is now active."
            features_title = f"Your {plan_display} trial includes:"
        else:
            subject = f"✅ Welcome to KOLO {plan_display}!"
            message = f"Thank you {name}! Your {plan_display} subscription is now active."
            features_title = f"Your {plan_display} subscription includes:"
    
    if plan == "pro_plus":
        features = [
            "Prospects illimités" if locale == "fr" else "Unlimited prospects",
            "Suggestions IA illimitées" if locale == "fr" else "Unlimited AI suggestions",
            "SMS 1-clic IA" if locale == "fr" else "1-click AI SMS",
            "Score de chaleur" if locale == "fr" else "Heat scores",
            "Dashboard ROI" if locale == "fr" else "ROI Dashboard",
            "Support prioritaire" if locale == "fr" else "Priority support"
        ]
    else:
        features = [
            "Prospects illimités" if locale == "fr" else "Unlimited prospects",
            "Suggestions IA illimitées" if locale == "fr" else "Unlimited AI suggestions",
            "SMS 1-clic IA" if locale == "fr" else "1-click AI SMS",
            "Historique des interactions" if locale == "fr" else "Interaction history"
        ]
    
    features_html = "".join([f"<li style='margin-bottom: 8px;'>✓ {f}</li>" for f in features])
    
    html = f"""
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px; background: #f7f7fa;">
        <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
            <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="color: #0E0B1E; font-size: 28px; margin: 0;">KOLO</h1>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin-bottom: 16px;">{subject.replace('🎉 ', '').replace('✅ ', '')}</h2>
            
            <p style="color: #374151; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
                {message}
            </p>
            
            <div style="background: linear-gradient(135deg, rgba(0,74,173,0.1), rgba(203,108,230,0.1)); border-radius: 12px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #004AAD; margin: 0 0 16px 0; font-size: 16px;">{features_title}</h3>
                <ul style="color: #374151; margin: 0; padding-left: 0; list-style: none; line-height: 1.8;">
                    {features_html}
                </ul>
            </div>
            
            <div style="text-align: center; margin-top: 32px;">
                <a href="https://app.kolo.io/app" style="display: inline-block; background: linear-gradient(135deg, #004AAD, #CB6CE6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 999px; font-weight: 600; font-size: 16px;">
                    {"Accéder à KOLO" if locale == "fr" else "Open KOLO"}
                </a>
            </div>
            
            <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">
                © 2026 KOLO.io LTD. {"Tous droits réservés." if locale == "fr" else "All rights reserved."}
            </p>
        </div>
    </body>
    </html>
    """
    
    return await send_email(email, subject, html)
