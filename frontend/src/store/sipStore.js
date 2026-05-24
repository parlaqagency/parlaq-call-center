import { create } from 'zustand';
import JsSIP from 'jssip';
import axios from 'axios';

const SIP_WSS    = import.meta.env.VITE_SIP_WSS    || 'wss://sip9.netsantral.com:8089/ws';
const SIP_DOMAIN = import.meta.env.VITE_SIP_DOMAIN || 'sip9.netsantral.com';
const SIP_TRUNK  = import.meta.env.VITE_SIP_TRUNK  || '8503088214';

JsSIP.debug.disable('JsSIP:*');

function getRemoteAudio() {
  return document.getElementById('sip-remote-audio');
}

function attachRemoteStream(session) {
  session.on('peerconnection', ({ peerconnection }) => {
    peerconnection.addEventListener('track', (e) => {
      const el = getRemoteAudio();
      if (el && e.streams[0]) { el.srcObject = e.streams[0]; el.play().catch(() => {}); }
    });
    // Safari compat
    peerconnection.addEventListener('addstream', (e) => {
      const el = getRemoteAudio();
      if (el) { el.srcObject = e.stream; el.play().catch(() => {}); }
    });
  });
}

export const useSipStore = create((set, get) => ({
  ua: null,
  session: null,           // aktif çağrı oturumu
  incomingSession: null,   // cevaplanmamış gelen çağrı
  registered: false,
  registering: false,
  callStatus: null,        // null | 'calling' | 'ringing' | 'active'
  callPhone: '',
  muted: false,
  callLogId: null,         // backend CDR id

  init: async (agent) => {
    const { ua: old } = get();
    if (old) { try { old.stop(); } catch {} }

    if (!agent?.sip_password || !agent?.extension) {
      set({ ua: null, registered: false, registering: false });
      return;
    }

    // Mikrofon izni
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      console.warn('Mikrofon izni alınamadı:', e.message);
    }

    const sipUser = `${agent.extension}-${SIP_TRUNK}`;
    const socket  = new JsSIP.WebSocketInterface(SIP_WSS);

    const ua = new JsSIP.UA({
      sockets:  [socket],
      uri:      `sip:${sipUser}@${SIP_DOMAIN}`,
      password: agent.sip_password,
      display_name: agent.name || agent.extension,
      register: true,
      register_expires: 300,
      connection_recovery_min_interval: 2,
      connection_recovery_max_interval: 30,
      user_agent: 'Parlaq Call Center',
    });

    ua.on('registered',          () => set({ registered: true, registering: false }));
    ua.on('unregistered',        () => set({ registered: false }));
    ua.on('registrationFailed',  (e) => { console.warn('SIP kayıt hatası:', e.cause); set({ registered: false, registering: false }); });
    ua.on('disconnected',        () => set({ registered: false }));
    ua.on('connected',           () => set({ registering: true }));

    ua.on('newRTCSession', ({ session, originator }) => {
      if (originator === 'remote') {
        const phone = session.remote_identity?.uri?.user || 'Bilinmeyen';
        set({ incomingSession: session, callPhone: phone });

        let logId = null;
        const callStart = Date.now();
        axios.post('/api/calls/log', { customerPhone: phone, direction: 'inbound' })
          .then(({ data }) => { logId = data.id; set({ callLogId: data.id }); })
          .catch(() => {});

        const completeLog = (status) => {
          if (!logId) return;
          const duration = Math.max(0, Math.round((Date.now() - callStart) / 1000));
          axios.patch(`/api/calls/${logId}/complete`, { duration, status }).catch(() => {});
        };

        session.on('ended',  () => { completeLog('answered'); set({ incomingSession: null, session: null, callStatus: null, callPhone: '', muted: false, callLogId: null }); });
        session.on('failed', () => { completeLog('missed');   set({ incomingSession: null, session: null, callStatus: null, callPhone: '', muted: false, callLogId: null }); });
        attachRemoteStream(session);
      }
    });

    set({ ua, registering: true, registered: false });
    ua.start();
  },

  makeCall: (phone, logId = null) => {
    const { ua, registered } = get();
    if (!ua || !registered) { console.warn('SIP kayıtlı değil'); return null; }

    const target  = `sip:${phone}@${SIP_DOMAIN}`;
    const session = ua.call(target, {
      mediaConstraints:     { audio: true, video: false },
      rtcOfferConstraints:  { offerToReceiveAudio: true, offerToReceiveVideo: false },
      pcConfig: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
    });

    set({ session, callStatus: 'calling', callPhone: phone, muted: false, callLogId: logId });

    session.on('progress',   () => set({ callStatus: 'calling' }));
    session.on('accepted',   () => set({ callStatus: 'active' }));
    session.on('confirmed',  () => set({ callStatus: 'active' }));
    session.on('ended',      () => set({ session: null, callStatus: null, callPhone: '', muted: false, callLogId: null }));
    session.on('failed',     (e) => { console.warn('SIP çağrı başarısız:', e.cause); set({ session: null, callStatus: null, callPhone: '', muted: false, callLogId: null }); });

    attachRemoteStream(session);
    return session;
  },

  answer: () => {
    const { incomingSession } = get();
    if (!incomingSession) return;
    incomingSession.answer({ mediaConstraints: { audio: true, video: false } });
    set({ session: incomingSession, incomingSession: null, callStatus: 'active' });
  },

  reject: () => {
    const { incomingSession } = get();
    if (!incomingSession) return;
    try { incomingSession.terminate(); } catch {}
    set({ incomingSession: null, callPhone: '' });
  },

  hangup: () => {
    const { session } = get();
    if (!session) return;
    try { session.terminate(); } catch {}
    set({ session: null, callStatus: null, callPhone: '', muted: false, callLogId: null });
  },

  toggleMute: () => {
    const { session, muted } = get();
    if (!session) return;
    try { muted ? session.unmute({ audio: true }) : session.mute({ audio: true }); } catch {}
    set({ muted: !muted });
  },

  destroy: () => {
    const { ua, session } = get();
    try { session?.terminate(); } catch {}
    try { ua?.stop(); } catch {}
    set({ ua: null, session: null, incomingSession: null, registered: false, registering: false, callStatus: null, callPhone: '', muted: false, callLogId: null });
  },
}));
