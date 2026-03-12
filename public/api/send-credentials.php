<?php
/**
 * API pour envoyer les credentials Shield par email
 * Utilise PHPMailer avec SMTP (même config que TripSalama)
 */

// Charger le bootstrap pour avoir les variables d'environnement
require_once __DIR__ . '/../../backend/php/bootstrap.php';

header('Content-Type: application/json');

// Token de sécurité
$secretToken = 'shield-admin-2026-secret';
$providedToken = $_GET['token'] ?? $_POST['token'] ?? '';

if ($providedToken !== $secretToken) {
    http_response_code(403);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

// Charger PHPMailer
$phpmailerPath = __DIR__ . '/../../backend/php/Vendor/PHPMailer';
if (!file_exists($phpmailerPath . '/PHPMailer.php')) {
    http_response_code(500);
    echo json_encode(['error' => 'PHPMailer non installé']);
    exit;
}

require_once $phpmailerPath . '/Exception.php';
require_once $phpmailerPath . '/PHPMailer.php';
require_once $phpmailerPath . '/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;

// Credentials à envoyer
$to = 'tarik.gilani@stabilis-it.ch';
$prodUrl = 'https://stabilis-it.ch/internal/shield/';
$email = 'shield-test-prod@gmail.com';
$password = 'ShieldTest2026!!';

// Config SMTP (même que TripSalama - partage les secrets GitHub)
$smtpHost = getenv('SMTP_HOST') ?: 'smtp.office365.com';
$smtpPort = (int)(getenv('SMTP_PORT') ?: 587);
$smtpUser = getenv('SMTP_USERNAME') ?: '';
$smtpPass = getenv('SMTP_PASSWORD') ?: '';
$fromEmail = $smtpUser ?: 'tarik.gilani@stabilis-it.ch';
$fromName = 'SHIELD App';

// Debug mode
$debug = isset($_GET['debug']);

try {
    $mail = new PHPMailer(true);

    // Configuration serveur
    if ($debug) {
        $mail->SMTPDebug = SMTP::DEBUG_SERVER;
    }
    $mail->isSMTP();
    $mail->Host = $smtpHost;
    $mail->SMTPAuth = true;
    $mail->Username = $smtpUser;
    $mail->Password = $smtpPass;
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
    $mail->Port = $smtpPort;
    $mail->CharSet = 'UTF-8';

    // Expéditeur et destinataire
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($to);

    // Contenu
    $mail->isHTML(true);
    $mail->Subject = '🛡️ SHIELD - Credentials de test PROD';

    $mail->Body = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; margin: 0; padding: 20px; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 40px 30px; border-radius: 16px 16px 0 0; text-align: center; }
        .header h1 { margin: 0; font-size: 28px; letter-spacing: 2px; }
        .header .subtitle { margin: 10px 0 0 0; opacity: 0.8; font-size: 14px; }
        .content { background: white; padding: 30px; border-radius: 0 0 16px 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        .credentials-box { background: linear-gradient(135deg, #1a1a2e 0%, #0f3460 100%); color: white; padding: 25px; border-radius: 12px; margin: 25px 0; }
        .credentials-box h3 { margin: 0 0 20px 0; color: #E91E8C; font-size: 16px; text-transform: uppercase; letter-spacing: 1px; }
        .credential-item { margin: 15px 0; padding: 12px 15px; background: rgba(255,255,255,0.1); border-radius: 8px; font-family: 'Monaco', 'Consolas', monospace; }
        .credential-label { font-size: 11px; color: #E91E8C; text-transform: uppercase; margin-bottom: 5px; }
        .credential-value { font-size: 16px; color: white; word-break: break-all; }
        .btn { display: inline-block; background: linear-gradient(135deg, #E91E8C 0%, #c4167a 100%); color: white; padding: 16px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; margin: 25px 0; font-size: 16px; }
        .features { background: #f8f9fa; padding: 20px; border-radius: 12px; margin: 25px 0; }
        .feature-item { margin: 12px 0; padding-left: 30px; position: relative; font-size: 14px; }
        .footer { text-align: center; color: #888; font-size: 12px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #eee; }
        .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ SHIELD</h1>
            <p class="subtitle">Application de sécurité personnelle</p>
        </div>
        <div class="content">
            <p>Bonjour,</p>
            <p>Voici les <strong>credentials de test</strong> pour accéder à l'application SHIELD en production.</p>

            <div class="credentials-box">
                <h3>🔐 Identifiants de connexion</h3>
                <div class="credential-item">
                    <div class="credential-label">URL</div>
                    <div class="credential-value">{$prodUrl}</div>
                </div>
                <div class="credential-item">
                    <div class="credential-label">Email</div>
                    <div class="credential-value">{$email}</div>
                </div>
                <div class="credential-item">
                    <div class="credential-label">Mot de passe</div>
                    <div class="credential-value">{$password}</div>
                </div>
            </div>

            <p style="text-align: center;">
                <a href="{$prodUrl}" class="btn">🚀 Accéder à SHIELD</a>
            </p>

            <div class="features">
                <h3 style="margin-top: 0; color: #1a1a2e;">📋 Fonctionnalités disponibles :</h3>
                <div class="feature-item">✅ <strong>Bouton SOS</strong> : Déclenchement d'alerte en 5 taps</div>
                <div class="feature-item">✅ <strong>Alarme MAXIMUM</strong> : Sons terrifiants pour faire fuir l'agresseur</div>
                <div class="feature-item">✅ <strong>Carte temps réel</strong> : Position GPS partagée avec les contacts</div>
                <div class="feature-item">✅ <strong>Contacts d'urgence</strong> : Notification automatique</div>
                <div class="feature-item">✅ <strong>Mode silencieux</strong> : Alerte discrète possible</div>
                <div class="feature-item">✅ <strong>Paramètres son</strong> : Choix de 5 types d'alarme</div>
            </div>

            <div class="warning">
                <strong>⚠️ Note :</strong> Ces credentials sont destinés aux tests uniquement. Ne pas partager.
            </div>

            <div class="footer">
                <p>SHIELD - Votre sécurité, notre priorité<br>
                Déployé sur stabilis-it.ch | Version 1.0</p>
            </div>
        </div>
    </div>
</body>
</html>
HTML;

    // Version texte
    $mail->AltBody = "SHIELD - Credentials de test PROD\n\n"
        . "URL: $prodUrl\n"
        . "Email: $email\n"
        . "Password: $password\n\n"
        . "Note: Ces credentials sont destinés aux tests uniquement.";

    $mail->send();

    echo json_encode([
        'success' => true,
        'to' => $to,
        'message' => 'Email envoyé avec succès'
    ]);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $mail->ErrorInfo ?? $e->getMessage(),
        'smtp_host' => $smtpHost,
        'smtp_user' => $smtpUser ? substr($smtpUser, 0, 3) . '***' : '(empty - check .env)'
    ]);
}
