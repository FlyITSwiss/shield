<?php
/**
 * API pour envoyer les credentials Shield par email
 * Protégé par token secret
 */

// Token de sécurité (le même que TripSalama)
$secretToken = 'shield-admin-2026-secret';

// Vérifier le token
$providedToken = $_GET['token'] ?? $_POST['token'] ?? '';

if ($providedToken !== $secretToken) {
    http_response_code(403);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

$to = 'tarik.gilani@stabilis-it.ch';
$subject = '🛡️ SHIELD - Credentials de test PROD';

$prodUrl = 'https://stabilis-it.ch/internal/shield/';
$email = 'shield-test-prod@gmail.com';
$password = 'ShieldTest2026!!';

$message = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
        .container { max-width: 600px; margin: 20px auto; padding: 0; }
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
        .feature-item:before { content: "✅"; position: absolute; left: 0; }
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
                <div class="feature-item"><strong>Bouton SOS</strong> : Déclenchement d'alerte en 5 taps</div>
                <div class="feature-item"><strong>Alarme MAXIMUM</strong> : Sons terrifiants pour faire fuir l'agresseur</div>
                <div class="feature-item"><strong>Carte temps réel</strong> : Position GPS partagée avec les contacts</div>
                <div class="feature-item"><strong>Contacts d'urgence</strong> : Notification automatique</div>
                <div class="feature-item"><strong>Mode silencieux</strong> : Alerte discrète possible</div>
                <div class="feature-item"><strong>Paramètres son</strong> : Choix de 5 types d'alarme</div>
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

$headers = [
    'MIME-Version: 1.0',
    'Content-type: text/html; charset=UTF-8',
    'From: SHIELD App <noreply@stabilis-it.ch>',
    'Reply-To: support@stabilis-it.ch',
    'X-Mailer: PHP/' . phpversion()
];

header('Content-Type: application/json');

if (mail($to, $subject, $message, implode("\r\n", $headers))) {
    echo json_encode([
        'success' => true,
        'message' => "Email envoyé à {$to}"
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => "Échec de l'envoi",
        'fallback' => [
            'url' => $prodUrl,
            'email' => $email,
            'password' => $password
        ]
    ]);
}
