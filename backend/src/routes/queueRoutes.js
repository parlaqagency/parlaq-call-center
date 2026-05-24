const router = require('express').Router();
const netgsm = require('../api/netgsm');

router.get('/stats', async (req, res) => {
  try {
    const { queue = 'satis' } = req.query;
    const crmId = `qstats_${Date.now()}`;
    const result = await netgsm.getQueueStats({ queueName: queue, crmId });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
