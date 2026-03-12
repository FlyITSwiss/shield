<?php
/**
 * Script temporaire pour fixer le mot de passe du user de test
 * A supprimer après utilisation
 */

// Connexion directe à la BDD
$host = 'shield-db-local';
$dbname = 'shield';
$user = 'shield_user';
$pass = 'shield_password';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8mb4", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Générer le hash
    $password = 'Test123!!';
    $hash = password_hash($password, PASSWORD_BCRYPT);

    echo "Password: $password\n";
    echo "Generated hash: $hash\n";

    // Vérifier que le hash fonctionne
    $verify = password_verify($password, $hash);
    echo "Verify before insert: " . ($verify ? 'TRUE' : 'FALSE') . "\n";

    if (!$verify) {
        echo "ERROR: Hash generation failed!\n";
        exit(1);
    }

    // Mettre à jour l'utilisateur
    $stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE email = ?");
    $result = $stmt->execute([$hash, 'test@shield-app.local']);

    echo "Update result: " . ($result ? 'SUCCESS' : 'FAILED') . "\n";
    echo "Rows affected: " . $stmt->rowCount() . "\n";

    // Vérifier que c'est bien enregistré
    $stmt = $pdo->prepare("SELECT id, email, password_hash, is_active FROM users WHERE email = ?");
    $stmt->execute(['test@shield-app.local']);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        echo "\nUser found:\n";
        echo "  ID: " . $user['id'] . "\n";
        echo "  Email: " . $user['email'] . "\n";
        echo "  Hash: " . $user['password_hash'] . "\n";
        echo "  Active: " . $user['is_active'] . "\n";

        // Test final de vérification
        $finalVerify = password_verify($password, $user['password_hash']);
        echo "\nFinal verify from DB: " . ($finalVerify ? 'TRUE' : 'FALSE') . "\n";
    } else {
        echo "ERROR: User not found!\n";
    }

} catch (PDOException $e) {
    echo "Database error: " . $e->getMessage() . "\n";
    exit(1);
}
