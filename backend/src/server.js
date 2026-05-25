require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { calls, agents } = require('./db/queries');
const { authMiddleware, adminOnly } = require('./middleware/auth');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// Public
app.use('/api/auth', require('./routes/authRoutes'));

// Protected
app.use('/api/calls', authMiddleware, require('./routes/callRoutes'));
app.use('/api/agents', authMiddleware, require('./routes/agentRoutes')(io));
app.use('/api/queue', authMiddleware, require('./routes/queueRoutes'));
app.use('/api/reports', authMiddleware, require('./routes/reportRoutes'));
app.use('/api/customers', authMiddleware, require('./routes/customerRoutes'));
app.use('/api/appointments', authMiddleware, require('./routes/appointmentRoutes'));
app.use('/api/campaigns', authMiddleware, require('./routes/campaignRoutes')(io));

app.post('/webhook/netgsm', (req, res) => {
  const event = req.body;
  io.emit('santral_event', event);

  if (event.scenario === 'Hangup' && event.unique_id) {
    calls.update(event.unique_id, { status: 'answered', ended_at: new Date(), duration: event.duration || 0 }).catch(() => {});
    dialer.onCallEnd(event.unique_id, event.disposition || 'ANSWERED').catch(() => {});
  }
  if (event.scenario === 'cdr' && event.agentextension) {
    // Ses kaydı varsa kaydet
    const recordingUrl = event.seskaydi || event.seskayit || event.recording_url;
    if (recordingUrl && event.unique_id) {
      calls.update(event.unique_id, { recording_url: recordingUrl }).catch(() => {});
    }

    agents.getAll().then(r => {
      const agent = r.rows.find(a => a.extension === String(event.agentextension));
      if (agent) {
        agents.updateStatus(agent.id, 'available').catch(() => {});
        dialer.onCallEnd(event.unique_id || '', event.disposition || 'missed').catch(() => {});
      }
    }).catch(() => {});
  }

  res.sendStatus(200);
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

const dialer = require('./dialer');
const netgsmSocket = require('./socket/netgsmSocket');
const socketEvents = ['inbound_call', 'outbound_call', 'call_answered', 'call_hangup', 'queue_event', 'queue_leave', 'cdr'];
socketEvents.forEach(ev => netgsmSocket.on(ev, data => io.emit(ev, data)));

if (process.env.NETGSM_PASSWORD) {
  netgsmSocket.connect();
} else {
  console.log('NETGSM_PASSWORD tanımlı değil, socket bağlantısı atlandı');
}

dialer.start(io);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Parlaq Call Center backend: http://localhost:${PORT}`));
