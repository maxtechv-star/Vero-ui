/*
  base   : https://www.mediafire.com/
  update : 25 oktober 2025, 11:56 wita
  by     : wolep
*/

import fetch from 'node-fetch';

const mfdl = async function (mfUrl) {
    const r = await fetch(mfUrl, {
        headers: {
            "accept-encoding": "gzip, deflate, br, zstd",
            "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
        }
    })
    if (!r.ok) throw Error(`${r.status} ${r.statusText}`)
    const html = await r.text()
    const url = html.match(/href="(.+?)" +id="downloadButton"/)?.[1]
    if (!url) throw Error(`gagal menemukan match url`)

    const ft_m = html.match(/class="filetype"><span>(.+?)<(?:.+?) \((.+?)\)/)
    const fileType = `${ft_m?.[1] || '(no ext)'} ${ft_m?.[2] || '(no ext)'}`

    const d_m = html.match(/<div class="description">(.+?)<\/div>/s)?.[1]
    const titleExt = d_m?.match(/subheading">(.+?)</)?.[1] || '(no title extension)'
    const descriptionExt = d_m?.match(/<p>(.+?)<\/p>/)?.[1] || '(no about extension)'

    const fileSize = html.match(/File size: <span>(.+?)<\/span>/)?.[1] || '(no file size)'
    const uploaded = html.match(/Uploaded: <span>(.+?)<\/span>/)?.[1] || '(no date)'
    const fileName = html.match(/class="filename">(.+?)<\/div>/)?.[1] || '(no file name)'
    const result = { fileName, fileSize, url, uploaded, fileType, titleExt, descriptionExt }

    return result
}

export default function (app) {
    app.get('/downloader/mediafire', async (req, res) => {
        try {
            const { url } = req.query;

            // Validate required parameters
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: 'Missing required parameter',
                    message: 'Please provide url parameter'
                });
            }

            // Validate URL format and ensure it's a MediaFire URL
            try {
                const parsedUrl = new URL(url);
                if (!parsedUrl.hostname.includes('mediafire.com')) {
                    return res.status(400).json({
                        status: false,
                        error: 'Invalid URL',
                        message: 'Please provide a valid MediaFire URL'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    status: false,
                    error: 'Invalid URL',
                    message: 'Please provide a valid URL'
                });
            }

            // Process MediaFire download
            const result = await mfdl(url);

            res.json({
                status: true,
                creator: "VeronDev",
                result: {
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    downloadUrl: result.url,
                    uploaded: result.uploaded,
                    fileType: result.fileType,
                    title: result.titleExt,
                    description: result.descriptionExt
                },
                message: "MediaFire file information retrieved successfully"
            });

        } catch (error) {
            console.error('MediaFire Downloader Error:', error);
            
            if (error.message.includes('404')) {
                return res.status(404).json({
                    status: false,
                    error: 'File not found',
                    message: 'The MediaFire file was not found or has been removed'
                });
            }
            
            if (error.message.includes('gagal menemukan match url')) {
                return res.status(404).json({
                    status: false,
                    error: 'Download link not found',
                    message: 'Could not extract download link from the MediaFire page'
                });
            }
            
            if (error.message.includes('Failed to fetch')) {
                return res.status(400).json({
                    status: false,
                    error: 'Network error',
                    message: 'Could not connect to MediaFire. Please check the URL and try again.'
                });
            }

            res.status(500).json({
                status: false,
                error: 'Processing failed',
                message: error.message || 'Failed to process MediaFire URL'
            });
        }
    });

    // POST endpoint for flexibility
    app.post('/downloader/mediafire', async (req, res) => {
        try {
            const { url } = req.body;

            // Validate required parameters
            if (!url) {
                return res.status(400).json({
                    status: false,
                    error: 'Missing required parameter',
                    message: 'Please provide url parameter'
                });
            }

            // Validate URL format and ensure it's a MediaFire URL
            try {
                const parsedUrl = new URL(url);
                if (!parsedUrl.hostname.includes('mediafire.com')) {
                    return res.status(400).json({
                        status: false,
                        error: 'Invalid URL',
                        message: 'Please provide a valid MediaFire URL'
                    });
                }
            } catch (error) {
                return res.status(400).json({
                    status: false,
                    error: 'Invalid URL',
                    message: 'Please provide a valid URL'
                });
            }

            // Process MediaFire download
            const result = await mfdl(url);

            res.json({
                status: true,
                creator: "VeronDev",
                result: {
                    fileName: result.fileName,
                    fileSize: result.fileSize,
                    downloadUrl: result.url,
                    uploaded: result.uploaded,
                    fileType: result.fileType,
                    title: result.titleExt,
                    description: result.descriptionExt
                },
                message: "MediaFire file information retrieved successfully"
            });

        } catch (error) {
            console.error('MediaFire Downloader Error:', error);
            
            if (error.message.includes('404')) {
                return res.status(404).json({
                    status: false,
                    error: 'File not found',
                    message: 'The MediaFire file was not found or has been removed'
                });
            }
            
            res.status(500).json({
                status: false,
                error: 'Processing failed',
                message: error.message || 'Failed to process MediaFire URL'
            });
        }
    });
}