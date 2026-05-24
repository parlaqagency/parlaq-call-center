const axios = require('axios');

const cfg = () => ({
  username: process.env.NETGSM_USERNAME,
  password: process.env.NETGSM_PASSWORD,
  trunk: process.env.NETGSM_TRUNK,
  baseUrl: process.env.NETGSM_API_BASE,
});

function get(path, params) {
  const { username, password, baseUrl } = cfg();
  return axios.get(`${baseUrl}/${username}/${path}`, {
    params: { username, password, ...params },
  }).then(r => r.data);
}

async function startOutboundCall({ customerPhone, extensionNumber, crmId }) {
  return get('originate', {
    customer_num: customerPhone,
    pbxnum: cfg().username,
    internal_num: extensionNumber,
    ring_timeout: 30,
    crm_id: crmId,
    wait_response: 1,
    originate_order: 'if',
    trunk: cfg().trunk,
  });
}

async function hangupCall({ uniqueId, crmId }) {
  return get('hangup', { unique_id: uniqueId, crm_id: crmId });
}

async function muteCall({ uniqueId, crmId, direction = 'all', state = 'mute' }) {
  return get('muteaudio', { unique_id: uniqueId, crm_id: crmId, direction, state });
}

async function transferCall({ uniqueId, crmId, extension }) {
  return get('xfer', { unique_id: uniqueId, crm_id: crmId, exten: extension });
}

async function getQueueStats({ queueName, crmId }) {
  return get('queuestats', { queue: queueName, crm_id: crmId });
}

async function agentLogin({ extension, queue, crmId, paused = 0, penalty = 1 }) {
  return get('agentlogin', { exten: extension, queue, crm_id: crmId, paused, penalty });
}

async function agentLogoff({ extension, queue, crmId }) {
  return get('agentlogoff', { exten: extension, queue, crm_id: crmId });
}

async function agentPause({ extension, queue, crmId, paused, reason = '' }) {
  return get('agentpause', { exten: extension, queue, crm_id: crmId, paused, reason });
}

async function getCDR({ startDate, stopDate, queryType, phone }) {
  const { username, password } = cfg();
  const body = { usercode: username, password, startdate: startDate, stopdate: stopDate };
  if (queryType && phone) { body.querytype = queryType; body.no = [phone]; }
  const r = await axios.post(process.env.NETGSM_REPORT_URL, body);
  return r.data;
}

async function getCallStats({ startDate, stopDate }) {
  const { username, password } = cfg();
  const xml = `<?xml version="1.0"?><mainbody><header><usercode>${username}</usercode><password>${password}</password><startdate>${startDate}</startdate><stopdate>${stopDate}</stopdate></header></mainbody>`;
  const r = await axios.post(process.env.NETGSM_STATS_URL, xml, { headers: { 'Content-Type': 'text/xml' } });
  return r.data;
}

module.exports = { startOutboundCall, hangupCall, muteCall, transferCall, getQueueStats, agentLogin, agentLogoff, agentPause, getCDR, getCallStats };
