<?php
require '/var/www/shield/backend/php/bootstrap.php';
require '/var/www/shield/backend/php/Models/Contact.php';
$db = get_db();
$model = new \Shield\Models\Contact($db);
$contacts = $model->getByUser(1);
echo 'Found ' . count($contacts) . ' contacts' . PHP_EOL;
print_r($contacts);
