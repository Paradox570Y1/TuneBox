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

// Constructor function for Song Card
function SongCard(song) {
    this.song = song;
    this.element = null;
    
    // Create the song card element
    this.create = function() {
        const songCard = document.createElement('div');
        songCard.className = 'song-card';
        songCard.onclick = () => this.play();
        
        songCard.innerHTML = `
            <div class="song-album-art">
                <div class="default-album-art">
                    <i class="fas fa-music"></i>
                </div>
            </div>
            <div class="song-info-section">
                <div class="song-title">${this.song.title}</div>
                <button class="song-menu" onclick="event.stopPropagation();">
                    <i class="fas fa-ellipsis-v"></i>
                </button>
            </div>
        `;
        
        // Add menu event listener
        const menuBtn = songCard.querySelector('.song-menu');
        menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showMenu(menuBtn);
        });
        
        this.element = songCard;
        return this.element;
    };
    
    // Play the song and create a virtual playlist with all songs
    this.play = function() {
        const audioURL = URL.createObjectURL(this.song.audioBlob);
        
        // Create a virtual playlist called "All Songs"
        const allSongsPlaylist = {
            id: "all-songs-virtual",
            name: "All Songs",
            songs: songs.map(song => song.id) // Include all song IDs
        };
        
        // Save the virtual playlist to session storage
        sessionStorage.setItem('currentPlaylist', JSON.stringify(allSongsPlaylist));
        
        // Store the current song's details
        sessionStorage.setItem('currentSong', JSON.stringify({
            title: this.song.title,
            audioURL: audioURL,
            id: this.song.id
        }));
        
        // Navigate to the player page
        window.location.href = 'player.html';
    };
    
    // Show context menu
    this.showMenu = function(menuElement) {
        // Create menu if it doesn't exist
        let menu = menuElement.querySelector('.song-menu-tooltip');
        if (!menu) {
            menu = document.createElement('div');
            menu.className = 'song-menu-tooltip';
            menu.innerHTML = `
                <div class="song-menu-option" data-action="playlist">
                    <i class="fas fa-plus"></i> Add to Playlist
                </div>
                <div class="song-menu-option" data-action="delete">
                    <i class="fas fa-trash"></i> Delete
                </div>
            `;
            menuElement.appendChild(menu);
            
            // Add event listeners to menu options
            menu.querySelectorAll('.song-menu-option').forEach(option => {
                option.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const action = option.dataset.action;
                    if (action === 'playlist') {
                        this.addToPlaylist();
                    } else if (action === 'delete') {
                        this.delete();
                    }
                    menu.classList.remove('active');
                });
            });
        }
        
        // Close all other menus
        document.querySelectorAll('.song-menu-tooltip.active').forEach(tooltip => {
            if (tooltip !== menu) {
                tooltip.classList.remove('active');
            }
        });
        
        // Toggle menu
        menu.classList.toggle('active');
        
        // Close menu when clicking outside
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menuElement.contains(e.target)) {
                    menu.classList.remove('active');
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 0);
    };
    
    // Add to playlist
    this.addToPlaylist = function() {
        currentSongForPlaylistSelection = this.song.id;
        showPlaylistSelection();
    };
    
    // Delete the song
    this.delete = function() {
        Swal.fire({
            title: 'Delete Song?',
            text: "You won't be able to revert this!",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#f44336',
            cancelButtonColor: '#666',
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'Cancel',
            background: '#1e1e1e',
            color: '#fff',
            customClass: {
                popup: 'swal-dark-popup',
                confirmButton: 'swal-confirm-btn',
                cancelButton: 'swal-cancel-btn'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                songs = songs.filter(s => s.id !== this.song.id);
                saveSongs();
                renderSongs();
                
                // Also remove from all playlists
                playlists.forEach(playlist => {
                    playlist.songs = playlist.songs.filter(id => id !== this.song.id);
                });
                savePlaylists();
                renderPlaylists();
                
                // Success message
                Swal.fire({
                    title: 'Deleted!',
                    text: 'Your song has been deleted.',
                    icon: 'success',
                    timer: 2000,
                    showConfirmButton: false,
                    background: '#1e1e1e',
                    color: '#fff',
                    customClass: {
                        popup: 'swal-dark-popup'
                    }
                });
            }
        });
    };
}

// Constructor function for Add Song Card
function AddSongCard() {
    this.element = null;
    
    this.create = function() {
        const addCard = document.createElement('div');
        addCard.className = 'add-song-card';
        addCard.onclick = () => this.addSong();
        
        addCard.innerHTML = `
            <div class="add-icon">
                <i class="fas fa-plus"></i>
            </div>
            <span class="add-text">Add Song</span>
        `;
        
        this.element = addCard;
        return this.element;
    };
    
    this.addSong = function() {
        const fileInput = document.getElementById('audioUpload');
        fileInput.click();
        
        fileInput.onchange = function(e) {
            const files = e.target.files;
            for (let file of files) {
                if (file.type.startsWith('audio/')) {
                    const reader = new FileReader();
                    reader.readAsArrayBuffer(file);
                    
                    reader.onload = function() {
                        const audioBlob = new Blob([reader.result], { type: file.type });
                        
                        const song = {
                            id: Date.now() + Math.random(),
                            title: file.name.replace(/\.[^/.]+$/, ""),
                            audioBlob: audioBlob,
                            duration: 0,
                            dateAdded: new Date().toISOString()
                        };
                        
                        songs.push(song);
                        saveSongs();
                        renderSongs();
                    };
                }
            }
            fileInput.value = '';
        };
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

// Render songs in the grid using constructor functions
function renderSongs() {
    const songsGrid = document.getElementById('allSongsGrid');
    songsGrid.innerHTML = '';
    
    // Add "Add Song" tile using constructor
    const addSongCard = new AddSongCard();
    songsGrid.appendChild(addSongCard.create());
    
    // Add existing songs using constructor
    songs.forEach(song => {
        const songCard = new SongCard(song);
        songsGrid.appendChild(songCard.create());
    });
    
    // Update the song count display
    const songCountElement = document.getElementById('totalSongs');
    if (songCountElement) {
        songCountElement.textContent = `${songs.length} song${songs.length !== 1 ? 's' : ''}`;
    }
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
    window.location.href = 'player.html';
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
    
    openModal('playlistSelectionModal');
}

// Close playlist selection modal
function closePlaylistSelection() {
    closeModal('playlistSelectionModal');
    currentSongForPlaylistSelection = null;
}

// Add song to selected playlists
function addSongToSelectedPlaylists() {
    const selectedCheckboxes = document.querySelectorAll('#playlistSelectionList input[type="checkbox"]:checked');
    
    if (selectedCheckboxes.length === 0) {
        Swal.fire({
            title: 'No Playlist Selected',
            text: 'Please select at least one playlist!',
            icon: 'info',
            confirmButtonColor: '#4A90E2',
            background: '#1e1e1e',
            color: '#fff',
            customClass: {
                popup: 'swal-dark-popup',
                confirmButton: 'swal-confirm-btn'
            }
        });
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
    Swal.fire({
        title: 'Success!',
        text: `Song added to ${selectedCount} playlist${selectedCount > 1 ? 's' : ''}!`,
        icon: 'success',
        timer: 2000,
        showConfirmButton: false,
        background: '#1e1e1e',
        color: '#fff',
        customClass: {
            popup: 'swal-dark-popup'
        }
    });
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
    
    // Update the playlist count display
    const playlistCountElement = document.getElementById('totalPlaylists');
    if (playlistCountElement) {
        playlistCountElement.textContent = `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;
    }
    
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
        
        playlistCard.innerHTML = `
            <div class="playlist-cover" style="background-image: url('${coverImage}')">
                <button class="playlist-delete-btn" title="Delete Playlist">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
            <div class="playlist-info">
                <h4 class="playlist-name">${playlist.name}</h4>
                <div class="playlist-stats">
                    <i class="fas fa-music"></i>
                    ${playlist.songs ? playlist.songs.length : 0} songs
                </div>
            </div>
        `;
        
        // Add click event to play the playlist
        playlistCard.addEventListener('click', (e) => {
            // Don't trigger playlist play if clicking the delete button
            if (!e.target.closest('.playlist-delete-btn')) {
                openPlaylistDetails(playlist.id);
            }
        });
        
        // Add delete button functionality
        const deleteBtn = playlistCard.querySelector('.playlist-delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent triggering the playlist play
            deletePlaylist(playlist.id);
        });
        playlistsGrid.appendChild(playlistCard);
    });
}

// Modal Constructor
function Modal(id, title, content, actionButtonText, actionCallback, width = '400px') {
    this.id = id;
    this.title = title;
    this.content = content;
    this.actionButtonText = actionButtonText;
    this.actionCallback = actionCallback;
    this.width = width;
    this.element = null;
    
    // Create modal element
    this.create = function() {
        // Check if modal already exists
        let existingModal = document.getElementById(this.id);
        if (existingModal) {
            return existingModal;
        }
        
        // Create modal container
        const modal = document.createElement('div');
        modal.id = this.id;
        modal.className = 'modal';
        modal.style.display = 'none';
        
        // Create modal content
        modal.innerHTML = `
            <div class="modal-content" style="width: ${this.width}">
                <div class="modal-header">
                    <h3>${this.title}</h3>
                    <button class="close-btn" onclick="closeModal('${this.id}')">&times;</button>
                </div>
                <div class="modal-body">
                    ${this.content}
                </div>
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="closeModal('${this.id}')">Cancel</button>
                    <button class="modal-btn confirm" id="${this.id}-action">${this.actionButtonText}</button>
                </div>
            </div>
        `;
        
        // Add modal to document
        document.body.appendChild(modal);
        
        // Add event listener for action button
        document.getElementById(`${this.id}-action`).addEventListener('click', this.actionCallback);
        
        this.element = modal;
        return modal;
    };
    
    // Show the modal
    this.open = function() {
        if (!this.element) {
            this.create();
        }
        this.element.style.display = 'flex';
    };
    
    // Close the modal
    this.close = function() {
        if (this.element) {
            this.element.style.display = 'none';
        }
    };
}

// Create Playlist Modal Constructor
function CreatePlaylistModal() {
    const content = `
        <div class="input-group">
            <label for="playlistName">Playlist Name</label>
            <input type="text" id="playlistName" placeholder="Enter playlist name">
        </div>
        <div class="input-group">
            <label for="playlistDescription">Description (optional)</label>
            <textarea id="playlistDescription" placeholder="Enter playlist description"></textarea>
        </div>
    `;
    
    const modal = new Modal(
        'createPlaylistModal',
        'Create Playlist',
        content,
        'Create',
        createPlaylist
    );
    
    return modal;
}

// Playlist Selection Modal Constructor
function PlaylistSelectionModal() {
    const content = `
        <div class="playlist-selection-list" id="playlistSelectionList">
            <!-- Playlist options will be dynamically added here -->
        </div>
    `;
    
    const modal = new Modal(
        'playlistSelectionModal',
        'Add Song to Playlists',
        content,
        'Add to Playlists',
        addSongToSelectedPlaylists,
        '450px'
    );
    
    return modal;
}

// Create modals when the document loads
document.addEventListener('DOMContentLoaded', function() {
    const createPlaylistModal = new CreatePlaylistModal();
    createPlaylistModal.create();
    
    const playlistSelectionModal = new PlaylistSelectionModal();
    playlistSelectionModal.create();
    
    // Add event listener for "Play All" button
    document.getElementById('playAllBtn').addEventListener('click', playAllSongs);
});

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
        Swal.fire({
            title: 'Oops!',
            text: 'Please enter a playlist name!',
            icon: 'error',
            confirmButtonColor: '#4A90E2',
            background: '#1e1e1e',
            color: '#fff',
            customClass: {
                popup: 'swal-dark-popup',
                confirmButton: 'swal-confirm-btn'
            }
        });
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
    // Find the selected playlist
    const playlist = playlists.find(pl => pl.id === playlistId);
    
    // Check if playlist exists and has songs
    if (!playlist || !playlist.songs || playlist.songs.length === 0) {
        // Show popup for empty playlist
        Swal.fire({
            title: 'Empty Playlist',
            text: 'This playlist has no songs. Add songs to play it.',
            icon: 'info',
            background: '#1e1e1e',
            color: '#fff',
            customClass: {
                popup: 'swal-dark-popup'
            }
        });
        return;
    }
    
    // Store the playlist information in sessionStorage
    sessionStorage.setItem('currentPlaylist', JSON.stringify({
        id: playlist.id,
        name: playlist.name,
        songs: playlist.songs
    }));
    
    // Navigate to the player page
    window.location.href = 'player.html';
}

function openPlaylistDetails(playlistId) {
    // When a playlist card is clicked, play the playlist
    playPlaylist(playlistId);
}

// Delete playlist function
function deletePlaylist(playlistId) {
    Swal.fire({
        title: 'Delete Playlist?',
        text: "The playlist will be deleted but the songs will remain in your library.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#f44336',
        cancelButtonColor: '#666',
        confirmButtonText: 'Yes, delete it!',
        cancelButtonText: 'Cancel',
        background: '#1e1e1e',
        color: '#fff',
        customClass: {
            popup: 'swal-dark-popup',
            confirmButton: 'swal-confirm-btn',
            cancelButton: 'swal-cancel-btn'
        }
    }).then((result) => {
        if (result.isConfirmed) {
            // Remove the playlist from the array
            playlists = playlists.filter(playlist => playlist.id !== playlistId);
            
            // Save updated playlists to IndexedDB
            savePlaylists();
            
            // Re-render the playlists grid
            renderPlaylists();
            
            // Show success message
            Swal.fire({
                title: 'Deleted!',
                text: 'Your playlist has been deleted.',
                icon: 'success',
                timer: 2000,
                showConfirmButton: false,
                background: '#1e1e1e',
                color: '#fff',
                customClass: {
                    popup: 'swal-dark-popup'
                }
            });
        }
    });
}

// Play all songs in order
function playAllSongs() {
    // Check if there are any songs
    if (songs.length === 0) {
        Swal.fire({
            title: 'No Songs Available',
            text: 'Please add some songs to your library first!',
            icon: 'info',
            background: '#1e1e1e',
            color: '#fff',
            customClass: {
                popup: 'swal-dark-popup'
            }
        });
        return;
    }
    
    // Create a virtual playlist with all songs
    const allSongsPlaylist = {
        id: "all-songs-ordered",
        name: "All Songs",
        songs: songs.map(song => song.id) // Include all song IDs in the original order
    };
    
    // Save the virtual playlist to session storage
    sessionStorage.setItem('currentPlaylist', JSON.stringify(allSongsPlaylist));
    
    // Navigate to the player page
    window.location.href = 'player.html';
}

// Format time helper function

// Format time helper function
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}