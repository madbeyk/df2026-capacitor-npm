/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'cz.mfnet.digitalforest',
  appName: 'Digital Forest 2026',
  webDir: 'dist',
  plugins: {
    LocalNotifications: {
      // Název souboru bez přípony .png
      smallIcon: 'ic_stat_notification',
      // Barva kruhového pozadí pod ikonou v rozbalené notifikační liště (HEX kód)
      iconColor: '#00FF20',
      // Volitelně výchozí zvuk
      sound: 'beep.wav',
      allowExactNotificationAlarms: true,
    },
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#000000',
      style: 'DARK',
    },
  },
};

module.exports = config;
