// Turns the demo build into one HTML body that the hosted page can publish.
import { readFileSync, writeFileSync } from 'node:fs';

const js = readFileSync('dist-demo/app.js', 'utf8').replaceAll('</script', '<\\/script');
const css = readFileSync('dist-demo/app.css', 'utf8');

writeFileSync('dist-demo/roomiematch-demo.html', `<title>RoomieMatch</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`);
