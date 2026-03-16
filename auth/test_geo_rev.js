async function test() {
    try {
        const url = 'https://photon.komoot.io/reverse?lat=10.488&lon=-66.903';
        console.log('Fetching Photon Reverse...');
        const res = await fetch(url);
        console.log('Status code:', res.status);
        const data = await res.json();
        console.log('Full Data:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.log('Error message:', e.message);
    }
}
test();
