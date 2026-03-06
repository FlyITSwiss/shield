<?php
declare(strict_types=1);

namespace Shield\Services;

use PDO;

/**
 * AIVoiceAgentService - Agent vocal IA pour SHIELD
 *
 * Intègre :
 * - Deepgram : Speech-to-Text temps réel
 * - OpenAI : Traitement conversation et décision
 * - ElevenLabs : Text-to-Speech naturel
 *
 * Fonctionnalités :
 * - Détection mots-codes (code rouge, code orange, annulation)
 * - Évaluation niveau urgence
 * - Accompagnement vocal pendant crise
 * - Transcription complète
 */
class AIVoiceAgentService
{
    private PDO $db;
    private bool $enabled = false;

    // API Keys
    private ?string $deepgramApiKey;
    private ?string $openaiApiKey;
    private ?string $elevenlabsApiKey;
    private ?string $anthropicApiKey;
    private ?string $geminiApiKey;

    // Configuration
    private string $elevenlabsVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // Sarah - voix féminine rassurante
    private string $openaiModel = 'gpt-4-turbo-preview';
    private string $anthropicModel = 'claude-3-haiku-20240307'; // Rapide et économique
    private string $geminiModel = 'gemini-2.0-flash'; // Très rapide

    // Ordre de fallback des providers
    private array $providerOrder = ['openai', 'anthropic', 'gemini'];

    // Prompts système
    private array $systemPrompts;

    public function __construct(PDO $db)
    {
        $this->db = $db;

        // Charger les clés API
        $this->deepgramApiKey = $_ENV['DEEPGRAM_API_KEY'] ?? getenv('DEEPGRAM_API_KEY') ?: null;
        $this->openaiApiKey = $_ENV['OPENAI_API_KEY'] ?? getenv('OPENAI_API_KEY') ?: null;
        $this->elevenlabsApiKey = $_ENV['ELEVENLABS_API_KEY'] ?? getenv('ELEVENLABS_API_KEY') ?: null;
        $this->anthropicApiKey = $_ENV['ANTHROPIC_API_KEY'] ?? getenv('ANTHROPIC_API_KEY') ?: null;
        $this->geminiApiKey = $_ENV['GEMINI_API_KEY'] ?? getenv('GEMINI_API_KEY') ?: null;

        // Service actif si au moins un provider AI est disponible
        $hasAIProvider = !empty($this->openaiApiKey) || !empty($this->anthropicApiKey) || !empty($this->geminiApiKey);
        $this->enabled = !empty($this->deepgramApiKey) && $hasAIProvider;

        $this->initSystemPrompts();
    }

    /**
     * Initialiser les prompts système pour l'agent
     */
    private function initSystemPrompts(): void
    {
        $this->systemPrompts = [
            'fr' => <<<PROMPT
Tu es un agent d'urgence SHIELD, une application de sécurité pour femmes.
Tu parles à une personne qui vient de déclencher une alerte SOS.

RÈGLES CRITIQUES :
1. Reste calme, rassurant et empathique
2. Parle de manière concise (max 2 phrases par réponse)
3. Évalue le niveau d'urgence à chaque échange
4. Détecte les mots-codes configurés par l'utilisateur
5. Ne pose jamais de questions qui pourraient mettre la personne en danger

MOTS-CODES À DÉTECTER :
- CODE ROUGE : Danger immédiat, appeler police
- CODE ORANGE : Situation inquiétante, surveiller
- MOT D'ANNULATION : Fausse alerte, désactiver

NIVEAUX D'URGENCE :
- CRITICAL : Violence en cours, besoin police immédiat
- HIGH : Danger potentiel, maintenir contact
- MEDIUM : Situation inquiétante à surveiller
- LOW : Probablement fausse alerte

À chaque réponse, indique le niveau d'urgence détecté entre crochets : [NIVEAU]
PROMPT,

            'en' => <<<PROMPT
You are a SHIELD emergency agent, a safety application for women.
You are speaking with someone who just triggered an SOS alert.

CRITICAL RULES:
1. Stay calm, reassuring and empathetic
2. Speak concisely (max 2 sentences per response)
3. Assess the urgency level at each exchange
4. Detect the user's configured code words
5. Never ask questions that could put the person in danger

CODE WORDS TO DETECT:
- CODE RED: Immediate danger, call police
- CODE ORANGE: Concerning situation, monitor
- CANCEL WORD: False alarm, deactivate

URGENCY LEVELS:
- CRITICAL: Ongoing violence, immediate police needed
- HIGH: Potential danger, maintain contact
- MEDIUM: Concerning situation to monitor
- LOW: Probably false alarm

In each response, indicate the detected urgency level in brackets: [LEVEL]
PROMPT
        ];
    }

    /**
     * Vérifier si le service est activé
     */
    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * Créer une nouvelle session vocale
     */
    public function createSession(string $incidentId, int $userId, string $language = 'fr'): array
    {
        $sessionId = 'shield_voice_' . uniqid() . '_' . time();

        // Récupérer les mots-codes de l'utilisateur
        $codeWords = $this->getUserCodeWords($userId);

        // Stocker la session
        $stmt = $this->db->prepare("
            INSERT INTO ai_voice_sessions
            (session_id, incident_id, user_id, language, code_words, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'active', NOW())
        ");
        $stmt->execute([
            $sessionId,
            $incidentId,
            $userId,
            $language,
            json_encode($codeWords)
        ]);

        return [
            'session_id' => $sessionId,
            'deepgram_url' => $this->getDeepgramWebsocketUrl($language),
            'language' => $language,
            'code_words' => $codeWords
        ];
    }

    /**
     * Obtenir l'URL WebSocket Deepgram pour STT
     */
    public function getDeepgramWebsocketUrl(string $language = 'fr'): string
    {
        $params = http_build_query([
            'model' => 'nova-2',
            'language' => $language,
            'smart_format' => 'true',
            'interim_results' => 'true',
            'endpointing' => '300',
            'vad_events' => 'true'
        ]);

        return "wss://api.deepgram.com/v1/listen?{$params}";
    }

    /**
     * Traiter la transcription et générer une réponse
     */
    public function processTranscription(
        string $sessionId,
        string $transcript,
        string $language = 'fr'
    ): array {
        // Récupérer la session
        $session = $this->getSession($sessionId);
        if (!$session) {
            return ['error' => 'session_not_found'];
        }

        // Récupérer l'historique de conversation
        $history = $this->getConversationHistory($sessionId);

        // Détecter les mots-codes
        $codeWords = json_decode($session['code_words'], true) ?? [];
        $detectedCode = $this->detectCodeWord($transcript, $codeWords);

        // Générer la réponse via OpenAI
        $response = $this->generateResponse($transcript, $history, $language, $detectedCode);

        // Extraire le niveau d'urgence de la réponse
        $urgencyLevel = $this->extractUrgencyLevel($response['text']);

        // Sauvegarder l'échange
        $this->saveConversationTurn($sessionId, $transcript, $response['text'], $urgencyLevel);

        // Mettre à jour le niveau d'urgence de l'incident si nécessaire
        if ($urgencyLevel === 'CRITICAL') {
            $this->escalateIncident($session['incident_id']);
        }

        // Générer l'audio via ElevenLabs
        $audioUrl = null;
        if ($this->elevenlabsApiKey) {
            $audioUrl = $this->generateSpeech($response['text'], $language);
        }

        return [
            'text' => $response['text'],
            'audio_url' => $audioUrl,
            'urgency_level' => $urgencyLevel,
            'detected_code' => $detectedCode,
            'action' => $this->determineAction($urgencyLevel, $detectedCode)
        ];
    }

    /**
     * Générer une réponse via AI (avec fallback multi-provider)
     */
    private function generateResponse(
        string $userMessage,
        array $history,
        string $language,
        ?string $detectedCode
    ): array {
        $systemPrompt = $this->systemPrompts[$language] ?? $this->systemPrompts['fr'];

        // Ajouter le contexte du code détecté
        if ($detectedCode) {
            $systemPrompt .= "\n\nATTENTION: L'utilisateur a prononcé le mot-code '{$detectedCode}'. Réagis en conséquence.";
        }

        // Essayer chaque provider dans l'ordre
        foreach ($this->providerOrder as $provider) {
            $result = match ($provider) {
                'openai' => $this->callOpenAI($systemPrompt, $userMessage, $history),
                'anthropic' => $this->callAnthropic($systemPrompt, $userMessage, $history),
                'gemini' => $this->callGemini($systemPrompt, $userMessage, $history),
                default => null
            };

            if ($result !== null) {
                return ['text' => $result, 'provider' => $provider];
            }
        }

        return ['text' => $this->getFallbackResponse($language), 'provider' => 'fallback'];
    }

    /**
     * Appel API OpenAI
     */
    private function callOpenAI(string $systemPrompt, string $userMessage, array $history): ?string
    {
        if (!$this->openaiApiKey) {
            return null;
        }

        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach ($history as $turn) {
            $messages[] = ['role' => 'user', 'content' => $turn['user_message']];
            $messages[] = ['role' => 'assistant', 'content' => $turn['agent_response']];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $ch = curl_init('https://api.openai.com/v1/chat/completions');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->openaiApiKey
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $this->openaiModel,
                'messages' => $messages,
                'max_tokens' => 150,
                'temperature' => 0.7
            ])
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("OpenAI API error (HTTP $httpCode): " . substr($response, 0, 200));
            return null;
        }

        $data = json_decode($response, true);
        return $data['choices'][0]['message']['content'] ?? null;
    }

    /**
     * Appel API Anthropic (Claude)
     */
    private function callAnthropic(string $systemPrompt, string $userMessage, array $history): ?string
    {
        if (!$this->anthropicApiKey) {
            return null;
        }

        $messages = [];
        foreach ($history as $turn) {
            $messages[] = ['role' => 'user', 'content' => $turn['user_message']];
            $messages[] = ['role' => 'assistant', 'content' => $turn['agent_response']];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $ch = curl_init('https://api.anthropic.com/v1/messages');
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'x-api-key: ' . $this->anthropicApiKey,
                'anthropic-version: 2023-06-01'
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'model' => $this->anthropicModel,
                'system' => $systemPrompt,
                'messages' => $messages,
                'max_tokens' => 150
            ])
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Anthropic API error (HTTP $httpCode): " . substr($response, 0, 200));
            return null;
        }

        $data = json_decode($response, true);
        return $data['content'][0]['text'] ?? null;
    }

    /**
     * Appel API Google Gemini
     */
    private function callGemini(string $systemPrompt, string $userMessage, array $history): ?string
    {
        if (!$this->geminiApiKey) {
            return null;
        }

        // Construire le contenu avec l'historique
        $contents = [];
        $firstMessage = true;

        foreach ($history as $turn) {
            $userContent = $turn['user_message'];
            if ($firstMessage) {
                $userContent = $systemPrompt . "\n\n" . $userContent;
                $firstMessage = false;
            }
            $contents[] = ['role' => 'user', 'parts' => [['text' => $userContent]]];
            $contents[] = ['role' => 'model', 'parts' => [['text' => $turn['agent_response']]]];
        }

        // Ajouter le nouveau message
        $newContent = $userMessage;
        if ($firstMessage) {
            $newContent = $systemPrompt . "\n\n" . $userMessage;
        }
        $contents[] = ['role' => 'user', 'parts' => [['text' => $newContent]]];

        $url = sprintf(
            'https://generativelanguage.googleapis.com/v1/models/%s:generateContent?key=%s',
            $this->geminiModel,
            $this->geminiApiKey
        );

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode([
                'contents' => $contents,
                'generationConfig' => [
                    'maxOutputTokens' => 150,
                    'temperature' => 0.7
                ]
            ])
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("Gemini API error (HTTP $httpCode): " . substr($response, 0, 200));
            return null;
        }

        $data = json_decode($response, true);
        return $data['candidates'][0]['content']['parts'][0]['text'] ?? null;
    }

    /**
     * Générer l'audio via ElevenLabs
     */
    public function generateSpeech(string $text, string $language = 'fr'): ?string
    {
        if (!$this->elevenlabsApiKey) {
            return null;
        }

        // Nettoyer le texte (retirer les crochets d'urgence)
        $cleanText = preg_replace('/\[(?:CRITICAL|HIGH|MEDIUM|LOW)\]/', '', $text);
        $cleanText = trim($cleanText);

        $ch = curl_init("https://api.elevenlabs.io/v1/text-to-speech/{$this->elevenlabsVoiceId}");
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'xi-api-key: ' . $this->elevenlabsApiKey
            ],
            CURLOPT_POSTFIELDS => json_encode([
                'text' => $cleanText,
                'model_id' => 'eleven_multilingual_v2',
                'voice_settings' => [
                    'stability' => 0.75,
                    'similarity_boost' => 0.75,
                    'style' => 0.5,
                    'use_speaker_boost' => true
                ]
            ])
        ]);

        $audioData = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200) {
            error_log("ElevenLabs API error: HTTP $httpCode");
            return null;
        }

        // Sauvegarder l'audio temporairement
        $filename = 'voice_' . uniqid() . '.mp3';
        $filepath = STORAGE_PATH . '/voice/' . $filename;

        if (!is_dir(dirname($filepath))) {
            mkdir(dirname($filepath), 0755, true);
        }

        file_put_contents($filepath, $audioData);

        return '/storage/voice/' . $filename;
    }

    /**
     * Détecter un mot-code dans le texte
     */
    private function detectCodeWord(string $text, array $codeWords): ?string
    {
        $textLower = mb_strtolower($text);

        // Vérifier code rouge (urgence maximale)
        if (!empty($codeWords['red'])) {
            if (mb_strpos($textLower, mb_strtolower($codeWords['red'])) !== false) {
                return 'CODE_RED';
            }
        }

        // Vérifier code orange (situation inquiétante)
        if (!empty($codeWords['orange'])) {
            if (mb_strpos($textLower, mb_strtolower($codeWords['orange'])) !== false) {
                return 'CODE_ORANGE';
            }
        }

        // Vérifier mot d'annulation
        if (!empty($codeWords['cancel'])) {
            if (mb_strpos($textLower, mb_strtolower($codeWords['cancel'])) !== false) {
                return 'CANCEL';
            }
        }

        return null;
    }

    /**
     * Extraire le niveau d'urgence de la réponse
     */
    private function extractUrgencyLevel(string $response): string
    {
        if (preg_match('/\[(CRITICAL|HIGH|MEDIUM|LOW)\]/i', $response, $matches)) {
            return strtoupper($matches[1]);
        }
        return 'MEDIUM'; // Défaut
    }

    /**
     * Déterminer l'action à effectuer
     */
    private function determineAction(string $urgencyLevel, ?string $detectedCode): ?string
    {
        if ($detectedCode === 'CODE_RED' || $urgencyLevel === 'CRITICAL') {
            return 'CALL_POLICE';
        }

        if ($detectedCode === 'CANCEL') {
            return 'CANCEL_ALERT';
        }

        if ($urgencyLevel === 'HIGH') {
            return 'ESCALATE';
        }

        return null;
    }

    /**
     * Escalader l'incident à la police
     */
    private function escalateIncident(string $incidentId): void
    {
        $stmt = $this->db->prepare("
            UPDATE incidents
            SET status = 'escalated',
                emergency_called = 1,
                updated_at = NOW()
            WHERE uuid = ?
        ");
        $stmt->execute([$incidentId]);
    }

    /**
     * Récupérer les mots-codes de l'utilisateur
     */
    private function getUserCodeWords(int $userId): array
    {
        $stmt = $this->db->prepare("
            SELECT code_word_red, code_word_orange, code_word_cancel
            FROM alert_preferences
            WHERE user_id = ?
        ");
        $stmt->execute([$userId]);
        $prefs = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$prefs) {
            return [];
        }

        return [
            'red' => $prefs['code_word_red'] ?? null,
            'orange' => $prefs['code_word_orange'] ?? null,
            'cancel' => $prefs['code_word_cancel'] ?? null
        ];
    }

    /**
     * Récupérer une session
     */
    private function getSession(string $sessionId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT * FROM ai_voice_sessions
            WHERE session_id = ? AND status = 'active'
        ");
        $stmt->execute([$sessionId]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * Récupérer l'historique de conversation
     */
    private function getConversationHistory(string $sessionId, int $limit = 10): array
    {
        $stmt = $this->db->prepare("
            SELECT user_message, agent_response
            FROM ai_conversation_turns
            WHERE session_id = ?
            ORDER BY created_at DESC
            LIMIT ?
        ");
        $stmt->execute([$sessionId, $limit]);
        return array_reverse($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    /**
     * Sauvegarder un tour de conversation
     */
    private function saveConversationTurn(
        string $sessionId,
        string $userMessage,
        string $agentResponse,
        string $urgencyLevel
    ): void {
        $stmt = $this->db->prepare("
            INSERT INTO ai_conversation_turns
            (session_id, user_message, agent_response, urgency_level, created_at)
            VALUES (?, ?, ?, ?, NOW())
        ");
        $stmt->execute([$sessionId, $userMessage, $agentResponse, $urgencyLevel]);
    }

    /**
     * Terminer une session
     */
    public function endSession(string $sessionId): array
    {
        // Récupérer la transcription complète
        $history = $this->getConversationHistory($sessionId, 100);

        $transcript = '';
        foreach ($history as $turn) {
            $transcript .= "USER: " . $turn['user_message'] . "\n";
            $transcript .= "AGENT: " . $turn['agent_response'] . "\n\n";
        }

        // Mettre à jour la session
        $stmt = $this->db->prepare("
            UPDATE ai_voice_sessions
            SET status = 'completed',
                transcript = ?,
                ended_at = NOW()
            WHERE session_id = ?
        ");
        $stmt->execute([$transcript, $sessionId]);

        // Mettre à jour l'incident avec la transcription
        $session = $this->getSession($sessionId);
        if ($session) {
            $stmt = $this->db->prepare("
                UPDATE incidents
                SET ai_transcript = ?,
                    ai_session_id = ?
                WHERE uuid = ?
            ");
            $stmt->execute([$transcript, $sessionId, $session['incident_id']]);
        }

        return [
            'success' => true,
            'transcript' => $transcript,
            'turns_count' => count($history)
        ];
    }

    /**
     * Réponse de fallback si API indisponible
     */
    private function getFallbackResponse(string $language): string
    {
        $responses = [
            'fr' => "Je suis là avec vous. Restez calme. Les secours sont alertés. [MEDIUM]",
            'en' => "I'm here with you. Stay calm. Help has been alerted. [MEDIUM]"
        ];

        return $responses[$language] ?? $responses['fr'];
    }

    /**
     * Obtenir le message d'introduction
     */
    public function getIntroMessage(string $language = 'fr'): string
    {
        $messages = [
            'fr' => "Bonjour, je suis l'agent SHIELD. Je suis là pour vous aider. Êtes-vous en sécurité ?",
            'en' => "Hello, I'm the SHIELD agent. I'm here to help you. Are you safe?"
        ];

        return $messages[$language] ?? $messages['fr'];
    }
}
