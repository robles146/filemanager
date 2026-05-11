import React from 'react';

const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'webm'];

function isAudio(name) {
  const ext = name.split('.').pop().toLowerCase();
  return audioExts.includes(ext);
}

export default function MediaViewer({ url, fileName }) {
  const isAudioFile = isAudio(fileName);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: '#1a1a2e',
        borderRadius: '6px 6px 0 0',
        borderBottom: '1px solid #333',
      }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{fileName}</span>
        <span style={{ fontSize: 11, color: '#888' }}>{isAudioFile ? '🎵 Audio' : '🎬 Video'}</span>
      </div>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0d1117',
        borderRadius: '0 0 6px 6px',
        padding: 20,
      }}>
        {isAudioFile ? (
          <audio
            controls
            controlsList="nodownload"
            style={{ width: '100%', maxWidth: 600 }}
            src={url}
          >
            Tu navegador no soporta reproducción de audio.
          </audio>
        ) : (
          <video
            controls
            controlsList="nodownload"
            style={{ maxWidth: '100%', maxHeight: '70vh', borderRadius: 6 }}
            src={url}
          >
            Tu navegador no soporta reproducción de video.
          </video>
        )}
      </div>
    </div>
  );
}
