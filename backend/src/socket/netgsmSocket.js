const net = require('net');
const { EventEmitter } = require('events');

class NetgsmSocket extends EventEmitter {
  constructor() {
    super();
    this.socket = null;
    this.connected = false;
    this.reconnectTimer = null;
    this.buffer = '';
  }

  connect() {
    this.socket = new net.Socket();
    this.socket.setTimeout(0);

    this.socket.connect(
      parseInt(process.env.NETGSM_SOCKET_PORT),
      process.env.NETGSM_SOCKET_HOST,
      () => {
        this.connected = true;
        console.log('Netsantral socket bağlandı');
        this._login();
      }
    );

    this.socket.on('data', (data) => {
      this.buffer += data.toString();
      const lines = this.buffer.split('\n');
      this.buffer = lines.pop();
      lines.forEach((line) => {
        try {
          if (line.trim()) this._handleEvent(JSON.parse(line.trim()));
        } catch {}
      });
    });

    this.socket.on('close', () => {
      this.connected = false;
      console.log('Netsantral socket kapandı, yeniden bağlanıyor...');
      this._reconnect();
    });

    this.socket.on('error', (err) => {
      console.error('Netsantral socket hatası:', err.message);
    });
  }

  _login() {
    this.socket.write(JSON.stringify({
      command: 'login',
      crm_id: 'parlaq_socket',
      username: process.env.NETGSM_USERNAME,
      password: process.env.NETGSM_PASSWORD,
    }));
  }

  _handleEvent(event) {
    const map = {
      Inbound_call: 'inbound_call',
      Outbound_call: 'outbound_call',
      Answer: 'call_answered',
      Hangup: 'call_hangup',
      Queue: 'queue_event',
      QueueLeave: 'queue_leave',
      cdr: 'cdr',
    };
    this.emit(map[event.scenario] || 'event', event);
  }

  _reconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.connect(), 5000);
  }

  disconnect() {
    if (this.socket) this.socket.destroy();
  }
}

module.exports = new NetgsmSocket();
