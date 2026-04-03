"""
KOLO Email Service - Transactional and Marketing Emails
Uses Resend API for email delivery
"""

import os
import logging
from datetime import datetime, timezone
from typing import Optional

logger = logging.getLogger(__name__)

# Email templates - Localized content
EMAIL_CONTENT = {
    "fr": {
        "welcome_title": "Bienvenue {user_name} ! 👋",
        "welcome_subtitle_trial": "Votre essai gratuit {plan_name} de 14 jours commence maintenant.",
        "welcome_subtitle_free": "Bienvenue dans votre nouvel assistant commercial.",
        "trial_features_title": "🎁 Votre essai {plan_name} inclut :",
        "trial_features": [
            "<strong>Prospects illimités</strong> — ajoutez tous vos contacts",
            "<strong>Suggestions IA illimitées</strong> — ne manquez plus aucune relance",
            "<strong>SMS 1-clic</strong> — messages rédigés par l'IA"
        ],
        "trial_features_pro_plus": [
            "<strong>Score de chaleur</strong> — identifiez vos prospects chauds",
            "<strong>Dashboard ROI</strong> — suivez vos commissions"
        ],
        "free_features_title": "✨ Avec KOLO Starter, vous pouvez :",
        "free_features": [
            "Gérer jusqu'à <strong>30 prospects</strong>",
            "Recevoir <strong>1 suggestion IA par jour</strong>",
            "Organiser vos <strong>tâches et suivis</strong>"
        ],
        "cta_trial": "Découvrir KOLO",
        "cta_free": "Commencer maintenant",
        "footer_question": "Une question ? Répondez simplement à cet email.",
        "days_left": "{days} jours restants",
        "reminder_title_7": "Il vous reste 7 jours d'essai {plan_name}",
        "reminder_title_2": "Plus que 2 jours pour profiter de {plan_name}",
        "reminder_title_generic": "Votre essai {plan_name} se termine bientôt",
        "reminder_subtitle_7": "Voici ce que vous avez déjà accompli avec KOLO !",
        "reminder_subtitle_2": "Ne perdez pas vos avantages premium !",
        "reminder_subtitle_generic": "Il vous reste {days} jours.",
        "what_you_lose_title": "Ce que vous perdrez en passant en Starter :",
        "what_you_lose": [
            "❌ Prospects illimités → limité à 30",
            "❌ Suggestions IA illimitées → 1/jour",
            "❌ SMS 1-clic rédigés par l'IA"
        ],
        "what_you_lose_pro_plus": "❌ Score de chaleur et Dashboard ROI",
        "upgrade_cta": "Passer en {plan_name} — {price}€/mois",
        "continue_free": "Ou continuez gratuitement avec Starter (30 prospects max)",
        "expired_title": "Votre essai {plan_name} est terminé",
        "expired_subtitle": "merci d'avoir essayé KOLO {plan_name} !",
        "data_kept": "<strong>Vos données sont conservées.</strong><br>Passez en {plan_name} à tout moment pour retrouver vos prospects et fonctionnalités.",
        "expired_upgrade_cta": "Passer en {plan_name}",
        "expired_free_note": "Vous êtes automatiquement passé en Starter (gratuit, 30 prospects max)",
        "reset_title": "Réinitialiser votre mot de passe",
        "reset_subtitle": "vous avez demandé à réinitialiser votre mot de passe.",
        "reset_cta": "Créer un nouveau mot de passe",
        "reset_footer": "Ce lien expire dans 1 heure.<br>Si vous n'avez pas fait cette demande, ignorez cet email."
    },
    "en": {
        "welcome_title": "Welcome {user_name}! 👋",
        "welcome_subtitle_trial": "Your {plan_name} 14-day free trial starts now.",
        "welcome_subtitle_free": "Welcome to your new sales assistant.",
        "trial_features_title": "🎁 Your {plan_name} trial includes:",
        "trial_features": [
            "<strong>Unlimited prospects</strong> — add all your contacts",
            "<strong>Unlimited AI suggestions</strong> — never miss a follow-up",
            "<strong>1-click SMS</strong> — AI-written messages"
        ],
        "trial_features_pro_plus": [
            "<strong>Heat scores</strong> — identify your hot prospects",
            "<strong>ROI Dashboard</strong> — track your commissions"
        ],
        "free_features_title": "✨ With KOLO Starter, you can:",
        "free_features": [
            "Manage up to <strong>30 prospects</strong>",
            "Receive <strong>1 AI suggestion per day</strong>",
            "Organize your <strong>tasks and follow-ups</strong>"
        ],
        "cta_trial": "Discover KOLO",
        "cta_free": "Get started",
        "footer_question": "Have a question? Simply reply to this email.",
        "days_left": "{days} days remaining",
        "reminder_title_7": "7 days left in your {plan_name} trial",
        "reminder_title_2": "Only 2 days left to enjoy {plan_name}",
        "reminder_title_generic": "Your {plan_name} trial is ending soon",
        "reminder_subtitle_7": "Here's what you've already accomplished with KOLO!",
        "reminder_subtitle_2": "Don't lose your premium features!",
        "reminder_subtitle_generic": "You have {days} days left.",
        "what_you_lose_title": "What you'll lose by switching to Starter:",
        "what_you_lose": [
            "❌ Unlimited prospects → limited to 30",
            "❌ Unlimited AI suggestions → 1/day",
            "❌ 1-click AI SMS"
        ],
        "what_you_lose_pro_plus": "❌ Heat scores and ROI Dashboard",
        "upgrade_cta": "Upgrade to {plan_name} — ${price}/month",
        "continue_free": "Or continue free with Starter (30 prospects max)",
        "expired_title": "Your {plan_name} trial has ended",
        "expired_subtitle": "thank you for trying KOLO {plan_name}!",
        "data_kept": "<strong>Your data is preserved.</strong><br>Upgrade to {plan_name} anytime to recover your prospects and features.",
        "expired_upgrade_cta": "Upgrade to {plan_name}",
        "expired_free_note": "You've been automatically switched to Starter (free, 30 prospects max)",
        "reset_title": "Reset your password",
        "reset_subtitle": "you requested to reset your password.",
        "reset_cta": "Create a new password",
        "reset_footer": "This link expires in 1 hour.<br>If you didn't request this, ignore this email."
    },
    "de": {
        "welcome_title": "Willkommen {user_name}! 👋",
        "welcome_subtitle_trial": "Ihre {plan_name} 14-tägige Testphase beginnt jetzt.",
        "welcome_subtitle_free": "Willkommen bei Ihrem neuen Verkaufsassistenten.",
        "trial_features_title": "🎁 Ihre {plan_name} Testphase beinhaltet:",
        "trial_features": [
            "<strong>Unbegrenzte Interessenten</strong> — fügen Sie alle Ihre Kontakte hinzu",
            "<strong>Unbegrenzte KI-Vorschläge</strong> — verpassen Sie kein Follow-up",
            "<strong>1-Klick SMS</strong> — KI-geschriebene Nachrichten"
        ],
        "trial_features_pro_plus": [
            "<strong>Heat-Scores</strong> — identifizieren Sie Ihre heißen Interessenten",
            "<strong>ROI-Dashboard</strong> — verfolgen Sie Ihre Provisionen"
        ],
        "free_features_title": "✨ Mit KOLO Starter können Sie:",
        "free_features": [
            "Bis zu <strong>30 Interessenten</strong> verwalten",
            "<strong>1 KI-Vorschlag pro Tag</strong> erhalten",
            "Ihre <strong>Aufgaben und Nachverfolgungen</strong> organisieren"
        ],
        "cta_trial": "KOLO entdecken",
        "cta_free": "Jetzt starten",
        "footer_question": "Eine Frage? Antworten Sie einfach auf diese E-Mail.",
        "days_left": "Noch {days} Tage",
        "reminder_title_7": "Noch 7 Tage in Ihrer {plan_name} Testphase",
        "reminder_title_2": "Nur noch 2 Tage um {plan_name} zu genießen",
        "reminder_title_generic": "Ihre {plan_name} Testphase endet bald",
        "reminder_subtitle_7": "Hier ist, was Sie bereits mit KOLO erreicht haben!",
        "reminder_subtitle_2": "Verlieren Sie nicht Ihre Premium-Funktionen!",
        "reminder_subtitle_generic": "Sie haben noch {days} Tage.",
        "what_you_lose_title": "Was Sie beim Wechsel zu Starter verlieren:",
        "what_you_lose": [
            "❌ Unbegrenzte Interessenten → begrenzt auf 30",
            "❌ Unbegrenzte KI-Vorschläge → 1/Tag",
            "❌ 1-Klick KI-SMS"
        ],
        "what_you_lose_pro_plus": "❌ Heat-Scores und ROI-Dashboard",
        "upgrade_cta": "Auf {plan_name} upgraden — {price}€/Monat",
        "continue_free": "Oder kostenlos mit Starter fortfahren (max. 30 Interessenten)",
        "expired_title": "Ihre {plan_name} Testphase ist beendet",
        "expired_subtitle": "danke, dass Sie KOLO {plan_name} ausprobiert haben!",
        "data_kept": "<strong>Ihre Daten werden aufbewahrt.</strong><br>Upgraden Sie jederzeit auf {plan_name} um Ihre Interessenten und Funktionen wiederherzustellen.",
        "expired_upgrade_cta": "Auf {plan_name} upgraden",
        "expired_free_note": "Sie wurden automatisch auf Starter umgestellt (kostenlos, max. 30 Interessenten)",
        "reset_title": "Passwort zurücksetzen",
        "reset_subtitle": "Sie haben angefordert, Ihr Passwort zurückzusetzen.",
        "reset_cta": "Neues Passwort erstellen",
        "reset_footer": "Dieser Link läuft in 1 Stunde ab.<br>Wenn Sie dies nicht angefordert haben, ignorieren Sie diese E-Mail."
    },
    "it": {
        "welcome_title": "Benvenuto {user_name}! 👋",
        "welcome_subtitle_trial": "La tua prova gratuita {plan_name} di 14 giorni inizia ora.",
        "welcome_subtitle_free": "Benvenuto nel tuo nuovo assistente alle vendite.",
        "trial_features_title": "🎁 La tua prova {plan_name} include:",
        "trial_features": [
            "<strong>Potenziali clienti illimitati</strong> — aggiungi tutti i tuoi contatti",
            "<strong>Suggerimenti IA illimitati</strong> — non perdere mai un follow-up",
            "<strong>SMS 1-clic</strong> — messaggi scritti dall'IA"
        ],
        "trial_features_pro_plus": [
            "<strong>Punteggi di interesse</strong> — identifica i tuoi potenziali clienti più caldi",
            "<strong>Dashboard ROI</strong> — monitora le tue commissioni"
        ],
        "free_features_title": "✨ Con KOLO Starter, puoi:",
        "free_features": [
            "Gestire fino a <strong>30 potenziali clienti</strong>",
            "Ricevere <strong>1 suggerimento IA al giorno</strong>",
            "Organizzare le tue <strong>attività e follow-up</strong>"
        ],
        "cta_trial": "Scopri KOLO",
        "cta_free": "Inizia ora",
        "footer_question": "Hai una domanda? Rispondi semplicemente a questa email.",
        "days_left": "{days} giorni rimanenti",
        "reminder_title_7": "Ti restano 7 giorni di prova {plan_name}",
        "reminder_title_2": "Solo 2 giorni per goderti {plan_name}",
        "reminder_title_generic": "La tua prova {plan_name} sta per terminare",
        "reminder_subtitle_7": "Ecco cosa hai già realizzato con KOLO!",
        "reminder_subtitle_2": "Non perdere le tue funzionalità premium!",
        "reminder_subtitle_generic": "Ti restano {days} giorni.",
        "what_you_lose_title": "Cosa perderai passando a Starter:",
        "what_you_lose": [
            "❌ Potenziali clienti illimitati → limitato a 30",
            "❌ Suggerimenti IA illimitati → 1/giorno",
            "❌ SMS IA 1-clic"
        ],
        "what_you_lose_pro_plus": "❌ Punteggi di interesse e Dashboard ROI",
        "upgrade_cta": "Passa a {plan_name} — {price}€/mese",
        "continue_free": "Oppure continua gratis con Starter (max 30 potenziali clienti)",
        "expired_title": "La tua prova {plan_name} è terminata",
        "expired_subtitle": "grazie per aver provato KOLO {plan_name}!",
        "data_kept": "<strong>I tuoi dati sono conservati.</strong><br>Passa a {plan_name} in qualsiasi momento per recuperare i tuoi potenziali clienti e le funzionalità.",
        "expired_upgrade_cta": "Passa a {plan_name}",
        "expired_free_note": "Sei stato automaticamente passato a Starter (gratuito, max 30 potenziali clienti)",
        "reset_title": "Reimposta la tua password",
        "reset_subtitle": "hai richiesto di reimpostare la tua password.",
        "reset_cta": "Crea una nuova password",
        "reset_footer": "Questo link scade tra 1 ora.<br>Se non hai fatto questa richiesta, ignora questa email."
    }
}

def get_email_content(locale: str = "fr") -> dict:
    """Get email content for a given locale, fallback to English"""
    return EMAIL_CONTENT.get(locale, EMAIL_CONTENT["en"])


def get_welcome_email_html(user_name: str, is_trial: bool = False, trial_plan: str = "pro", locale: str = "fr") -> str:
    """Welcome email for new accounts - Localized"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    content = get_email_content(locale)
    
    if is_trial:
        features = content["trial_features"]
        if trial_plan == "pro_plus":
            features = features + content["trial_features_pro_plus"]
        features_html = "".join([f"<li>{f}</li>" for f in features])
        
        features_block = f"""
        <div style="background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(147,51,234,0.1)); border-radius: 16px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #6C63FF; margin: 0 0 16px 0; font-size: 18px;">{content["trial_features_title"].format(plan_name=plan_name)}</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                {features_html}
            </ul>
        </div>
        """
        cta_text = content["cta_trial"]
        subtitle = content["welcome_subtitle_trial"].format(plan_name=plan_name)
    else:
        features_html = "".join([f"<li>{f}</li>" for f in content["free_features"]])
        features_block = f"""
        <div style="background: #f7f7fa; border-radius: 16px; padding: 24px; margin: 24px 0;">
            <h3 style="color: #0E0B1E; margin: 0 0 16px 0; font-size: 18px;">{content["free_features_title"]}</h3>
            <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                {features_html}
            </ul>
        </div>
        """
        cta_text = content["cta_free"]
        subtitle = content["welcome_subtitle_free"]
    
    title = content["welcome_title"].format(user_name=user_name)
    
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
            
            <h2 style="color: #0E0B1E; font-size: 24px; margin: 0 0 8px 0;">{title}</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">{subtitle}</p>
            
            {features_block}
            
            <a href="https://app.trykolo.io/app" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">{cta_text}</a>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                {content["footer_question"]}
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


def get_trial_reminder_email_html(user_name: str, days_left: int, trial_plan: str = "pro", locale: str = "fr") -> str:
    """Trial reminder emails (J+7, J+12) - Localized"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    content = get_email_content(locale)
    price = "24,99" if trial_plan == "pro_plus" else "9,99"
    
    if days_left == 7:
        title = content["reminder_title_7"].format(plan_name=plan_name)
        subtitle = content["reminder_subtitle_7"]
        urgency_color = "#f59e0b"
    elif days_left == 2:
        title = content["reminder_title_2"].format(plan_name=plan_name)
        subtitle = content["reminder_subtitle_2"]
        urgency_color = "#ef4444"
    else:
        title = content["reminder_title_generic"].format(plan_name=plan_name)
        subtitle = content["reminder_subtitle_generic"].format(days=days_left)
        urgency_color = "#6C63FF"
    
    what_you_lose = content["what_you_lose"]
    if trial_plan == "pro_plus":
        what_you_lose = what_you_lose + [content["what_you_lose_pro_plus"]]
    
    lose_list_html = "".join([f"<li>{item}</li>" for item in what_you_lose])
    days_badge = content["days_left"].format(days=days_left)
    cta = content["upgrade_cta"].format(plan_name=plan_name, price=price)
    
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
                <span style="font-size: 14px; font-weight: 600;">⏰ {days_badge}</span>
            </div>
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">{title}</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">{user_name}, {subtitle}</p>
            
            <div style="background: #f7f7fa; border-radius: 16px; padding: 24px; margin: 24px 0;">
                <h3 style="color: #0E0B1E; margin: 0 0 16px 0; font-size: 16px;">{content["what_you_lose_title"]}</h3>
                <ul style="color: #374151; margin: 0; padding-left: 20px; line-height: 1.8;">
                    {lose_list_html}
                </ul>
            </div>
            
            <a href="https://app.trykolo.io/pricing" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">{cta}</a>
            
            <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 16px 0 0 0;">
                {content["continue_free"]}
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


def get_trial_expired_email_html(user_name: str, trial_plan: str = "pro", locale: str = "fr") -> str:
    """Trial expiration email (J+14) - Localized"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    content = get_email_content(locale)
    
    title = content["expired_title"].format(plan_name=plan_name)
    subtitle = content["expired_subtitle"].format(plan_name=plan_name)
    data_kept = content["data_kept"].format(plan_name=plan_name)
    cta = content["expired_upgrade_cta"].format(plan_name=plan_name)
    
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
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">{title}</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">{user_name}, {subtitle}</p>
            
            <div style="background: linear-gradient(135deg, rgba(108,99,255,0.1), rgba(147,51,234,0.1)); border-radius: 16px; padding: 24px; margin: 24px 0; text-align: center;">
                <p style="color: #374151; margin: 0 0 16px 0; font-size: 15px;">
                    {data_kept}
                </p>
            </div>
            
            <a href="https://app.trykolo.io/pricing" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">{cta}</a>
            
            <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 16px 0 0 0;">
                {content["expired_free_note"]}
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


def get_password_reset_email_html(user_name: str, reset_link: str, locale: str = "fr") -> str:
    """Password reset email - Localized"""
    content = get_email_content(locale)
    
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
            
            <h2 style="color: #0E0B1E; font-size: 22px; margin: 0 0 8px 0;">{content["reset_title"]}</h2>
            <p style="color: #6b7280; font-size: 16px; margin: 0 0 24px 0;">{user_name}, {content["reset_subtitle"]}</p>
            
            <a href="{reset_link}" style="display: block; text-align: center; background: linear-gradient(135deg, #4F46E5, #9333EA); color: white; padding: 16px 32px; border-radius: 999px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 24px 0;">{content["reset_cta"]}</a>
            
            <p style="color: #9ca3af; font-size: 14px; text-align: center; margin: 24px 0 0 0;">
                {content["reset_footer"]}
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
    
    logger.info(f"Attempting to send email to {to_email}: {subject}")
    
    try:
        resend.api_key = resend_api_key
        
        params = {
            "from": f"KOLO <{sender_email}>",
            "to": [to_email],
            "subject": subject,
            "html": html_content
        }
        
        result = resend.Emails.send(params)
        email_id = result.get("id") if isinstance(result, dict) else str(result)
        logger.info(f"✅ Email sent successfully to {to_email}: {subject} (ID: {email_id})")
        return {"success": True, "id": email_id}
        
    except Exception as e:
        logger.error(f"❌ Failed to send email to {to_email}: {e}")
        return {"success": False, "error": str(e)}


async def send_welcome_email(to_email: str, user_name: str, is_trial: bool = False, trial_plan: str = "pro", locale: str = "fr") -> dict:
    """Send welcome email to new user"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    subjects = {
        "fr": f"🎉 Bienvenue dans votre essai KOLO {plan_name}" if is_trial else "🎉 Bienvenue sur KOLO !",
        "en": f"🎉 Welcome to your KOLO {plan_name} trial" if is_trial else "🎉 Welcome to KOLO!",
        "de": f"🎉 Willkommen zu Ihrer KOLO {plan_name} Testphase" if is_trial else "🎉 Willkommen bei KOLO!",
        "it": f"🎉 Benvenuto nella tua prova KOLO {plan_name}" if is_trial else "🎉 Benvenuto su KOLO!"
    }
    subject = subjects.get(locale, subjects["en"])
    
    html = get_welcome_email_html(user_name, is_trial, trial_plan, locale)
    return await send_email(to_email, subject, html)


async def send_trial_reminder_email(to_email: str, user_name: str, days_left: int, trial_plan: str = "pro", locale: str = "fr") -> dict:
    """Send trial reminder email"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    if locale == "fr":
        if days_left == 7:
            subject = f"⏰ Il vous reste 7 jours d'essai {plan_name}"
        elif days_left == 2:
            subject = f"⚠️ Plus que 2 jours pour profiter de KOLO {plan_name}"
        else:
            subject = f"⏰ {days_left} jours restants sur votre essai {plan_name}"
    elif locale == "de":
        subject = f"⏰ Noch {days_left} Tage in Ihrer {plan_name} Testphase"
    elif locale == "it":
        subject = f"⏰ {days_left} giorni rimanenti nella tua prova {plan_name}"
    else:
        if days_left == 7:
            subject = f"⏰ 7 days left in your {plan_name} trial"
        elif days_left == 2:
            subject = f"⚠️ Only 2 days left to enjoy KOLO {plan_name}"
        else:
            subject = f"⏰ {days_left} days remaining in your {plan_name} trial"
    
    html = get_trial_reminder_email_html(user_name, days_left, trial_plan, locale)
    return await send_email(to_email, subject, html)


async def send_trial_expired_email(to_email: str, user_name: str, trial_plan: str = "pro", locale: str = "fr") -> dict:
    """Send trial expiration email"""
    plan_name = "Pro+" if trial_plan == "pro_plus" else "Pro"
    
    subjects = {
        "fr": f"Votre essai KOLO {plan_name} est terminé",
        "en": f"Your KOLO {plan_name} trial has ended",
        "de": f"Ihre KOLO {plan_name} Testphase ist beendet",
        "it": f"La tua prova KOLO {plan_name} è terminata"
    }
    subject = subjects.get(locale, subjects["en"])
    
    html = get_trial_expired_email_html(user_name, trial_plan, locale)
    return await send_email(to_email, subject, html)


async def send_password_reset_email(to_email: str, user_name: str, reset_token: str, base_url: str, locale: str = "fr") -> dict:
    """Send password reset email"""
    reset_link = f"{base_url}/reset-password?token={reset_token}"
    
    subjects = {
        "fr": "🔐 Réinitialiser votre mot de passe KOLO",
        "en": "🔐 Reset your KOLO password",
        "de": "🔐 Setzen Sie Ihr KOLO-Passwort zurück",
        "it": "🔐 Reimposta la tua password KOLO"
    }
    subject = subjects.get(locale, subjects["en"])
    
    html = get_password_reset_email_html(user_name, reset_link, locale)
    return await send_email(to_email, subject, html)


async def send_subscription_confirmation_email(
    email: str, 
    name: str, 
    plan: str, 
    is_trial: bool = False,
    trial_end: Optional[datetime] = None,
    locale: str = "fr"
) -> dict:
    """Send subscription/trial confirmation email - Localized for 4 languages"""
    plan_display = "Pro+" if plan == "pro_plus" else "Pro"
    days_left = (trial_end - datetime.now(timezone.utc)).days if trial_end else 7
    
    # Localized content
    SUBSCRIPTION_CONTENT = {
        "fr": {
            "subject_trial": f"🎉 Votre essai {plan_display} est activé !",
            "subject_paid": f"✅ Bienvenue dans KOLO {plan_display} !",
            "message_trial": f"Bienvenue {name} ! Votre essai gratuit {plan_display} de {days_left} jours est maintenant actif.",
            "message_paid": f"Merci {name} ! Votre abonnement {plan_display} est maintenant actif.",
            "features_title_trial": f"Votre essai {plan_display} inclut :",
            "features_title_paid": f"Votre abonnement {plan_display} inclut :",
            "cta": "Accéder à KOLO",
            "footer": "Tous droits réservés.",
            "features_pro": ["Prospects illimités", "Suggestions IA illimitées", "SMS 1-clic IA", "Historique des interactions"],
            "features_pro_plus": ["Prospects illimités", "Suggestions IA illimitées", "SMS 1-clic IA", "Score de chaleur", "Dashboard ROI", "Support prioritaire"]
        },
        "en": {
            "subject_trial": f"🎉 Your {plan_display} trial is active!",
            "subject_paid": f"✅ Welcome to KOLO {plan_display}!",
            "message_trial": f"Welcome {name}! Your {days_left}-day {plan_display} free trial is now active.",
            "message_paid": f"Thank you {name}! Your {plan_display} subscription is now active.",
            "features_title_trial": f"Your {plan_display} trial includes:",
            "features_title_paid": f"Your {plan_display} subscription includes:",
            "cta": "Open KOLO",
            "footer": "All rights reserved.",
            "features_pro": ["Unlimited prospects", "Unlimited AI suggestions", "1-click AI SMS", "Interaction history"],
            "features_pro_plus": ["Unlimited prospects", "Unlimited AI suggestions", "1-click AI SMS", "Heat scores", "ROI Dashboard", "Priority support"]
        },
        "de": {
            "subject_trial": f"🎉 Ihre {plan_display} Testphase ist aktiv!",
            "subject_paid": f"✅ Willkommen bei KOLO {plan_display}!",
            "message_trial": f"Willkommen {name}! Ihre {days_left}-tägige {plan_display} Testphase ist jetzt aktiv.",
            "message_paid": f"Vielen Dank {name}! Ihr {plan_display} Abonnement ist jetzt aktiv.",
            "features_title_trial": f"Ihre {plan_display} Testphase beinhaltet:",
            "features_title_paid": f"Ihr {plan_display} Abonnement beinhaltet:",
            "cta": "KOLO öffnen",
            "footer": "Alle Rechte vorbehalten.",
            "features_pro": ["Unbegrenzte Interessenten", "Unbegrenzte KI-Vorschläge", "1-Klick KI-SMS", "Interaktionshistorie"],
            "features_pro_plus": ["Unbegrenzte Interessenten", "Unbegrenzte KI-Vorschläge", "1-Klick KI-SMS", "Heat-Scores", "ROI-Dashboard", "Priorisierter Support"]
        },
        "it": {
            "subject_trial": f"🎉 La tua prova {plan_display} è attiva!",
            "subject_paid": f"✅ Benvenuto in KOLO {plan_display}!",
            "message_trial": f"Benvenuto {name}! La tua prova gratuita {plan_display} di {days_left} giorni è ora attiva.",
            "message_paid": f"Grazie {name}! Il tuo abbonamento {plan_display} è ora attivo.",
            "features_title_trial": f"La tua prova {plan_display} include:",
            "features_title_paid": f"Il tuo abbonamento {plan_display} include:",
            "cta": "Apri KOLO",
            "footer": "Tutti i diritti riservati.",
            "features_pro": ["Potenziali clienti illimitati", "Suggerimenti IA illimitati", "SMS IA 1-clic", "Cronologia interazioni"],
            "features_pro_plus": ["Potenziali clienti illimitati", "Suggerimenti IA illimitati", "SMS IA 1-clic", "Punteggi di interesse", "Dashboard ROI", "Supporto prioritario"]
        }
    }
    
    content = SUBSCRIPTION_CONTENT.get(locale, SUBSCRIPTION_CONTENT["en"])
    
    subject = content["subject_trial"] if is_trial else content["subject_paid"]
    message = content["message_trial"] if is_trial else content["message_paid"]
    features_title = content["features_title_trial"] if is_trial else content["features_title_paid"]
    features = content["features_pro_plus"] if plan == "pro_plus" else content["features_pro"]
    
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
                <a href="https://app.trykolo.io/app" style="display: inline-block; background: linear-gradient(135deg, #004AAD, #CB6CE6); color: white; text-decoration: none; padding: 14px 32px; border-radius: 999px; font-weight: 600; font-size: 16px;">
                    {content["cta"]}
                </a>
            </div>
            
            <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">
                © 2026 KOLO.io LTD. {content["footer"]}
            </p>
        </div>
    </body>
    </html>
    """
    
    return await send_email(email, subject, html)
