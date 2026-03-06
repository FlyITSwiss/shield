<?php
declare(strict_types=1);

/**
 * API Public Tracking Endpoints
 *
 * Endpoints publics accessibles via share_id (sans authentification)
 *
 * GET  /api/track.php?share_id={uuid}          - Obtenir les données de l'incident
 * POST /api/track.php?action=acknowledge       - Confirmer la réception (contact)
 * POST /api/track.php?action=responding        - Signaler en route
 * POST /api/track.php?action=arrived           - Signaler arrivée
 * POST /api/track.php?action=update-location   - Mettre à jour position contact
 */

require_once __DIR__ . '/_bootstrap.php';

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? 'get';
$shareId = $_GET['share_id'] ?? null;

try {
    // Rate limiting strict pour les endpoints publics
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!checkRateLimit("track:{$ip}", 30, 60)) {
        jsonError('rate_limit_exceeded', 429);
    }

    // Valider share_id format UUID
    if (!$shareId || !preg_match('/^[a-f0-9-]{36}$/i', $shareId)) {
        jsonError('invalid_share_id', 400);
    }

    // Récupérer le share et valider
    $share = getValidShare($db, $shareId);
    if (!$share) {
        jsonError('share_not_found_or_expired', 404);
    }

    switch ($action) {
        case 'get':
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            handleGetTrackingData($db, $share);
            break;

        case 'acknowledge':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            handleAcknowledge($db, $share, getJsonInput());
            break;

        case 'responding':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            handleResponding($db, $share, getJsonInput());
            break;

        case 'arrived':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            handleArrived($db, $share, getJsonInput());
            break;

        case 'update-location':
            if ($method !== 'POST') {
                jsonError('method_not_allowed', 405);
            }
            handleUpdateContactLocation($db, $share, getJsonInput());
            break;

        default:
            jsonError('unknown_action', 400);
    }
} catch (Exception $e) {
    error_log('Track API Error: ' . $e->getMessage());
    jsonError('internal_error', 500);
}

/**
 * Récupérer un share valide (non expiré, non révoqué)
 */
function getValidShare(PDO $db, string $shareId): ?array
{
    $stmt = $db->prepare("
        SELECT
            s.*,
            i.user_id as incident_user_id,
            i.status as incident_status,
            i.triggered_at,
            i.trigger_method,
            i.severity_level,
            i.latitude as incident_lat,
            i.longitude as incident_lng,
            i.address as incident_address
        FROM incident_shares s
        INNER JOIN incidents i ON i.id = s.incident_id
        WHERE s.share_id = :share_id
          AND s.expires_at > NOW()
          AND s.revoked_at IS NULL
          AND i.status IN ('active', 'escalated')
        LIMIT 1
    ");
    $stmt->execute(['share_id' => $shareId]);
    $share = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($share) {
        // Mettre à jour le compteur de vues
        $updateStmt = $db->prepare("
            UPDATE incident_shares
            SET view_count = view_count + 1,
                last_viewed_at = NOW()
            WHERE id = :id
        ");
        $updateStmt->execute(['id' => $share['id']]);
    }

    return $share ?: null;
}

/**
 * GET - Obtenir les données de tracking
 */
function handleGetTrackingData(PDO $db, array $share): void
{
    $incidentId = (int)$share['incident_id'];

    // Récupérer la position la plus récente
    $locationStmt = $db->prepare("
        SELECT latitude, longitude, accuracy, altitude, speed, heading, recorded_at
        FROM incident_locations
        WHERE incident_id = :incident_id
        ORDER BY recorded_at DESC
        LIMIT 1
    ");
    $locationStmt->execute(['incident_id' => $incidentId]);
    $location = $locationStmt->fetch(PDO::FETCH_ASSOC);

    // Récupérer l'utilisateur en danger
    $userStmt = $db->prepare("
        SELECT id, first_name, last_name, phone, avatar_url
        FROM users
        WHERE id = :id
    ");
    $userStmt->execute(['id' => $share['incident_user_id']]);
    $user = $userStmt->fetch(PDO::FETCH_ASSOC);

    // Récupérer les statuts des contacts (si autorisé)
    $contacts = [];
    if ($share['allow_contact_list']) {
        $contactsStmt = $db->prepare("
            SELECT
                cr.contact_id,
                tc.first_name,
                tc.last_name,
                cr.status,
                cr.acknowledged_at,
                cr.responding_at,
                cr.arrived_at,
                cr.eta_minutes,
                cr.response_message
            FROM contact_responses cr
            INNER JOIN trusted_contacts tc ON tc.id = cr.contact_id
            WHERE cr.incident_id = :incident_id
            ORDER BY cr.status DESC, cr.acknowledged_at ASC
        ");
        $contactsStmt->execute(['incident_id' => $incidentId]);
        $contacts = $contactsStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Récupérer l'historique des positions (si autorisé)
    $locationHistory = [];
    if ($share['allow_location_history']) {
        $historyStmt = $db->prepare("
            SELECT latitude, longitude, recorded_at
            FROM incident_locations
            WHERE incident_id = :incident_id
            ORDER BY recorded_at DESC
            LIMIT 50
        ");
        $historyStmt->execute(['incident_id' => $incidentId]);
        $locationHistory = $historyStmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Calculer le temps écoulé
    $triggeredAt = new DateTime($share['triggered_at']);
    $now = new DateTime();
    $elapsed = $now->diff($triggeredAt);
    $elapsedMinutes = ($elapsed->h * 60) + $elapsed->i;

    jsonResponse([
        'success' => true,
        'incident' => [
            'id' => $share['incident_id'],
            'status' => $share['incident_status'],
            'severity_level' => $share['severity_level'],
            'trigger_method' => $share['trigger_method'],
            'triggered_at' => $share['triggered_at'],
            'elapsed_minutes' => $elapsedMinutes,
            'address' => $share['incident_address']
        ],
        'user' => [
            'first_name' => $user['first_name'] ?? '',
            'last_name' => $user['last_name'] ?? '',
            'phone' => $user['phone'] ?? '',
            'avatar_url' => $user['avatar_url'] ?? null
        ],
        'location' => $location ? [
            'latitude' => (float)$location['latitude'],
            'longitude' => (float)$location['longitude'],
            'accuracy' => $location['accuracy'] ? (float)$location['accuracy'] : null,
            'speed' => $location['speed'] ? (float)$location['speed'] : null,
            'heading' => $location['heading'] ? (float)$location['heading'] : null,
            'recorded_at' => $location['recorded_at']
        ] : null,
        'location_history' => $locationHistory,
        'contacts' => $contacts,
        'share' => [
            'recipient_type' => $share['recipient_type'],
            'contact_id' => $share['recipient_contact_id'] ? (int)$share['recipient_contact_id'] : null,
            'expires_at' => $share['expires_at'],
            'allow_location_history' => (bool)$share['allow_location_history'],
            'allow_contact_list' => (bool)$share['allow_contact_list']
        ]
    ]);
}

/**
 * POST - Confirmer la réception de l'alerte
 */
function handleAcknowledge(PDO $db, array $share, array $data): void
{
    $contactId = $share['recipient_contact_id'];
    if (!$contactId) {
        jsonError('no_contact_linked', 400);
    }

    $incidentId = (int)$share['incident_id'];
    $message = isset($data['message']) ? substr(trim($data['message']), 0, 500) : null;

    // Mettre à jour ou créer la réponse du contact
    $stmt = $db->prepare("
        INSERT INTO contact_responses (incident_id, contact_id, status, acknowledged_at, response_message, created_at, updated_at)
        VALUES (:incident_id, :contact_id, 'acknowledged', NOW(), :message, NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            status = 'acknowledged',
            acknowledged_at = COALESCE(acknowledged_at, NOW()),
            response_message = COALESCE(:message2, response_message),
            updated_at = NOW()
    ");
    $stmt->execute([
        'incident_id' => $incidentId,
        'contact_id' => $contactId,
        'message' => $message,
        'message2' => $message
    ]);

    // Notifier l'utilisateur en danger
    notifyUser($db, (int)$share['incident_user_id'], 'contact_acknowledged', [
        'contact_id' => $contactId,
        'incident_id' => $incidentId
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'acknowledged'
    ]);
}

/**
 * POST - Signaler en route
 */
function handleResponding(PDO $db, array $share, array $data): void
{
    $contactId = $share['recipient_contact_id'];
    if (!$contactId) {
        jsonError('no_contact_linked', 400);
    }

    $incidentId = (int)$share['incident_id'];
    $etaMinutes = isset($data['eta_minutes']) ? (int)$data['eta_minutes'] : null;

    $stmt = $db->prepare("
        UPDATE contact_responses
        SET status = 'responding',
            responding_at = NOW(),
            eta_minutes = :eta,
            updated_at = NOW()
        WHERE incident_id = :incident_id AND contact_id = :contact_id
    ");
    $stmt->execute([
        'incident_id' => $incidentId,
        'contact_id' => $contactId,
        'eta' => $etaMinutes
    ]);

    if ($stmt->rowCount() === 0) {
        // Créer si n'existe pas
        $insertStmt = $db->prepare("
            INSERT INTO contact_responses (incident_id, contact_id, status, acknowledged_at, responding_at, eta_minutes, created_at, updated_at)
            VALUES (:incident_id, :contact_id, 'responding', NOW(), NOW(), :eta, NOW(), NOW())
        ");
        $insertStmt->execute([
            'incident_id' => $incidentId,
            'contact_id' => $contactId,
            'eta' => $etaMinutes
        ]);
    }

    // Notifier l'utilisateur
    notifyUser($db, (int)$share['incident_user_id'], 'contact_responding', [
        'contact_id' => $contactId,
        'incident_id' => $incidentId,
        'eta_minutes' => $etaMinutes
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'responding'
    ]);
}

/**
 * POST - Signaler arrivée sur place
 */
function handleArrived(PDO $db, array $share, array $data): void
{
    $contactId = $share['recipient_contact_id'];
    if (!$contactId) {
        jsonError('no_contact_linked', 400);
    }

    $incidentId = (int)$share['incident_id'];

    $stmt = $db->prepare("
        UPDATE contact_responses
        SET status = 'arrived',
            arrived_at = NOW(),
            updated_at = NOW()
        WHERE incident_id = :incident_id AND contact_id = :contact_id
    ");
    $stmt->execute([
        'incident_id' => $incidentId,
        'contact_id' => $contactId
    ]);

    if ($stmt->rowCount() === 0) {
        $insertStmt = $db->prepare("
            INSERT INTO contact_responses (incident_id, contact_id, status, acknowledged_at, responding_at, arrived_at, created_at, updated_at)
            VALUES (:incident_id, :contact_id, 'arrived', NOW(), NOW(), NOW(), NOW(), NOW())
        ");
        $insertStmt->execute([
            'incident_id' => $incidentId,
            'contact_id' => $contactId
        ]);
    }

    // Notifier l'utilisateur
    notifyUser($db, (int)$share['incident_user_id'], 'contact_arrived', [
        'contact_id' => $contactId,
        'incident_id' => $incidentId
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'arrived'
    ]);
}

/**
 * POST - Mettre à jour la position du contact
 */
function handleUpdateContactLocation(PDO $db, array $share, array $data): void
{
    $contactId = $share['recipient_contact_id'];
    if (!$contactId) {
        jsonError('no_contact_linked', 400);
    }

    $latitude = isset($data['latitude']) ? (float)$data['latitude'] : null;
    $longitude = isset($data['longitude']) ? (float)$data['longitude'] : null;

    if (!$latitude || !$longitude) {
        jsonError('missing_coordinates', 400);
    }

    // Valider les coordonnées
    if ($latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
        jsonError('invalid_coordinates', 400);
    }

    $incidentId = (int)$share['incident_id'];

    $stmt = $db->prepare("
        UPDATE contact_responses
        SET contact_latitude = :lat,
            contact_longitude = :lng,
            contact_last_location_at = NOW(),
            updated_at = NOW()
        WHERE incident_id = :incident_id AND contact_id = :contact_id
    ");
    $stmt->execute([
        'incident_id' => $incidentId,
        'contact_id' => $contactId,
        'lat' => $latitude,
        'lng' => $longitude
    ]);

    jsonResponse([
        'success' => true,
        'message' => 'location_updated'
    ]);
}

/**
 * Envoyer une notification à l'utilisateur en danger
 */
function notifyUser(PDO $db, int $userId, string $type, array $data): void
{
    try {
        // Insérer une notification en BDD
        $stmt = $db->prepare("
            INSERT INTO notifications (user_id, type, title, body, data, created_at)
            VALUES (:user_id, :type, :title, :body, :data, NOW())
        ");

        $title = match ($type) {
            'contact_acknowledged' => 'Contact a vu votre alerte',
            'contact_responding' => 'Un contact est en route',
            'contact_arrived' => 'Un contact est arrivé',
            default => 'Mise à jour'
        };

        $stmt->execute([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'body' => json_encode($data),
            'data' => json_encode($data)
        ]);

        // TODO: Envoyer push notification via FCM
    } catch (Exception $e) {
        error_log('Failed to notify user: ' . $e->getMessage());
    }
}
