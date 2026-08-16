const os = require('os');
const QRCode = require('qrcode');

/**
 * Score and sort network interfaces to prioritize actual Wi-Fi and LAN over virtual adapters
 */
function scoreInterface(name, address) {
  const lowerName = name.toLowerCase();

  // Deprioritize auto-assigned link-local addresses
  if (address.startsWith('169.254.')) return -100;

  // Deprioritize virtual / tunnel adapters
  if (
    lowerName.includes('vethernet') ||
    lowerName.includes('virtual') ||
    lowerName.includes('wsl') ||
    lowerName.includes('vmware') ||
    lowerName.includes('hyper-v') ||
    lowerName.includes('tailscale') ||
    lowerName.includes('zerotier') ||
    lowerName.includes('bluetooth') ||
    lowerName.includes('tunnel') ||
    lowerName.includes('vpn')
  ) {
    return 10;
  }

  // Highest priority for Wi-Fi and Wireless interfaces
  if (
    lowerName.includes('wi-fi') ||
    lowerName.includes('wifi') ||
    lowerName.includes('wireless') ||
    lowerName.includes('wlan')
  ) {
    return 100;
  }

  // High priority for physical Ethernet
  if (
    lowerName.includes('ethernet') ||
    lowerName.includes('eth') ||
    lowerName.includes('en0') ||
    lowerName.includes('lan')
  ) {
    return 90;
  }

  // Standard private LAN address ranges (e.g. 192.168.x.x, 10.x.x.x)
  if (address.startsWith('192.168.') || address.startsWith('10.')) {
    return 80;
  }

  return 50;
}

/**
 * Get all active non-internal IPv4 LAN addresses
 */
function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Filter for IPv4 and non-loopback
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push({
          interface: name,
          address: iface.address,
          score: scoreInterface(name, iface.address)
        });
      }
    }
  }

  // Sort highest score first (Wi-Fi / Ethernet at the top)
  addresses.sort((a, b) => b.score - a.score);

  // Fallback to localhost if no LAN found
  if (addresses.length === 0) {
    addresses.push({ interface: 'Loopback', address: '127.0.0.1' });
  }

  return addresses.map(({ interface: ifaceName, address }) => ({
    interface: ifaceName,
    address
  }));
}

/**
 * Generate a QR code data URI for a given URL
 */
async function generateQrDataUri(url) {
  try {
    return await QRCode.toDataURL(url, {
      margin: 2,
      width: 360,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });
  } catch (err) {
    console.error('Error generating QR code:', err);
    return null;
  }
}

module.exports = {
  getLocalIpAddresses,
  generateQrDataUri
};
