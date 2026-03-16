async function test() {
    try {
        const url = 'https://photon.komoot.io/api/?q=Caracas';
        console.log('Fetching Photon...');
        const res = await fetch(url);
        console.log('Status code:', res.status);
        const data = await res.json();
        console.log('Data sample:', JSON.stringify(data).slice(0, 100));
    } catch (e) {
        console.log('Error message:', e.message);
    }
}
test();
