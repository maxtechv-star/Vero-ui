import axios from 'axios'

export default function lyricsRoute(app) {
    app.get("/search/lyrics", async (req, res) => {
        try {
            const { query } = req.query
            
            if (!query) {
                return res.status(400).json({
                    status: false,
                    error: "Query parameter is required",
                    message: "Please provide a song title or artist"
                })
            }

            const { data } = await axios.get(`https://lrclib.net/api/search?q=${encodeURIComponent(query)}`, {
                headers: {
                    referer: `https://lrclib.net/search/${encodeURIComponent(query)}`,
                    'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
                },
                timeout: 10000
            })

            if (!data || !data[0]) {
                return res.status(404).json({
                    status: false,
                    error: "No lyrics found",
                    message: `No lyrics found for "${query}"`
                })
            }

            let song = data[0]

            let track = song.trackName || 'Unknown Track'
            let artist = song.artistName || 'Unknown Artist'
            let album = song.albumName || 'Unknown Album'
            let duration = song.duration ? `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}` : 'Unknown Duration'

            let plainLyrics = song.plainLyrics
            let syncedLyrics = song.syncedLyrics

            let lyrics = plainLyrics
            if (!lyrics && syncedLyrics) {
                lyrics = syncedLyrics.replace(/\[.*?\]/g, '').trim()
            }
            
            if (!lyrics) {
                lyrics = 'No lyrics available'
            }

            const result = {
                track: track,
                artist: artist,
                album: album,
                duration: duration,
                lyrics: lyrics,
                hasSyncedLyrics: !!syncedLyrics
            }

            res.json({
                status: true,
                data: result,
                query: query,
                message: `Found lyrics for "${artist} - ${track}"`
            })

        } catch (error) {
            console.error("Lyrics Search Error:", error.message)
            
            res.status(500).json({
                status: false,
                error: "Lyrics search failed",
                message: error.message || "An error occurred while searching for lyrics"
            })
        }
    })
}
