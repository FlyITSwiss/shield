<?php
declare(strict_types=1);

/**
 * SHIELD API - AI Voice Agent Endpoint
 *
 * POST /api/ai-agent?action=create-session   - Créer une session vocale
 * POST /api/ai-agent?action=process          - Traiter une transcription
 * POST /api/ai-agent?action=end-session      - Terminer une session
 * GET  /api/ai-agent?action=intro            - Message d'introduction
 * GET  /api/ai-agent?action=status           - Statut du service
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

try {
    require_once __DIR__ . '/../../backend/php/Services/AIVoiceAgentService.php';
    $service = new \Shield\Services\AIVoiceAgentService($db);

    switch ($action) {
        // ========== PUBLIC ENDPOINTS ==========

        case 'status':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            jsonResponse([
                'success' => true,
                'enabled' => $service->isEnabled(),
                'features' => [
                    'stt' => 'deepgram',
                    'tts' => 'elevenlabs',
                    'ai' => 'multi-provider (openai, anthropic, gemini)'
                ]
            ]);
            break;

        case 'intro':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            $language = $_GET['language'] ?? 'fr';
            jsonResponse([
                'success' => true,
                'message' => $service->getIntroMessage($language),
                'language' => $language
            ]);
            break;

        // ========== AUTHENTICATED ENDPOINTS ==========

        case 'create-session':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            $userId = requireAuth();
            $data = getJsonInput();

            if (empty($data['incident_id'])) {
                jsonError('incident_id_required', 400);
            }

            $result = $service->createSession(
                $data['incident_id'],
                $userId,
                $data['language'] ?? 'fr'
            );

            jsonResponse([
                'success' => true,
                'session' => $result
            ]);
            break;

        case 'process':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            requireAuth();
            $data = getJsonInput();

            if (empty($data['session_id']) || empty($data['transcript'])) {
                jsonError('session_id_and_transcript_required', 400);
            }

            $result = $service->processTranscription(
                $data['session_id'],
                $data['transcript'],
                $data['language'] ?? 'fr'
            );

            jsonResponse([
                'success' => true,
                'response' => $result
            ]);
            break;

        case 'end-session':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            requireAuth();
            $data = getJsonInput();

            if (empty($data['session_id'])) {
                jsonError('session_id_required', 400);
            }

            $result = $service->endSession($data['session_id']);
            jsonResponse($result);
            break;

        case 'tts':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            requireAuth();
            $data = getJsonInput();

            if (empty($data['text'])) {
                jsonError('text_required', 400);
            }

            $audioUrl = $service->generateSpeech(
                $data['text'],
                $data['language'] ?? 'fr'
            );

            if (!$audioUrl) {
                jsonError('tts_unavailable', 503);
            }

            jsonResponse([
                'success' => true,
                'audio_url' => $audioUrl
            ]);
            break;

        default:
            jsonError('endpoint_not_found', 404);
    }
} catch (Exception $e) {
    error_log('AI Agent API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}
