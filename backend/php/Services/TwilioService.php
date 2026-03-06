<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;
use Twilio\Rest\Client;
use Twilio\TwiML\VoiceResponse;

/**
 * TwilioService - Intégration Twilio pour SMS et appels vocaux
 */
class TwilioService
{
    private PDO $db;
    private ?Client $client;
    private string $accountSid;
    private string $authToken;
    private string $fromNumber;
    private string $aiWebhookUrl;
    private bool $enabled;

    public function __construct(PDO $db)
    {
        $this->db = $db;
        $this->accountSid = $_ENV['TWILIO_ACCOUNT_SID'] ?? '';
        $this->authToken = $_ENV['TWILIO_AUTH_TOKEN'] ?? '';
        $this->fromNumber = $_ENV['TWILIO_FROM_NUMBER'] ?? '';
        $this->aiWebhookUrl = $_ENV['SHIELD_AI_WEBHOOK_URL'] ?? '';

        $this->enabled = !empty($this->accountSid) && !empty($this->authToken);

        if ($this->enabled) {
            $this->client = new Client($this->accountSid, $this->authToken);
        } else {
            $this->client = null;
        }
    }

    /**
     * Envoyer un SMS
     */
    public function sendSMS(string $to, string $message): array
    {
        if (!$this->enabled || !$this->client) {
            return $this->logAndReturn('sms', $to, $message, false, 'Twilio not configured');
        }

        try {
            $result = $this->client->messages->create($to, [
                'from' => $this->fromNumber,
                'body' => $message
            ]);

            $this->logMessage('sms', $to, $message, $result->sid, 'sent');

            return [
                'success' => true,
                'sid' => $result->sid,
                'status' => $result->status
            ];
        } catch (\Exception $e) {
            return $this->logAndReturn('sms', $to, $message, false, $e->getMessage());
        }
    }

    /**
     * Initier un appel vocal avec agent IA
     */
    public function initiateAICall(string $to, string $incidentId, string $language = 'fr'): string
    {
        if (!$this->enabled || !$this->client) {
            throw new \RuntimeException('Twilio not configured');
        }

        $webhookUrl = $this->aiWebhookUrl . '?' . http_build_query([
            'incident_id' => $incidentId,
            'language' => $language
        ]);

        try {
            $call = $this->client->calls->create($to, $this->fromNumber, [
                'url' => $webhookUrl,
                'method' => 'POST',
                'statusCallback' => $this->aiWebhookUrl . '/status',
                'statusCallbackEvent' => ['initiated', 'ringing', 'answered', 'completed'],
                'record' => true,
                'recordingStatusCallback' => $this->aiWebhookUrl . '/recording'
            ]);

            $this->logCall($incidentId, $to, $call->sid, 'initiated');

            return $call->sid;
        } catch (\Exception $e) {
            $this->logCall($incidentId, $to, null, 'failed', $e->getMessage());
            throw $e;
        }
    }

    /**
     * Générer le TwiML pour l'agent vocal IA
     */
    public function generateAIAgentTwiML(string $incidentId, string $language = 'fr'): string
    {
        $response = new VoiceResponse();

        // Message d'introduction
        $intro = $this->getVoiceMessage('intro', $language);
        $response->say($intro, [
            'voice' => 'alice',
            'language' => $this->getTwiMLLanguage($language)
        ]);

        // Collecter la réponse vocale
        $gather = $response->gather([
            'input' => 'speech',
            'timeout' => 10,
            'speechTimeout' => 'auto',
            'action' => $this->aiWebhookUrl . '/process?' . http_build_query([
                'incident_id' => $incidentId,
                'language' => $language
            ]),
            'method' => 'POST',
            'language' => $this->getTwiMLLanguage($language)
        ]);

        // Si pas de réponse, répéter
        $response->redirect($this->aiWebhookUrl . '?' . http_build_query([
            'incident_id' => $incidentId,
            'language' => $language,
            'retry' => 1
        ]));

        return (string) $response;
    }

    /**
     * Terminer un appel en cours
     */
    public function endCall(string $callSid): bool
    {
        if (!$this->enabled || !$this->client) {
            return false;
        }

        try {
            $this->client->calls($callSid)->update(['status' => 'completed']);
            return true;
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * Obtenir l'enregistrement d'un appel
     */
    public function getRecording(string $callSid): ?string
    {
        if (!$this->enabled || !$this->client) {
            return null;
        }

        try {
            $recordings = $this->client->recordings->read(['callSid' => $callSid], 1);
            if (!empty($recordings)) {
                return $recordings[0]->uri;
            }
        } catch (\Exception $e) {
            // Silencieux
        }

        return null;
    }

    /**
     * Vérifier le statut d'un SMS
     */
    public function checkSMSStatus(string $sid): ?string
    {
        if (!$this->enabled || !$this->client) {
            return null;
        }

        try {
            $message = $this->client->messages($sid)->fetch();
            return $message->status;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Envoyer un SMS de vérification
     */
    public function sendVerificationSMS(string $to, string $code, string $language = 'fr'): array
    {
        $messages = [
            'fr' => "SHIELD - Votre code de vérification : %s",
            'en' => "SHIELD - Your verification code: %s",
            'de' => "SHIELD - Ihr Bestätigungscode: %s",
            'es' => "SHIELD - Tu código de verificación: %s",
            'it' => "SHIELD - Il tuo codice di verifica: %s"
        ];

        $message = sprintf($messages[$language] ?? $messages['fr'], $code);

        return $this->sendSMS($to, $message);
    }

    /**
     * Envoyer un SMS d'alerte aux contacts
     */
    public function sendAlertSMS(string $to, string $userName, ?string $location = null): array
    {
        $message = sprintf(
            "ALERTE SHIELD - %s a déclenché une alerte de sécurité !",
            $userName
        );

        if ($location) {
            $message .= "\nPosition : " . $location;
        }

        $message .= "\n\nSi vous ne pouvez pas la joindre, appelez immédiatement les secours.";

        return $this->sendSMS($to, $message);
    }

    /**
     * Obtenir le message vocal selon la langue
     */
    private function getVoiceMessage(string $key, string $language): string
    {
        $messages = [
            'intro' => [
                'fr' => "Bonjour, ici Shield, votre assistant de sécurité. Êtes-vous en sécurité ? Décrivez votre situation.",
                'en' => "Hello, this is Shield, your safety assistant. Are you safe? Please describe your situation.",
                'de' => "Hallo, hier ist Shield, Ihr Sicherheitsassistent. Sind Sie in Sicherheit? Beschreiben Sie Ihre Situation.",
                'es' => "Hola, soy Shield, tu asistente de seguridad. ¿Estás a salvo? Describe tu situación.",
                'it' => "Ciao, sono Shield, il tuo assistente di sicurezza. Sei al sicuro? Descrivi la tua situazione."
            ],
            'escalate' => [
                'fr' => "Je comprends. Je contacte immédiatement les services d'urgence. Restez en ligne.",
                'en' => "I understand. I'm contacting emergency services immediately. Stay on the line.",
                'de' => "Ich verstehe. Ich kontaktiere sofort die Notdienste. Bleiben Sie dran.",
                'es' => "Entiendo. Estoy contactando a los servicios de emergencia. Mantente en línea.",
                'it' => "Capisco. Sto contattando i servizi di emergenza. Resta in linea."
            ],
            'safe' => [
                'fr' => "Je suis soulagée que vous soyez en sécurité. L'alerte est annulée. Prenez soin de vous.",
                'en' => "I'm relieved you're safe. The alert is cancelled. Take care of yourself.",
                'de' => "Ich bin erleichtert, dass Sie in Sicherheit sind. Der Alarm ist aufgehoben. Passen Sie auf sich auf.",
                'es' => "Me alegra que estés a salvo. La alerta está cancelada. Cuídate.",
                'it' => "Sono sollevato che tu sia al sicuro. L'allarme è annullato. Prenditi cura di te."
            ]
        ];

        return $messages[$key][$language] ?? $messages[$key]['fr'];
    }

    /**
     * Convertir le code langue en format TwiML
     */
    private function getTwiMLLanguage(string $language): string
    {
        $mapping = [
            'fr' => 'fr-FR',
            'en' => 'en-US',
            'de' => 'de-DE',
            'es' => 'es-ES',
            'it' => 'it-IT',
            'nl' => 'nl-NL',
            'sv' => 'sv-SE',
            'pl' => 'pl-PL',
            'el' => 'el-GR',
            'pt' => 'pt-PT'
        ];

        return $mapping[$language] ?? 'fr-FR';
    }

    /**
     * Logger un message SMS
     */
    private function logMessage(string $type, string $to, string $content, ?string $sid, string $status): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO twilio_logs (type, phone_to, content, sid, status, created_at)
            VALUES (:type, :phone_to, :content, :sid, :status, NOW())
        ");
        $stmt->execute([
            'type' => $type,
            'phone_to' => $to,
            'content' => substr($content, 0, 500),
            'sid' => $sid,
            'status' => $status
        ]);
    }

    /**
     * Logger un appel
     */
    private function logCall(string $incidentId, string $to, ?string $sid, string $status, ?string $error = null): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO twilio_calls (incident_id, phone_to, call_sid, status, error_message, created_at)
            VALUES (:incident_id, :phone_to, :call_sid, :status, :error_message, NOW())
        ");
        $stmt->execute([
            'incident_id' => $incidentId,
            'phone_to' => $to,
            'call_sid' => $sid,
            'status' => $status,
            'error_message' => $error
        ]);
    }

    /**
     * Logger et retourner un résultat
     */
    private function logAndReturn(string $type, string $to, string $content, bool $success, ?string $error = null): array
    {
        $this->logMessage($type, $to, $content, null, $success ? 'sent' : 'failed');

        return [
            'success' => $success,
            'error' => $error
        ];
    }

    /**
     * Vérifier si Twilio est configuré
     */
    public function isEnabled(): bool
    {
        return $this->enabled;
    }
}
