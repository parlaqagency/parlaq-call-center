const netgsm = require('./netgsm');

/**
 * Formats a Date object or timestamp into Netgsm's ddMMyyyyHHmm format.
 * @param {Date|string|number} date 
 * @returns {string}
 */
function formatNetgsmDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear());
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}${month}${year}${hours}${minutes}`;
}

/**
 * Queries Netgsm CDR for a given call log row and finds the voice recording URL.
 * @param {object} call - PostgreSQL call_logs row
 * @returns {Promise<string|null>} - Recording URL if found, null otherwise
 */
async function fetchRecordingUrl(call) {
  if (!call || !call.customer_phone) {
    return null;
  }

  // Define date range: 10 minutes before call started to 2 hours after call started
  const startTime = new Date(call.started_at || call.created_at);
  const startDate = formatNetgsmDate(new Date(startTime.getTime() - 10 * 60 * 1000));
  const stopDate = formatNetgsmDate(new Date(startTime.getTime() + 120 * 60 * 1000));

  // Clean customer phone (remove leading zeros or non-digits if necessary, Netgsm report expects it as stored)
  const phone = call.customer_phone.replace(/\D/g, '');

  console.log(`[RecordingService] Querying Netgsm CDR for phone: ${phone}, range: ${startDate} - ${stopDate}`);

  try {
    const response = await netgsm.getCDR({
      startDate,
      stopDate,
      phone
    });

    console.log(`[RecordingService] Netgsm response for ${phone}:`, JSON.stringify(response));

    if (!response) {
      return null;
    }

    // Determine the array of records
    let records = [];
    if (Array.isArray(response)) {
      records = response;
    } else if (response.data && Array.isArray(response.data)) {
      records = response.data;
    } else if (response.cdr && Array.isArray(response.cdr)) {
      records = response.cdr;
    } else if (typeof response === 'object') {
      // If Netgsm returned a single object instead of an array
      records = [response];
    }

    if (records.length === 0) {
      console.log(`[RecordingService] No CDR records returned by Netgsm for phone: ${phone}`);
      return null;
    }

    // Try to find the matching call in the records
    let match = null;

    // 1. Try matching by unique_id first
    if (call.unique_id) {
      match = records.find(r => 
        (r.unique_id && String(r.unique_id) === String(call.unique_id)) ||
        (r.uniqueid && String(r.uniqueid) === String(call.unique_id)) ||
        (r.crm_id && String(r.crm_id) === String(call.unique_id))
      );
    }

    // 2. If no unique_id match, try fuzzy match on time & duration
    if (!match) {
      console.log(`[RecordingService] No unique_id match, attempting fuzzy match for phone: ${phone}`);
      const callDuration = call.duration || 0;
      
      match = records.find(r => {
        const recordDuration = parseInt(r.duration || r.sure || 0, 10);
        const durationDiff = Math.abs(recordDuration - callDuration);
        
        // If duration is within 15 seconds, and phone matches
        const matchesPhone = 
          (r.caller_num && r.caller_num.includes(phone)) ||
          (r.called_num && r.called_num.includes(phone)) ||
          (r.caller && r.caller.includes(phone)) ||
          (r.callee && r.callee.includes(phone)) ||
          (r.gsm && r.gsm.includes(phone));
          
        return matchesPhone && durationDiff <= 15;
      });
    }

    if (match) {
      const recordingUrl = match.seskaydi || match.seskayit || match.recording_url || match.url;
      if (recordingUrl) {
        console.log(`[RecordingService] Found matching recording URL: ${recordingUrl}`);
        return recordingUrl;
      } else {
        console.log(`[RecordingService] Match found, but no recording URL present in Netgsm record:`, JSON.stringify(match));
      }
    } else {
      console.log(`[RecordingService] No match found among Netgsm CDR records for call id: ${call.id}`);
    }

    return null;
  } catch (err) {
    console.error(`[RecordingService] Error querying Netgsm CDR:`, err.message);
    return null;
  }
}

module.exports = {
  fetchRecordingUrl
};
