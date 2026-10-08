// Example helper to add Twitch streams dynamically
function addStream(channelName) {
  const grid = document.getElementById('stream-grid');
  const card = document.createElement('div');
  card.className = 'stream-card';

  const iframe = document.createElement('iframe');
  // Replace parent domain with your actual hostname (e.g. localhost or your domain)
  iframe.src = `https://player.twitch.tv/?channel=${channelName}&parent=${window.location.hostname || 'localhost'}`;
  iframe.allowFullscreen = true;

  card.appendChild(iframe);
  grid.appendChild(card);
}

// Demo streams
const initialStreams = ['xqc', 'summit1g', 'shroud', 'tarik'];
initialStreams.forEach(stream => addStream(stream));