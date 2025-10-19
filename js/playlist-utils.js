// Playlist utilities - Consolidated functions
const playlistUtils = {
    async updateDB(playlist) {
        const req = indexedDB.open('TuneBoxPlaylists', 1);
        req.onsuccess = e => {
            const tx = e.target.result.transaction(['playlists'], 'readwrite');
            const store = tx.objectStore('playlists');
            const getReq = store.get(playlist.id);
            getReq.onsuccess = () => {
                const full = getReq.result;
                if (full) {
                    full.songs = playlist.songs;
                    store.put(full);
                }
            };
        };
    },
    
    async removeSong(songId, songs) {
        const playlistData = sessionStorage.getItem('currentPlaylist');
        if (!playlistData) return;
        
        const playlist = JSON.parse(playlistData);
        const song = songs.find(s => s.id === songId);
        
        const result = await Swal.fire({
            title: 'Remove Song?',
            text: `Remove "${song?.title || 'this song'}" from "${playlist.name}" playlist?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#ff5252',
            cancelButtonColor: '#666',
            confirmButtonText: 'Remove',
            background: '#1e1e1e',
            color: '#fff',
            customClass: { popup: 'swal-dark-popup' }
        });
        
        if (!result.isConfirmed) return false;
        
        playlist.songs = playlist.songs.filter(id => id !== songId);
        sessionStorage.setItem('currentPlaylist', JSON.stringify(playlist));
        this.updateDB(playlist);
        return true;
    }
};

// Make available globally
window.playlistUtils = playlistUtils;
