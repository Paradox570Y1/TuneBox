// Home Page - Music Player Interface
let songs = [], playlists = [], currentSongForPlaylistSelection = null;

// Database utility
const DB = {
    async open(name, store) {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(name, 1);
            req.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(store)) 
                    db.createObjectStore(store, { keyPath: 'id' });
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    },
    async save(dbName, storeName, items) {
        const db = await this.open(dbName, storeName);
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        await store.clear();
        items.forEach(item => store.add(item));
    },
    async load(dbName, storeName) {
        const db = await this.open(dbName, storeName);
        const tx = db.transaction([storeName], 'readonly');
        return new Promise(resolve => {
            const req = tx.objectStore(storeName).getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    }
};

// Alert utility
const alert = (title, text, icon, timer = 2000) => 
    Swal.fire({ title, text, icon, timer, showConfirmButton: !timer, 
        background: '#1e1e1e', color: '#fff', customClass: { popup: 'swal-dark-popup' }});

const confirm = (title, text) => 
    Swal.fire({ title, text, icon: 'warning', showCancelButton: true, 
        confirmButtonColor: '#f44336', cancelButtonColor: '#666', 
        confirmButtonText: 'Yes, delete it!', background: '#1e1e1e', color: '#fff',
        customClass: { popup: 'swal-dark-popup' }});

// Song Card Creator
const createSongCard = song => {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.innerHTML = `
        <div class="song-album-art"><div class="default-album-art"><i class="fas fa-music"></i></div></div>
        <div class="song-info-section">
            <div class="song-title">${song.title}</div>
            <button class="song-menu"><i class="fas fa-ellipsis-v"></i></button>
        </div>`;
    
    card.onclick = () => {
        sessionStorage.setItem('currentPlaylist', JSON.stringify({
            id: "all-songs-virtual", name: "All Songs", songs: songs.map(s => s.id)
        }));
        sessionStorage.setItem('currentSong', JSON.stringify({
            title: song.title, audioURL: URL.createObjectURL(song.audioBlob), id: song.id
        }));
        window.location.href = 'player.html';
    };
    
    const menuBtn = card.querySelector('.song-menu');
    menuBtn.onclick = e => {
        e.stopPropagation();
        let menu = menuBtn.querySelector('.song-menu-tooltip');
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'song-menu-tooltip';
            menu.innerHTML = `
                <div class="song-menu-option" data-action="playlist"><i class="fas fa-plus"></i> Add to Playlist</div>
                <div class="song-menu-option" data-action="delete"><i class="fas fa-trash"></i> Delete</div>`;
            menuBtn.appendChild(menu);
            
            menu.onclick = async e => {
                e.stopPropagation();
                menu.classList.remove('active');
                if (e.target.closest('[data-action="playlist"]')) {
                    currentSongForPlaylistSelection = song.id;
                    showPlaylistSelection();
                } else if (e.target.closest('[data-action="delete"]')) {
                    const result = await confirm('Delete Song?', "You won't be able to revert this!");
                    if (result.isConfirmed) {
                        songs = songs.filter(s => s.id !== song.id);
                        playlists.forEach(p => p.songs = p.songs.filter(id => id !== song.id));
                        await Promise.all([DB.save('MusicDB', 'songs', songs), 
                                          DB.save('TuneBoxPlaylists', 'playlists', playlists)]);
                        renderSongs();
                        renderPlaylists();
                        alert('Deleted!', 'Your song has been deleted.', 'success');
                    }
                }
            };
        }
        document.querySelectorAll('.song-menu-tooltip.active').forEach(t => t !== menu && t.classList.remove('active'));
        menu.classList.toggle('active');
        setTimeout(() => {
            const close = e => !menuBtn.contains(e.target) && (menu.classList.remove('active'), document.removeEventListener('click', close));
            document.addEventListener('click', close);
        }, 0);
    };
    return card;
};

// Add Song Card
const createAddSongCard = () => {
    const card = document.createElement('div');
    card.className = 'add-song-card';
    card.innerHTML = '<div class="add-icon"><i class="fas fa-plus"></i></div><span class="add-text">Add Song</span>';
    card.onclick = () => {
        const input = document.getElementById('audioUpload');
        input.click();
        input.onchange = async e => {
            for (let file of e.target.files) {
                if (file.type.startsWith('audio/')) {
                    const buffer = await file.arrayBuffer();
                    songs.push({
                        id: Date.now() + Math.random(),
                        title: file.name.replace(/\.[^/.]+$/, ""),
                        audioBlob: new Blob([buffer], { type: file.type }),
                        duration: 0,
                        dateAdded: new Date().toISOString()
                    });
                }
            }
            await DB.save('MusicDB', 'songs', songs);
            renderSongs();
            input.value = '';
        };
    };
    return card;
};

// Render functions
const renderSongs = () => {
    const grid = document.getElementById('allSongsGrid');
    grid.innerHTML = '';
    grid.appendChild(createAddSongCard());
    songs.forEach(song => grid.appendChild(createSongCard(song)));
    const count = document.getElementById('totalSongs');
    if (count) count.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''}`;
};

const renderPlaylists = () => {
    const grid = document.getElementById('playlistsGrid');
    grid.innerHTML = '';
    
    const addTile = document.createElement('div');
    addTile.className = 'playlist-card add-tile';
    addTile.onclick = () => openModal('createPlaylistModal');
    addTile.innerHTML = '<i class="fas fa-plus"></i><span>Create Playlist</span>';
    grid.appendChild(addTile);
    
    const count = document.getElementById('totalPlaylists');
    if (count) count.textContent = `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;
    
    playlists.forEach(p => {
        if (!p.coverImage) p.coverImage = `assets/covers/cover${Math.floor(Math.random() * 8) + 1}.jpeg`;
        
        const card = document.createElement('div');
        card.className = 'playlist-card';
        card.innerHTML = `
            <div class="playlist-cover" style="background-image: url('${p.coverImage}')">
                <button class="playlist-delete-btn" title="Delete Playlist"><i class="fas fa-trash"></i></button>
            </div>
            <div class="playlist-info">
                <h4 class="playlist-name">${p.name}</h4>
                <div class="playlist-stats"><i class="fas fa-music"></i> ${p.songs?.length || 0} songs</div>
            </div>`;
        
        card.onclick = e => !e.target.closest('.playlist-delete-btn') && playPlaylist(p.id);
        card.querySelector('.playlist-delete-btn').onclick = async e => {
            e.stopPropagation();
            const result = await confirm('Delete Playlist?', 'The playlist will be deleted but songs remain in library.');
            if (result.isConfirmed) {
                playlists = playlists.filter(pl => pl.id !== p.id);
                await DB.save('TuneBoxPlaylists', 'playlists', playlists);
                renderPlaylists();
                alert('Deleted!', 'Your playlist has been deleted.', 'success');
            }
        };
        grid.appendChild(card);
    });
};

// Modal management
const openModal = id => document.getElementById(id).style.display = 'flex';
const closeModal = id => document.getElementById(id).style.display = 'none';

// Playlist selection
const showPlaylistSelection = () => {
    const list = document.getElementById('playlistSelectionList');
    list.innerHTML = playlists.length === 0 
        ? '<p style="color: #b3b3b3; text-align: center; padding: 2rem;">No playlists available. Create a playlist first!</p>'
        : playlists.map(p => `
            <div class="playlist-option" onclick="this.classList.toggle('selected'); this.querySelector('input').checked = !this.querySelector('input').checked;">
                <input type="checkbox" id="playlist-${p.id}" value="${p.id}" onclick="event.stopPropagation();">
                <div class="playlist-option-info">
                    <div class="playlist-option-name">${p.name}</div>
                    <div class="playlist-option-count">${p.songs?.length || 0} songs</div>
                </div>
            </div>`).join('');
    openModal('playlistSelectionModal');
};

const addSongToSelectedPlaylists = async () => {
    const selected = [...document.querySelectorAll('#playlistSelectionList input:checked')];
    if (selected.length === 0) return alert('No Playlist Selected', 'Please select at least one playlist!', 'info', 0);
    
    selected.forEach(cb => {
        const p = playlists.find(p => p.id == cb.value);
        if (p && !p.songs.includes(currentSongForPlaylistSelection)) 
            p.songs.push(currentSongForPlaylistSelection);
    });
    
    await DB.save('TuneBoxPlaylists', 'playlists', playlists);
    renderPlaylists();
    closeModal('playlistSelectionModal');
    alert('Success!', `Song added to ${selected.length} playlist${selected.length > 1 ? 's' : ''}!`, 'success');
};

const createPlaylist = async () => {
    const name = document.getElementById('playlistName').value.trim();
    if (!name) return alert('Oops!', 'Please enter a playlist name!', 'error', 0);
    
    playlists.push({
        id: Date.now(),
        name,
        description: document.getElementById('playlistDescription').value.trim(),
        songs: [],
        coverImage: `assets/covers/cover${Math.floor(Math.random() * 8) + 1}.jpeg`,
        createdAt: new Date().toISOString()
    });
    
    await DB.save('TuneBoxPlaylists', 'playlists', playlists);
    renderPlaylists();
    closeModal('createPlaylistModal');
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistDescription').value = '';
};

const playPlaylist = id => {
    const p = playlists.find(pl => pl.id === id);
    if (!p?.songs?.length) return alert('Empty Playlist', 'This playlist has no songs. Add songs to play it.', 'info', 0);
    
    sessionStorage.setItem('currentPlaylist', JSON.stringify({ id: p.id, name: p.name, songs: p.songs }));
    window.location.href = 'player.html';
};

const playAllSongs = () => {
    if (songs.length === 0) return alert('No Songs Available', 'Please add some songs to your library first!', 'info', 0);
    
    sessionStorage.setItem('currentPlaylist', JSON.stringify({
        id: "all-songs-ordered", name: "All Songs", songs: songs.map(s => s.id)
    }));
    window.location.href = 'player.html';
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    songs = await DB.load('MusicDB', 'songs');
    playlists = await DB.load('TuneBoxPlaylists', 'playlists');
    renderSongs();
    renderPlaylists();
    
    // Create modals HTML if not exists
    if (!document.getElementById('createPlaylistModal')) {
        document.body.insertAdjacentHTML('beforeend', `
            <div id="createPlaylistModal" class="modal" style="display: none;">
                <div class="modal-content" style="width: 400px">
                    <div class="modal-header">
                        <h3>Create Playlist</h3>
                        <button class="close-btn" onclick="closeModal('createPlaylistModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="input-group">
                            <label for="playlistName">Playlist Name</label>
                            <input type="text" id="playlistName" placeholder="Enter playlist name">
                        </div>
                        <div class="input-group">
                            <label for="playlistDescription">Description (optional)</label>
                            <textarea id="playlistDescription" placeholder="Enter playlist description"></textarea>
                        </div>
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="closeModal('createPlaylistModal')">Cancel</button>
                        <button class="modal-btn confirm" onclick="createPlaylist()">Create</button>
                    </div>
                </div>
            </div>
            <div id="playlistSelectionModal" class="modal" style="display: none;">
                <div class="modal-content" style="width: 450px">
                    <div class="modal-header">
                        <h3>Add Song to Playlists</h3>
                        <button class="close-btn" onclick="closeModal('playlistSelectionModal')">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="playlist-selection-list" id="playlistSelectionList"></div>
                    </div>
                    <div class="modal-actions">
                        <button class="modal-btn cancel" onclick="closeModal('playlistSelectionModal')">Cancel</button>
                        <button class="modal-btn confirm" onclick="addSongToSelectedPlaylists()">Add to Playlists</button>
                    </div>
                </div>
            </div>`);
    }
    
    document.getElementById('playAllBtn')?.addEventListener('click', playAllSongs);
});