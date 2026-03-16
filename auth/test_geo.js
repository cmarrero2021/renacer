async function test() {
    try {
        const url = 'https://nominatim.openstreetmap.org/reverse?format=json&lat=10.488&lon=-66.903&accept-language=es';
        console.log('Fetching...');
        const res = await fetch(url, {
            headers: { 'User-Agent': 'RENCAM-App/1.0 (marrero.c@gmail.com)' }
        });
        console.log('Status code:', res.status);
    } catch (e) {
        console.log('Error type:', e.name);
        console.log('Error message:', e.message);
    }
}
test();
