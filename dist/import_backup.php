<?php
/**
 * Script to import Firebase JSON backup into Hostinger MySQL Database.
 * RUN ONCE ON HOSTINGER, THEN DELETE THIS FILE.
 */

$db_host = 'localhost';
$db_name = 'u485225710_community';
$db_user = 'u485225710_mmp_user'; // UPDATE THIS IN HOSTINGER
$db_pass = 'YourSecurePassword123!'; // UPDATE THIS IN HOSTINGER

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die("Database connection failed. Please check credentials.");
}

// Ensure tables exist
$tables = ['config', 'users', 'registrations', 'contacts', 'donations', 'volunteers', 'template_assets'];
foreach ($tables as $table) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS `$table` (
        `id` VARCHAR(191) PRIMARY KEY,
        `data` LONGTEXT
    )");
}

$backup_file = 'trust_full_backup_2026-10-03.json';

if (!file_exists($backup_file)) {
    die("Backup file not found. Please upload trust_full_backup_2026-10-03.json to the same folder as this script.");
}

$json_data = file_get_contents($backup_file);
$backup = json_decode($json_data, true);

if (!$backup) {
    die("Invalid JSON format in backup file.");
}

$stats = [];

foreach ($backup as $collection => $documents) {
    if ($collection === 'config') {
        // config might just be a single object, we'll store it with id 'main'
        $stmt = $pdo->prepare("REPLACE INTO `config` (id, data) VALUES (?, ?)");
        $stmt->execute(['main', json_encode($documents)]);
        $stats['config'] = 1;
    } elseif (in_array($collection, $tables)) {
        $count = 0;
        $stmt = $pdo->prepare("REPLACE INTO `$collection` (id, data) VALUES (?, ?)");
        foreach ($documents as $key => $doc) {
            $id = $doc['id'] ?? $key;
            // Clean up the id from the document itself so it's not duplicated unnecessarily,
            // but keeping it is fine too.
            $stmt->execute([$id, json_encode($doc)]);
            $count++;
        }
        $stats[$collection] = $count;
    }
}

echo "<h1>Import Successful</h1>";
echo "<ul>";
foreach ($stats as $collection => $count) {
    echo "<li>Imported $count records into <strong>$collection</strong></li>";
}
echo "</ul>";
echo "<p><b>IMPORTANT:</b> Please delete this file (import_backup.php) and the backup JSON file from your server for security.</p>";
