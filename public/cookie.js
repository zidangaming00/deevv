// cookie.js — Deevv Search Preferences Manager

const DEFAULT_SETTINGS = {
  theme: "light",
  lang: "en",
  newtab: false,
  newurl: false,
  favicon: true,
  suggest: true,
};

// Ambil objek settings dari cookie (dengan fallback ke default jika kosong/invalid)
function getData() {
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    const [key, ...valueParts] = cookie.trim().split('=');
    if (key === 'settings') {
      try {
        const parsed = JSON.parse(decodeURIComponent(valueParts.join('=')));
        return { ...DEFAULT_SETTINGS, ...parsed };
      } catch (e) {
        console.error("Gagal membaca cookie settings:", e);
        return { ...DEFAULT_SETTINGS };
      }
    }
  }
  return { ...DEFAULT_SETTINGS };
}

// Simpan seluruh objek settings ke cookie (Masa aktif: 18 bulan)
function saveData(data = DEFAULT_SETTINGS) {
  const expirationDate = new Date();
  expirationDate.setMonth(expirationDate.getMonth() + 18);

  const settingsJson = encodeURIComponent(JSON.stringify(data));
  document.cookie = `settings=${settingsJson};expires=${expirationDate.toUTCString()};path=/;SameSite=Lax`;
}

// Helper untuk memperbarui 1 opsi pengaturan secara fleksibel
function updateSetting(key, value) {
  const currentSettings = getData();
  currentSettings[key] = value;
  saveData(currentSettings);
}

// Hapus/reset cookie settings
function clearData() {
  document.cookie = "settings=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax";
}
