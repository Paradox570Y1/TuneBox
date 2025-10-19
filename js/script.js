// Player Page - Music Player Controls
let db, currentAudio = null, currentSongIndex = 0, songs = [], isPlaying = false;

// Utilities
const formatTime = s => isNaN(s) || s < 0 ? "0:00" : `${Math.floor(s / 60)}:${(Math.floor(s % 60)).toString().padStart(2, '0')}`;

// Database setup
const initDB = () => new Promise((resolve, reject) => {
    const req = indexedDB.open("MusicDB", 1);
    req.onupgradeneeded = e => {
        const db = e.target.result;
        if (db.objectStoreNames.contains("songs")) db.deleteObjectStore("songs");
        db.createObjectStore("songs", { keyPath: "id", autoIncrement: true }).createIndex("title", "title", { unique: false });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});

// Save song to DB
const addSongToDB = async (song, file) => {
    const buffer = await file.arrayBuffer();
    song.audioBlob = buffer;
    const tx = db.transaction("songs", "readwrite");
    await tx.objectStore("songs").add(song);
    loadSongs();
};

// Update playlist in DB
const updatePlaylistInDB = playlist => {
    return new Promise((resolve, reject) => {
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
                    tx.oncomplete = () => resolve();
                    tx.onerror = () => reject(tx.error);
                } else {
                    resolve();
                }
            };
            getReq.onerror = () => reject(getReq.error);
        };
        req.onerror = () => reject(req.error);
    });
};

// Remove song from playlist OR delete song entirely
const removeSongFromPlaylist = async songId => {
    const playlistData = sessionStorage.getItem('currentPlaylist');
    if (!playlistData) return;
    
    const playlist = JSON.parse(playlistData);
    const song = songs.find(s => s.id === songId);
    const isAllSongsView = playlist.id === "all-songs-virtual" || playlist.id === "all-songs-ordered";
    
    // Different behavior for "All Songs" vs specific playlists
    const result = await Swal.fire({
        title: isAllSongsView ? 'Delete Song?' : 'Remove Song?',
        text: isAllSongsView 
            ? `Delete "${song?.title || 'this song'}" permanently? It will be removed from all playlists.`
            : `Remove "${song?.title || 'this song'}" from "${playlist.name}" playlist?`,
        icon: isAllSongsView ? 'warning' : 'question',
        showCancelButton: true,
        confirmButtonColor: isAllSongsView ? '#f44336' : '#ff5252',
        cancelButtonColor: '#666',
        confirmButtonText: isAllSongsView ? 'Yes, delete it!' : 'Remove',
        background: '#1e1e1e',
        color: '#fff',
        customClass: { popup: 'swal-dark-popup' }
    });
    
    if (!result.isConfirmed) return;
    
    // Check if this is the currently playing song BEFORE we modify anything
    const isCurrentSong = currentAudio && songs[currentSongIndex]?.id === songId;
    // Store the currently playing song's ID to find it again after reload
    const currentlyPlayingSongId = currentAudio && !isCurrentSong ? songs[currentSongIndex]?.id : null;
    
    if (isAllSongsView) {
        // Delete song entirely from database and all playlists
        // 1. Delete from songs database
        await new Promise((resolve, reject) => {
            const tx = db.transaction("songs", "readwrite");
            const store = tx.objectStore("songs");
            const deleteReq = store.delete(songId);
            
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = () => reject(deleteReq.error);
        });
        
        // 2. Remove from all playlists
        await new Promise((resolve, reject) => {
            const playlistsReq = indexedDB.open('TuneBoxPlaylists', 1);
            playlistsReq.onsuccess = async e => {
                const pdb = e.target.result;
                const ptx = pdb.transaction(['playlists'], 'readwrite');
                const pstore = ptx.objectStore('playlists');
                
                const getAllReq = pstore.getAll();
                getAllReq.onsuccess = () => {
                    const allPlaylists = getAllReq.result || [];
                    
                    allPlaylists.forEach(p => {
                        p.songs = p.songs.filter(id => id !== songId);
                        pstore.put(p);
                    });
                    
                    ptx.oncomplete = () => resolve();
                    ptx.onerror = () => reject(ptx.error);
                };
            };
            playlistsReq.onerror = () => reject(playlistsReq.error);
        });
        
        // 3. Handle playback if current song was removed (BEFORE reloading)
        if (isCurrentSong) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        // 4. Reload songs and show success
        await loadSongs();
        
        // 5. Update currentSongIndex if a different song was removed
        if (currentlyPlayingSongId) {
            const newIndex = songs.findIndex(s => s.id === currentlyPlayingSongId);
            if (newIndex !== -1) {
                currentSongIndex = newIndex;
                // Re-highlight the correct song
                document.querySelectorAll(".playlist-item").forEach((item, i) => 
                    item.classList.toggle("active", i === newIndex));
            }
        }
        
        // 6. Auto-play next song if we removed the current one
        if (isCurrentSong && songs.length > 0) {
            loadSong(Math.min(currentSongIndex, songs.length - 1));
            currentAudio?.play().catch(() => {});
        }
        
        Swal.fire({
            title: 'Deleted!',
            text: 'Song has been permanently deleted.',
            icon: 'success',
            timer: 2000,
            showConfirmButton: false,
            background: '#1e1e1e',
            color: '#fff',
            customClass: { popup: 'swal-dark-popup' }
        });
    } else {
        // Just remove from current playlist
        playlist.songs = playlist.songs.filter(id => id !== songId);
        sessionStorage.setItem('currentPlaylist', JSON.stringify(playlist));
        await updatePlaylistInDB(playlist);
        
        // Handle playback if current song was removed (BEFORE reloading)
        if (isCurrentSong) {
            currentAudio.pause();
            currentAudio = null;
        }
        
        await loadSongs();
        
        // Update currentSongIndex if a different song was removed
        if (currentlyPlayingSongId) {
            const newIndex = songs.findIndex(s => s.id === currentlyPlayingSongId);
            if (newIndex !== -1) {
                currentSongIndex = newIndex;
                // Re-highlight the correct song
                document.querySelectorAll(".playlist-item").forEach((item, i) => 
                    item.classList.toggle("active", i === newIndex));
            }
        }
        
        // Auto-play next song if we removed the current one
        if (isCurrentSong && songs.length > 0) {
            loadSong(Math.min(currentSongIndex, songs.length - 1));
            currentAudio?.play().catch(() => {});
        }
    }
};

// Load songs from DB
const loadSongs = async () => {
    if (!db) return;
    
    const playlistData = sessionStorage.getItem('currentPlaylist');
    const currentSongData = sessionStorage.getItem('currentSong');
    const playlistHeader = document.querySelector(".playlist-header h3");
    
    const tx = db.transaction("songs", "readonly");
    const allSongs = await new Promise(resolve => {
        const req = tx.objectStore("songs").getAll();
        req.onsuccess = () => resolve(req.result.map(song => ({
            ...song,
            audioURL: URL.createObjectURL(new Blob([song.audioBlob], { type: 'audio/*' }))
        })));
    });
    
    // Filter songs based on playlist
    if (playlistData) {
        const playlist = JSON.parse(playlistData);
        playlistHeader.textContent = playlist.name;
        songs = allSongs.filter(s => playlist.songs?.includes(s.id));
        
        // Reorder if coming from "All Songs" with specific selection
        if (currentSongData && playlist.id === "all-songs-virtual") {
            const current = JSON.parse(currentSongData);
            const idx = songs.findIndex(s => s.id === current.id);
            if (idx !== -1) songs.unshift(...songs.splice(idx, 1));
        }
    } else {
        playlistHeader.textContent = currentSongData ? "Now Playing" : "All Songs";
        songs = allSongs;
    }
    
    // Render playlist
    const list = document.getElementById("playlist-songs");
    list.innerHTML = songs.length === 0 
        ? '<li class="playlist-item empty-message"><span class="song-title">No songs in this playlist</span><span class="song-info">Add songs from the home page</span></li>'
        : songs.map((song, idx) => {
            const showDeleteBtn = !!playlistData; // Show delete button for both playlists and "All Songs"
            return `<li class="playlist-item" data-index="${idx}" data-song-id="${song.id}">
                <div class="song-content">
                    <span class="song-title">${song.title}</span>
                    <span class="song-info">${song.duration && !isNaN(song.duration) ? formatTime(song.duration) : ''}</span>
                </div>
                ${showDeleteBtn ? '<button class="remove-from-playlist" title="Remove from playlist"><i class="fas fa-times"></i></button>' : ''}
            </li>`;
        }).join('');
    
    // Event delegation for song items
    list.onclick = e => {
        const item = e.target.closest('.playlist-item');
        if (!item) return;
        
        if (e.target.closest('.remove-from-playlist')) {
            removeSongFromPlaylist(parseFloat(item.dataset.songId)); // Use parseFloat for decimal IDs
        } else {
            loadSong(parseInt(item.dataset.index));
            currentAudio?.play();
        }
    };
    
    // Auto-play first song if coming from home page
    if (songs.length > 0 && !currentAudio) {
        setTimeout(() => {
            loadSong(0);
            if (playlistData) {
                const playlist = JSON.parse(playlistData);
                if (playlist.id === "all-songs-virtual" || playlist.id === "all-songs-ordered" || currentSongData) {
                    currentAudio?.play().catch(() => {});
                }
            }
        }, 100);
    }
};

// Load specific song
const loadSong = idx => {
    if (idx < 0 || idx >= songs.length) return;
    
    const song = songs[idx];
    currentSongIndex = idx;
    
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    
    currentAudio = new Audio(song.audioURL);
    currentAudio.volume = document.querySelector(".volume-bar").value / 100;
    window.currentAudio = currentAudio;
    
    document.querySelector(".track-title").textContent = song.title;
    document.querySelector(".total-duration").textContent = formatTime(song.duration);
    document.querySelector(".current-time").textContent = "0:00";
    document.querySelector(".progress-bar").value = 0;
    document.querySelector(".track-art img").src = "./assets/LOGO.png";
    
    document.querySelectorAll(".playlist-item").forEach((item, i) => 
        item.classList.toggle("active", i === idx));
    
    const playPauseIcon = document.querySelector("#play-pause-btn i");
    
    currentAudio.ontimeupdate = () => {
        if (!isNaN(currentAudio.duration)) {
            const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
            document.querySelector(".progress-bar").value = progress || 0;
            document.querySelector(".current-time").textContent = formatTime(currentAudio.currentTime);
            document.querySelector(".total-duration").textContent = formatTime(currentAudio.duration);
        }
    };
    
    currentAudio.onended = () => {
        if (currentSongIndex < songs.length - 1) {
            loadSong(currentSongIndex + 1);
            currentAudio.play();
        } else {
            playPauseIcon.classList.replace("fa-pause", "fa-play");
            isPlaying = false;
        }
    };
    
    currentAudio.onplay = () => {
        playPauseIcon.classList.replace("fa-play", "fa-pause");
        isPlaying = true;
    };
    
    currentAudio.onpause = () => {
        playPauseIcon.classList.replace("fa-pause", "fa-play");
        isPlaying = false;
    };
};

// Initialize app
document.addEventListener("DOMContentLoaded", async () => {
    db = await initDB();
    
    const elements = {
        playPauseBtn: document.getElementById("play-pause-btn"),
        playPauseIcon: document.querySelector("#play-pause-btn i"),
        progressBar: document.querySelector(".progress-bar"),
        volumeBar: document.querySelector(".volume-bar"),
        addSongBtn: document.getElementById("addSongBtn"),
        backToHomeBtn: document.getElementById("backToHome"),
        audioUpload: document.getElementById("audioUpload"),
        prevBtn: document.getElementById("prev-btn"),
        nextBtn: document.getElementById("next-btn")
    };
    
    // Add song handler
    elements.addSongBtn?.addEventListener("click", () => elements.audioUpload.click());
    
    elements.audioUpload?.addEventListener("change", async e => {
        const file = e.target.files[0];
        if (!file) return;
        
        const audio = new Audio(URL.createObjectURL(file));
        audio.onloadedmetadata = async () => {
            await addSongToDB({
                title: file.name.replace(/\.[^/.]+$/, ""),
                duration: Math.floor(audio.duration) || 0,
                fileName: file.name,
                addedAt: new Date()
            }, file);
            URL.revokeObjectURL(audio.src);
        };
        audio.onerror = () => URL.revokeObjectURL(audio.src);
    });
    
    // Back to home
    elements.backToHomeBtn?.addEventListener("click", () => {
        sessionStorage.removeItem('currentPlaylist');
        window.location.href = 'index.html';
    });
    
    // Play/Pause
    elements.playPauseBtn.addEventListener("click", () => {
        if (!currentAudio && songs.length > 0) return loadSong(0);
        currentAudio?.[isPlaying ? 'pause' : 'play']();
    });
    
    // Previous/Next
    elements.prevBtn?.addEventListener("click", () => {
        if (songs.length === 0) return;
        loadSong((currentSongIndex - 1 + songs.length) % songs.length);
        currentAudio?.play().catch(() => {});
    });
    
    elements.nextBtn?.addEventListener("click", () => {
        if (songs.length === 0) return;
        loadSong((currentSongIndex + 1) % songs.length);
        currentAudio?.play().catch(() => {});
    });
    
    // Progress bar
    elements.progressBar.addEventListener("input", () => {
        if (currentAudio) currentAudio.currentTime = (elements.progressBar.value / 100) * currentAudio.duration;
    });
    
    // Volume
    elements.volumeBar.addEventListener("input", () => {
        if (currentAudio) currentAudio.volume = elements.volumeBar.value / 100;
    });
    
    // Load songs
    loadSongs();
});

