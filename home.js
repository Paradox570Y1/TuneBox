// Home Page - Music Player Interface

// Global variables
let songs = [];
let playlists = [];
let currentSongForPlaylistSelection = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initDatabase();
});

// Initialize database and load data
function initDatabase() {
    loadSongs();
    loadPlaylists();
}

// Add song function
function addSong() {
    const fileInput = document.getElementById('audioUpload');
    fileInput.click();
    
    fileInput.onchange = function(e) {
        const files = e.target.files;
        for (let file of files) {
            if (file.type.startsWith('audio/')) {
                // Convert file to blob for storage
                const reader = new FileReader();
                reader.readAsArrayBuffer(file);
                
                reader.onload = function() {
                    const audioBlob = new Blob([reader.result], { type: file.type });
                    
                    const song = {
                        id: Date.now() + Math.random(), // Unique ID
                        title: file.name.replace(/\.[^/.]+$/, ""), // Remove file extension
                        audioBlob: audioBlob,
                        duration: 0, // Will be calculated when played
                        dateAdded: new Date().toISOString()
                    };
                    
                    songs.push(song);
                    saveSongs();
                    renderSongs();
                };
            }
        }
        fileInput.value = ''; // Reset file input
    };
}

// Save songs to IndexedDB
function saveSongs() {
    const request = indexedDB.open('MusicDB', 1);
    
    request.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) {
            const store = db.createObjectStore('songs', { keyPath: 'id' });
        }
    };
    
    request.onsuccess = function(e) {
        const db = e.target.result;
        const transaction = db.transaction(['songs'], 'readwrite');
        const store = transaction.objectStore('songs');
        
        // Clear existing songs and add all current songs
        store.clear().onsuccess = function() {
            songs.forEach(song => {
                store.add(song);
            });
        };
        
        transaction.oncomplete = function() {
            console.log('Songs saved successfully');
        };
        
        transaction.onerror = function() {
            console.error('Error saving songs');
        };
    };
}

// Load songs from IndexedDB
function loadSongs() {
    const request = indexedDB.open('MusicDB', 1);
    
    request.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('songs')) {
            const store = db.createObjectStore('songs', { keyPath: 'id' });
        }
    };
    
    request.onsuccess = function(e) {
        const db = e.target.result;
        const transaction = db.transaction(['songs'], 'readonly');
        const store = transaction.objectStore('songs');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = function() {
            songs = getAllRequest.result || [];
            renderSongs();
        };
    };
}

// Render songs in the grid
function renderSongs() {
    const songsGrid = document.getElementById('allSongsGrid');
    songsGrid.innerHTML = '';
    
    // Add "+" tile for adding new songs
    const addTile = document.createElement('div');
    addTile.className = 'song-card add-tile';
    addTile.onclick = addSong;
    addTile.innerHTML = `
        <i class="fas fa-plus"></i>
        <span>Add Song</span>
    `;
    songsGrid.appendChild(addTile);
    
    // Add existing songs
    songs.forEach(song => {
        const songCard = document.createElement('div');
        songCard.className = 'song-card';
        songCard.onclick = () => playSong(song);
        
        songCard.innerHTML = `
            <div class="default-album-art"><i class="fas fa-music"></i></div>
            <div class="song-info-section">
                <div class="song-name">${song.title}</div>
            </div>
            <div class="song-menu" onclick="event.stopPropagation(); toggleSongMenu(this, '${song.id}')">
                <i class="fas fa-ellipsis-v"></i>
                <div class="song-menu-tooltip">
                    <div class="song-menu-option" onclick="event.stopPropagation(); addToPlaylist('${song.id}')">
                        <i class="fas fa-plus"></i> Add to Playlist
                    </div>
                    <div class="song-menu-option" onclick="event.stopPropagation(); deleteSong('${song.id}')">
                        <i class="fas fa-trash"></i> Delete
                    </div>
                </div>
            </div>
        `;
        
        songsGrid.appendChild(songCard);
    });
}

// Toggle song menu tooltip
function toggleSongMenu(menuElement, songId) {
    // Close all other open menus
    document.querySelectorAll('.song-menu-tooltip.active').forEach(tooltip => {
        if (tooltip !== menuElement.querySelector('.song-menu-tooltip')) {
            tooltip.classList.remove('active');
        }
    });
    
    // Toggle current menu
    const tooltip = menuElement.querySelector('.song-menu-tooltip');
    tooltip.classList.toggle('active');
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menuElement.contains(e.target)) {
                tooltip.classList.remove('active');
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 0);
}

// Play song function
function playSong(song) {
    // Create audio URL from blob
    const audioURL = URL.createObjectURL(song.audioBlob);
    
    // Store in session storage to be picked up by the main player
    sessionStorage.setItem('currentSong', JSON.stringify({
        title: song.title,
        audioURL: audioURL,
        id: song.id
    }));
    
    // Navigate to main player
    window.location.href = 'index.html';
}

// Delete song function
function deleteSong(songId) {
    if (confirm('Are you sure you want to delete this song?')) {
        songs = songs.filter(song => song.id != songId);
        saveSongs();
        renderSongs();
        
        // Also remove from all playlists
        playlists.forEach(playlist => {
            playlist.songs = playlist.songs.filter(id => id != songId);
        });
        savePlaylists();
        renderPlaylists();
    }
}

// Add song to playlist function
function addToPlaylist(songId) {
    currentSongForPlaylistSelection = songId;
    showPlaylistSelection();
}

// Show playlist selection modal
function showPlaylistSelection() {
    const modal = document.getElementById('playlistSelectionModal');
    const listContainer = document.getElementById('playlistSelectionList');
    
    // Clear existing options
    listContainer.innerHTML = '';
    
    if (playlists.length === 0) {
        listContainer.innerHTML = '<p style="color: #b3b3b3; text-align: center; padding: 2rem;">No playlists available. Create a playlist first!</p>';
    } else {
        playlists.forEach(playlist => {
            const option = document.createElement('div');
            option.className = 'playlist-option';
            option.innerHTML = `
                <input type="checkbox" id="playlist-${playlist.id}" value="${playlist.id}">
                <div class="playlist-option-info">
                    <div class="playlist-option-name">${playlist.name}</div>
                    <div class="playlist-option-count">${playlist.songs ? playlist.songs.length : 0} songs</div>
                </div>
            `;
            listContainer.appendChild(option);
            
            // Make the whole option clickable
            option.onclick = function(e) {
                if (e.target.type !== 'checkbox') {
                    const checkbox = option.querySelector('input[type="checkbox"]');
                    checkbox.checked = !checkbox.checked;
                }
                option.classList.toggle('selected', option.querySelector('input[type="checkbox"]').checked);
            };
        });
    }
    
    modal.classList.add('active');
}

// Close playlist selection modal
function closePlaylistSelection() {
    document.getElementById('playlistSelectionModal').classList.remove('active');
    currentSongForPlaylistSelection = null;
}

// Add song to selected playlists
function addSongToSelectedPlaylists() {
    const selectedCheckboxes = document.querySelectorAll('#playlistSelectionList input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
        alert('Please select at least one playlist!');
        return;
    }
    
    selectedCheckboxes.forEach(checkbox => {
        const playlistId = checkbox.value;
        const playlist = playlists.find(p => p.id == playlistId);
        
        if (playlist && !playlist.songs.includes(currentSongForPlaylistSelection)) {
            playlist.songs.push(currentSongForPlaylistSelection);
        }
    });
    
    savePlaylists();
    renderPlaylists();
    closePlaylistSelection();
    
    // Show success message
    const selectedCount = selectedCheckboxes.length;
    alert(`Song added to ${selectedCount} playlist${selectedCount > 1 ? 's' : ''}!`);
}

// Playlist Management Functions
function savePlaylists() {
    const request = indexedDB.open('TuneBoxPlaylists', 1);
    
    request.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('playlists')) {
            const store = db.createObjectStore('playlists', { keyPath: 'id' });
        }
    };
    
    request.onsuccess = function(e) {
        const db = e.target.result;
        const transaction = db.transaction(['playlists'], 'readwrite');
        const store = transaction.objectStore('playlists');
        
        store.clear().onsuccess = function() {
            playlists.forEach(playlist => {
                store.add(playlist);
            });
        };
    };
}

function loadPlaylists() {
    const request = indexedDB.open('TuneBoxPlaylists', 1);
    
    request.onupgradeneeded = function(e) {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('playlists')) {
            const store = db.createObjectStore('playlists', { keyPath: 'id' });
        }
    };
    
    request.onsuccess = function(e) {
        const db = e.target.result;
        const transaction = db.transaction(['playlists'], 'readonly');
        const store = transaction.objectStore('playlists');
        const getAllRequest = store.getAll();
        
        getAllRequest.onsuccess = function() {
            playlists = getAllRequest.result || [];
            renderPlaylists();
        };
    };
}

function renderPlaylists() {
    const playlistsGrid = document.getElementById('playlistsGrid');
    playlistsGrid.innerHTML = '';
    
    // Add "+" tile for creating new playlists
    const addTile = document.createElement('div');
    addTile.className = 'playlist-card add-tile';
    addTile.onclick = () => openModal('createPlaylistModal');
    addTile.innerHTML = `
        <i class="fas fa-plus"></i>
        <span>Create Playlist</span>
    `;
    playlistsGrid.appendChild(addTile);
    
    // Add existing playlists
    playlists.forEach(playlist => {
        // Use stored cover image, or assign a default if not present (for existing playlists)
        const coverImage = playlist.coverImage || `assets/covers/cover${Math.floor(Math.random() * 8) + 1}.jpeg`;
        
        // If playlist doesn't have a cover image stored, assign one and save
        if (!playlist.coverImage) {
            playlist.coverImage = coverImage;
            savePlaylists();
        }
        
        const playlistCard = document.createElement('div');
        playlistCard.className = 'playlist-card';
        playlistCard.onclick = () => openPlaylistDetails(playlist.id);
        
        playlistCard.innerHTML = `
            <div class="playlist-cover" style="background-image: url('${coverImage}')">
            </div>
            <div class="playlist-info">
                <h4 class="playlist-name">${playlist.name}</h4>
                <div class="playlist-stats">
                    <i class="fas fa-music"></i>
                    ${playlist.songs ? playlist.songs.length : 0} songs
                </div>
            </div>
        `;
        playlistsGrid.appendChild(playlistCard);
    });
}

// Modal functions
function openModal(modalId) {
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function createPlaylist() {
    const name = document.getElementById('playlistName').value.trim();
    const description = document.getElementById('playlistDescription').value.trim();
    
    if (!name) {
        alert('Please enter a playlist name!');
        return;
    }
    
    // Assign a random cover image (1-8) when creating the playlist
    const randomCover = Math.floor(Math.random() * 8) + 1;
    const coverImage = `assets/covers/cover${randomCover}.jpeg`;
    
    const playlist = {
        id: Date.now(),
        name: name,
        description: description,
        songs: [],
        coverImage: coverImage, // Store the cover image with the playlist
        createdAt: new Date().toISOString()
    };
    
    playlists.push(playlist);
    savePlaylists();
    renderPlaylists();
    closeModal('createPlaylistModal');
    
    // Clear form
    document.getElementById('playlistName').value = '';
    document.getElementById('playlistDescription').value = '';
}

// Placeholder functions for playlist management
function playPlaylist(playlistId) {
    console.log('Playing playlist:', playlistId);
    // Implementation depends on your player requirements
}

function openPlaylistDetails(playlistId) {
    console.log('Opening playlist details:', playlistId);
    // Implementation for playlist viewing/editing
}

// Format time helper function
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}