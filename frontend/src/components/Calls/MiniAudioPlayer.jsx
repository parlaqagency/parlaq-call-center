import { useState, useEffect, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, AlertCircle, Loader2 } from 'lucide-react';

export default function MiniAudioPlayer({ src, callId }) {
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState(false);

  const audioRef = useRef(null);

  // Auto-append &towav for Netgsm links to ensure wav playback in browser
  const playableUrl = src ? (src.includes('towav') ? src : `${src}&towav`) : null;

  useEffect(() => {
    if (!playableUrl) return;

    const audio = new Audio(playableUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setLoading(false);
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setPlaying(false);
      setCurrentTime(0);
    };

    const onError = (e) => {
      console.error('[AudioPlayer] Error playing audio:', e);
      setError(true);
      setLoading(false);
      setPlaying(false);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [playableUrl]);

  const togglePlay = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      setLoading(true);
      audioRef.current.play()
        .then(() => {
          setPlaying(true);
          setLoading(false);
        })
        .catch(() => {
          setError(true);
          setLoading(false);
        });
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const newMute = !muted;
    audioRef.current.muted = newMute;
    setMuted(newMute);
  };

  const handleProgressChange = (e) => {
    e.stopPropagation();
    if (!audioRef.current) return;
    const newTime = Number(e.target.value);
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (secs) => {
    if (isNaN(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  if (error) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-200" title="Ses dosyası yüklenemedi">
        <AlertCircle size={10} />
        Hata
      </span>
    );
  }

  return (
    <div 
      className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full px-3 py-1 text-slate-700 shadow-sm max-w-[240px] w-full"
      onClick={e => e.stopPropagation()}
    >
      {/* Play/Pause Button */}
      <button
        onClick={togglePlay}
        disabled={loading}
        className="w-6 h-6 rounded-full bg-slate-900 flex items-center justify-center text-white hover:bg-slate-800 focus:outline-none transition-all flex-shrink-0 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin text-white" />
        ) : playing ? (
          <Pause size={12} fill="white" />
        ) : (
          <Play size={12} fill="white" className="ml-0.5" />
        )}
      </button>

      {/* Progress Bar & Time */}
      <div className="flex-1 flex flex-col min-w-0">
        <input
          type="range"
          min={0}
          max={duration || 100}
          value={currentTime}
          onChange={handleProgressChange}
          className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 focus:outline-none"
        />
        <div className="flex items-center justify-between text-[9px] font-mono text-slate-400 mt-0.5 tabular-nums select-none">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Mute Button */}
      <button
        onClick={toggleMute}
        className="text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
      >
        {muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
      </button>
    </div>
  );
}
