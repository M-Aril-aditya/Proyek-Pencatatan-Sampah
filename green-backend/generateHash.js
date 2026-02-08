const bcrypt = require('bcryptjs');

// GANTI '12345' DI BAWAH INI JIKA INGIN PASSWORD LAIN
const passwordPilihan = '@dexazerowaste2030'; 

async function buatHash() {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(passwordPilihan, salt);
    
    console.log('\n=========================================');
    console.log('Password Asli :', passwordPilihan);
    console.log('KODE HASH     :', hash);
    console.log('=========================================\n');
}

buatHash();