
<?php
header('Content-Type: application/xml; charset=utf-8');

$urls = [
    'https://procurebest.com/',
    // এখানে আপনার অন্যান্য Public Page-এর URL যোগ করুন
    // 'https://procurebest.com/about.php',
    // 'https://procurebest.com/contact.php',
];

echo '<?xml version="1.0" encoding="UTF-8"?>';
?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<?php foreach ($urls as $url): ?>
    <url>
        <loc><?= htmlspecialchars($url, ENT_XML1, 'UTF-8') ?></loc>
    </url>
<?php endforeach; ?>
</urlset>
