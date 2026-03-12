<?php
$file = __DIR__ . '/api/auth.php';
$content = file_get_contents($file);

$old = <<<'OLD'
        case 'verify':
            // Vérifie si le token JWT est valide (pour éviter les boucles de redirection)
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }
            try {
                $userId = requireAuth();
                jsonResponse(['success' => true, 'valid' => true, 'user_id' => $userId]);
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'valid' => false]);
            }
            break;
OLD;

$new = <<<'NEW'
        case 'verify':
            // Vérifie si le token JWT est valide (pour éviter les boucles de redirection)
            if ($method !== 'GET') {
                jsonError('method_not_allowed', 405);
            }

            $token = getBearerToken();
            if (!$token) {
                jsonResponse(['success' => false, 'valid' => false, 'error' => 'no_token']);
                break;
            }

            try {
                require_once __DIR__ . '/../../backend/php/Services/AuthService.php';
                $authService = new \Shield\Services\AuthService($db);
                $payload = $authService->validateToken($token);

                if ($payload && isset($payload['user_id'])) {
                    jsonResponse(['success' => true, 'valid' => true, 'user_id' => (int)$payload['user_id']]);
                } else {
                    jsonResponse(['success' => false, 'valid' => false, 'error' => 'invalid_token']);
                }
            } catch (Exception $e) {
                jsonResponse(['success' => false, 'valid' => false, 'error' => 'token_validation_failed']);
            }
            break;
NEW;

$content = str_replace($old, $new, $content);
$result = file_put_contents($file, $content);
echo "Written $result bytes\n";
