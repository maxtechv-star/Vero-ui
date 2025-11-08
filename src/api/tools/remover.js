import fetch from 'node-fetch';
import crypto from 'crypto';

function generateCookie() {
  const distinctId = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Date.now();
  const sensors = {
    distinct_id: distinctId,
    first_id: "",
    props: {
      $latest_traffic_source_type: "自然搜索流量",
      $latest_search_keyword: "未取到値",
      $latest_referrer: "https://yandex.com/"
    },
    $device_id: distinctId
  };
  const sensorsEncoded = encodeURIComponent(JSON.stringify(sensors));
  const gaMain = `GA1.1.${Math.floor(1e9 + Math.random() * 1e9)}.${timestamp}`;
  const gaSub = `GS2.1.s${timestamp}$o2$g0$t${timestamp + 1000}$j58$l0$h0`;
  const gclAu = `1.1.${Math.floor(1e9 + Math.random() * 1e9)}.${timestamp}`;
  const cfBm = crypto.randomBytes(32).toString('base64url').slice(0, 64);
  return [
    'locale=en_US',
    'clientLocale=en_US',
    `sensorsdata2015jssdkcross=${sensorsEncoded}`,
    `_gcl_au=${gclAu}`,
    `_ga=${gaMain}`,
    `__cf_bm=${cfBm}-${timestamp}-1.0.1.1-${crypto.randomBytes(16).toString('base64url')}`,
    `_ga_7HXB45DMZS=${gaSub}`
  ].join('; ');
}

const baseHeaders = {
  'accept': 'application/json, text/plain, */*',
  'accept-language': 'id-ID',
  'origin': 'https://www.pxbee.com',
  'referer': 'https://www.pxbee.com/',
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36',
  'x-app-id': 'app-pxbee-web'
};

async function RemoverWm(imageUrl) {
  const cookie = generateCookie();
  const headers = { ...baseHeaders, cookie };

  const submitRes = await fetch('https://api.pxbee.com/task/submit', {
    method: 'POST',
    headers: { ...headers, 'content-type': 'application/json;charset=UTF-8' },
    body: JSON.stringify({ type: 'textremover', method: 'free', data: { userImageUrl: imageUrl } })
  });
  const submitJson = await submitRes.json();

  if (submitJson.code !== '000') {
    return { status: submitRes.status, success: false, message: submitJson.msg || 'Submit gagal' };
  }

  const taskId = submitJson.data[0].taskId;
  const start = Date.now();

  while (true) {
    const pollRes = await fetch(`https://api.pxbee.com/task/get?ids=${taskId}&taskId=${taskId}`, { headers });
    const pollJson = await pollRes.json();

    if (pollJson.code !== '000') {
      return { status: pollRes.status, success: false, message: pollJson.msg || 'Polling gagal' };
    }

    const task = pollJson.data[0];
    if (task.status === 1) {
      return {
        status: 200,
        success: true,
        resultUrl: task.result.url,
        key: taskId,
        message: 'Gambar berhasil dihapus teksnya!'
      };
    }
    if (task.status === 2) {
      return { status: 500, success: false, message: 'Task gagal di server' };
    }
    if (Date.now() - start > 300000) {
      return { status: 408, success: false, message: 'Timeout nunggu hasil' };
    }

    await new Promise(r => setTimeout(r, 2000));
  }
}

export default function (app) {
  app.get('/tools/remover', async (req, res) => {
    try {
      const { imageUrl } = req.query;

      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: 'Missing required parameter',
          message: 'imageUrl parameter is required'
        });
      }

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        return res.status(400).json({
          status: false,
          error: 'Invalid URL',
          message: 'Please provide a valid image URL'
        });
      }

      const result = await RemoverWm(imageUrl);

      if (result.success) {
        res.json({
          status: true,
          creator: "VeronDev",
          result: {
            imageUrl: result.resultUrl,
            key: result.key
          },
          message: result.message
        });
      } else {
        res.status(result.status || 500).json({
          status: false,
          error: 'Processing failed',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Watermark removal error:', error);
      res.status(500).json({
        status: false,
        error: 'Internal server error',
        message: 'An error occurred while processing the image'
      });
    }
  });

  // Add POST endpoint as well for flexibility
  app.post('/tools/remover', async (req, res) => {
    try {
      const { imageUrl } = req.body;

      if (!imageUrl) {
        return res.status(400).json({
          status: false,
          error: 'Missing required parameter',
          message: 'imageUrl parameter is required'
        });
      }

      // Validate URL format
      try {
        new URL(imageUrl);
      } catch (error) {
        return res.status(400).json({
          status: false,
          error: 'Invalid URL',
          message: 'Please provide a valid image URL'
        });
      }

      const result = await RemoverWm(imageUrl);

      if (result.success) {
        res.json({
          status: true,
          creator: "VeronDev",
          result: {
            imageUrl: result.resultUrl,
            key: result.key
          },
          message: result.message
        });
      } else {
        res.status(result.status || 500).json({
          status: false,
          error: 'Processing failed',
          message: result.message
        });
      }
    } catch (error) {
      console.error('Watermark removal error:', error);
      res.status(500).json({
        status: false,
        error: 'Internal server error',
        message: 'An error occurred while processing the image'
      });
    }
  });
}