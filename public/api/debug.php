<?php
header("Content-Type: application/json");
$input = file_get_contents("php://input");
$data = json_decode($input, true);
echo json_encode([
    "raw_input" => $input,
    "parsed" => $data,
    "content_type" => $_SERVER["CONTENT_TYPE"] ?? "none"
]);

