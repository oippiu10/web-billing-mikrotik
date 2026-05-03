const parseUptime = (uptime) => {
    let seconds = 0;
    const regex = /(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/;
    const matches = uptime.match(regex);
    if (matches) {
        const w = parseInt(matches[1] || '0');
        const d = parseInt(matches[2] || '0');
        const h = parseInt(matches[3] || '0');
        const m = parseInt(matches[4] || '0');
        const s = parseInt(matches[5] || '0');
        seconds = w * 7 * 24 * 3600 + d * 24 * 3600 + h * 3600 + m * 60 + s;
    }
    return seconds;
}

console.log(parseUptime("1w6d16h36m19s"));
console.log(parseUptime("16h36m19s"));
console.log(parseUptime("1d1h"));
