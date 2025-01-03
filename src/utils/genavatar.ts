export default async function generateAvatar(text: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    // Generate multiple colors from hash
    const colors = [];
    for(let i = 0; i < 24; i += 6) {
        colors.push('#' + hash.slice(i, i + 6));
    }
    
    // Use hash values to generate random shapes
    const shapes = [
        `<circle cx="${30 + (hashArray[0] % 20)}" cy="${30 + (hashArray[1] % 20)}" r="${20 + (hashArray[2] % 10)}" fill="${colors[0]}" opacity="0.8"/>`,
        `<rect x="${20 + (hashArray[3] % 30)}" y="${20 + (hashArray[4] % 30)}" width="${30 + (hashArray[5] % 10)}" height="${30 + (hashArray[6] % 10)}" transform="rotate(${hashArray[7] % 360} 40 40)" fill="${colors[1]}" opacity="0.8"/>`,
        `<polygon points="${40 + (hashArray[8] % 20)},${20 + (hashArray[9] % 20)} ${60 + (hashArray[10] % 20)},${40 + (hashArray[11] % 20)} ${20 + (hashArray[12] % 20)},${50 + (hashArray[13] % 20)}" fill="${colors[2]}" opacity="0.8"/>`,
    ].join('');

    const svg = `
        <svg width="80" height="80" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:0.5" />
                    <stop offset="100%" style="stop-color:${colors[1]};stop-opacity:0.5" />
                </linearGradient>
            </defs>
            <rect width="80" height="80" fill="url(#grad)"/>
            ${shapes}
        </svg>
    `;

    const encoded = encodeURIComponent(svg)
        .replace(/'/g, '%27')
        .replace(/"/g, '%22');

    return `data:image/svg+xml;charset=utf-8,${encoded}`;
}