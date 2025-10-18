
// Simple song object to store song information
function Song(title, duration, fileName) {
  this.title = title;
  this.duration = duration;
  this.fileName = fileName;
  this.addedAt = new Date();
}

// Global variables for music player state
let db;
let currentAudio = null;
let currentSongIndex = 0;
let songs = [];

// Set up local database for storing songs
let request = indexedDB.open("MusicDB", 1);

request.onupgradeneeded = function(event) {
  db = event.target.result;

  if (db.objectStoreNames.contains("songs")) {
    db.deleteObjectStore("songs");
  }
  
  let store = db.createObjectStore("songs", { keyPath: "id", autoIncrement: true });
  store.createIndex("title", "title", { unique: false });
};

request.onsuccess = (event) => { 
  db = event.target.result; 
  loadSongs(); 
};

request.onerror = (event) => console.error("DB Error:", event.target.error);

// Convert seconds to readable time format (e.g., "3:45")
function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) {
    return "0:00";
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Save uploaded song to local database
function addSongToDB(song, file) {
  // Convert file to binary data for storage
  const reader = new FileReader();
  reader.onload = function(event) {
    song.audioBlob = event.target.result;
    
    let transaction = db.transaction("songs", "readwrite");
    let store = transaction.objectStore("songs");
    let request = store.add(song);

    request.onsuccess = () => { 
      loadSongs(); 
      console.log("Song added successfully:", song.title);
    };
    request.onerror = (e) => {
      console.error("Save failed:", e);
      alert("Failed to save song. Please try again.");
    };
  };
  
  reader.onerror = function() {
    alert("Error reading file. Please try again.");
  };
  
  reader.readAsArrayBuffer(file);
}

// Function to update the playlist in IndexedDB
function updatePlaylistInDB(playlist) {
  // Open the IndexedDB for playlists
  const request = indexedDB.open('TuneBoxPlaylists', 1);
  
  request.onsuccess = function(e) {
    const db = e.target.result;
    const transaction = db.transaction(['playlists'], 'readwrite');
    const store = transaction.objectStore('playlists');
    
    // Get the full playlist object from DB first
    const getRequest = store.get(playlist.id);
    
    getRequest.onsuccess = function() {
      const fullPlaylist = getRequest.result;
      if (fullPlaylist) {
        // Update just the songs array
        fullPlaylist.songs = playlist.songs;
        // Put it back in the database
        store.put(fullPlaylist);
      }
    };
  };
}

// Function to remove a song from the current playlist
function removeSongFromPlaylist(songId) {
  const playlistData = sessionStorage.getItem('currentPlaylist');
  if (!playlistData) return;
  
  const playlistInfo = JSON.parse(playlistData);
  
  // Get song title for the confirmation dialog
  const song = songs.find(s => s.id === songId);
  const songTitle = song ? song.title : 'this song';
  
  // Show confirmation dialog with SweetAlert2
  Swal.fire({
    title: 'Remove Song?',
    text: `Remove "${songTitle}" from "${playlistInfo.name}" playlist?`,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#ff5252',
    cancelButtonColor: '#666',
    confirmButtonText: 'Remove',
    cancelButtonText: 'Cancel',
    background: '#1e1e1e',
    color: '#fff',
    customClass: {
      popup: 'swal-dark-popup',
      confirmButton: 'swal-confirm-btn',
      cancelButton: 'swal-cancel-btn'
    }
  }).then((result) => {
    if (!result.isConfirmed) return;
    
    // Remove the song ID from the playlist's songs array
    if (playlistInfo.songs) {
      playlistInfo.songs = playlistInfo.songs.filter(id => id !== songId);
      
      // Update sessionStorage with the modified playlist
      sessionStorage.setItem('currentPlaylist', JSON.stringify(playlistInfo));
      
      // Update the database with the modified playlist
      updatePlaylistInDB(playlistInfo);
      
      // Reload the songs display
      loadSongs();
      
      // If current song was removed, stop playback
      if (currentAudio && songs.findIndex(song => song.id === songId) === currentSongIndex) {
        currentAudio.pause();
        if (songs.length > 0) {
          // Play the next available song if any
          window.loadSong(Math.min(currentSongIndex, songs.length - 1));
        }
      }
    }
  });
}

// Load all saved songs from database and display in playlist
function loadSongs() {
  // Check if a playlist was selected
  const playlistData = sessionStorage.getItem('currentPlaylist');
  const currentSongData = sessionStorage.getItem('currentSong');
  
  // First update the playlist header
  const playlistHeader = document.querySelector(".playlist-header h3");
  
  // Start transaction to get all songs
  let transaction = db.transaction("songs", "readonly");
  let store = transaction.objectStore("songs");
  let request = store.getAll();

  request.onsuccess = () => {
    const allSongs = request.result.map(song => ({
      ...song,
      audioURL: URL.createObjectURL(new Blob([song.audioBlob], { type: 'audio/*' }))
    }));
    
    // Determine which songs to show: all or from a specific playlist
    if (playlistData) {
      const playlist = JSON.parse(playlistData);
      playlistHeader.textContent = playlist.name;
      
      // Filter songs that belong to this playlist
      songs = allSongs.filter(song => 
        playlist.songs && playlist.songs.includes(song.id)
      );
      
      // Check if we have currentSongData from the home page selection
      // If we're coming from the "All Songs" section of the home page
      const currentSongData = sessionStorage.getItem('currentSong');
      if (currentSongData && playlist.id === "all-songs-virtual") {
        // Get the currently selected song
        const currentSong = JSON.parse(currentSongData);
        
        // Reorder songs array to put the selected song first
        const selectedSongIndex = songs.findIndex(song => song.id === currentSong.id);
        if (selectedSongIndex !== -1) {
          // Move the selected song to the beginning of the array
          const selectedSong = songs.splice(selectedSongIndex, 1)[0];
          songs.unshift(selectedSong);
        }
      }
    } else if (currentSongData) {
      // If coming from a single song play
      playlistHeader.textContent = "Now Playing";
      songs = allSongs;
    } else {
      // Default behavior - show all songs
      playlistHeader.textContent = "All Songs";
      songs = allSongs;
    }
    
    let list = document.getElementById("playlist-songs");
    list.innerHTML = "";
    
    // Show message if playlist is empty
    if (songs.length === 0) {
      const emptyMessage = document.createElement("li");
      emptyMessage.className = "playlist-item empty-message";
      emptyMessage.innerHTML = `
        <span class="song-title">No songs in this playlist</span>
        <span class="song-info">Add songs from the home page</span>
      `;
      list.appendChild(emptyMessage);
    } else {
      // Create playlist items for each song
      songs.forEach((song, index) => {
        let li = document.createElement("li");
        li.className = "playlist-item";
        
        // Show duration if available
        const duration = (song.duration && !isNaN(song.duration)) ? ` (${formatTime(song.duration)})` : "";
        
        // Check if we're in a specific playlist view
        const isPlaylistView = sessionStorage.getItem('currentPlaylist') !== null;
        
        // Add a delete button if we're in a playlist view
        const deleteButton = isPlaylistView ? 
          `<button class="remove-from-playlist" title="Remove from playlist">
            <i class="fas fa-times"></i>
          </button>` : '';
        
        li.innerHTML = `
          <span class="song-title">${song.title}</span>
          <span class="song-info">${duration}</span>
          ${deleteButton}
        `;
        
        // Add click event for the song item
        li.addEventListener("click", function(e) {
          // Don't play the song if clicking the delete button
          if (e.target.closest('.remove-from-playlist')) {
            return;
          }
          
          window.loadSong(index);
          // Auto-play when user clicks on a song
          if (window.currentAudio) {
            window.currentAudio.play();
          }
        });
        
        // Add event listener for delete button if it exists
        const removeBtn = li.querySelector('.remove-from-playlist');
        if (removeBtn) {
          removeBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent triggering song play
            removeSongFromPlaylist(song.id);
          });
        }
        
        list.appendChild(li);
      });
    }
    
    // Load first song when app starts
    if (songs.length > 0 && !window.currentAudio) {
      // If we're coming from the home page's All Songs section with a selected song,
      // the selected song is now at index 0 due to our reordering above
      window.loadSong(0);
      
      // Auto-play when coming from the home page with a specific song selection
      const playlistData = sessionStorage.getItem('currentPlaylist');
      const currentSongData = sessionStorage.getItem('currentSong');
      
      if (playlistData) {
        const playlist = JSON.parse(playlistData);
        // Auto-play if coming from All Songs section or a specific playlist
        if (playlist.id === "all-songs-virtual" || 
            playlist.id === "all-songs-ordered" || 
            currentSongData) {
          if (window.currentAudio) {
            window.currentAudio.play();
          }
        }
      }
    }
  };
}

// Main setup when page loads
document.addEventListener("DOMContentLoaded", () => {
  // Get all the player controls
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playPauseIcon = playPauseBtn.querySelector("i");
  const progressBar = document.querySelector(".progress-bar");
  const currentTimeEl = document.querySelector(".current-time");
  const totalDurationEl = document.querySelector(".total-duration");
  const trackTitle = document.querySelector(".track-title");
  const volumeBar = document.querySelector(".volume-bar");
  const playlistHeader = document.querySelector(".playlist-header h3");
  
  let isPlaying = false;
  let currentPlaylist = null;

  // When "Add Song" button is clicked, open file picker
  document.getElementById("addSongBtn").addEventListener("click", () => {
    document.getElementById("audioUpload").click();
  });
  
  // When "Back to Home" button is clicked
  document.getElementById("backToHome").addEventListener("click", () => {
    // Clear playlist selection from session storage before going back
    sessionStorage.removeItem('currentPlaylist');
    window.location.href = 'index.html';
  });

  // Handle file selection when user picks an audio file
  document.getElementById("audioUpload").addEventListener("change", function(event) {
    let file = event.target.files[0];
    if (!file) return;

    // Create temporary audio element to extract duration
    let audio = document.createElement("audio");
    audio.src = URL.createObjectURL(file);

    audio.onloadedmetadata = function() {
      let duration = Math.floor(audio.duration) || 0;
      let title = file.name.replace(/\.[^/.]+$/, ""); // Remove file extension

      let song = new Song(title, duration, file.name);
      addSongToDB(song, file);
      
      console.log("Added song:", {
        title,
        duration: formatTime(duration)
      });
      
      // Clean up temporary audio element
      URL.revokeObjectURL(audio.src);
    };
    
    audio.onerror = function() {
      alert("Error loading audio file. Please try a different file.");
      URL.revokeObjectURL(audio.src);
    };
  });

  // Play/Pause button functionality
  playPauseBtn.addEventListener("click", () => {
    if (!currentAudio) {
      // If no song is loaded, start with the first song
      if (songs.length > 0) {
        loadSong(0);
      }
      return;
    }

    if (isPlaying) {
      currentAudio.pause();
      playPauseIcon.classList.remove("fa-pause");
      playPauseIcon.classList.add("fa-play");
      isPlaying = false;
    } else {
      currentAudio.play();
      playPauseIcon.classList.remove("fa-play");
      playPauseIcon.classList.add("fa-pause");
      isPlaying = true;
    }
  });

  // Allow user to seek through the song by clicking on progress bar
  progressBar.addEventListener("input", () => {
    if (currentAudio) {
      const seekTime = (progressBar.value / 100) * currentAudio.duration;
      currentAudio.currentTime = seekTime;
    }
  });

  // Volume control
  volumeBar.addEventListener("input", () => {
    if (currentAudio) {
      currentAudio.volume = volumeBar.value / 100;
    }
  });

  // Update the progress bar and time display as song plays
  function updateProgress() {
    if (currentAudio && !isNaN(currentAudio.duration)) {
      const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
      progressBar.value = progress || 0;
      currentTimeEl.textContent = formatTime(currentAudio.currentTime);
      totalDurationEl.textContent = formatTime(currentAudio.duration);
    }
  }

  // Load a specific song and set up its controls
  function loadSong(index) {
    if (index < 0 || index >= songs.length) return;
    
    const song = songs[index];
    currentSongIndex = index;
    
    // Stop current song if one is playing
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    
    // Create new audio player for the selected song
    currentAudio = new Audio(song.audioURL);
    currentAudio.volume = volumeBar.value / 100;
    
    // Make audio player available globally for playlist controls
    window.currentAudio = currentAudio;
    
    // Update the display with song information
    trackTitle.textContent = song.title;
    totalDurationEl.textContent = formatTime(song.duration);
    currentTimeEl.textContent = "0:00";
    progressBar.value = 0;
    
    // Keep the default logo as album art
    const trackArtImg = document.querySelector(".track-art img");
    trackArtImg.src = "./assets/LOGO.png";
    
    // Highlight the currently playing song in playlist
    document.querySelectorAll(".playlist-item").forEach((item, i) => {
      item.classList.toggle("active", i === index);
    });
    
    // Set up audio event listeners
    currentAudio.addEventListener("timeupdate", updateProgress);
    currentAudio.addEventListener("ended", () => {
      // Auto-play next song when current song ends
      if (currentSongIndex < songs.length - 1) {
        loadSong(currentSongIndex + 1);
        currentAudio.play();
      } else {
        // End of playlist - stop playing
        playPauseIcon.classList.remove("fa-pause");
        playPauseIcon.classList.add("fa-play");
        isPlaying = false;
      }
    });
    
    currentAudio.addEventListener("play", () => {
      playPauseIcon.classList.remove("fa-play");
      playPauseIcon.classList.add("fa-pause");
      isPlaying = true;
    });
    
    currentAudio.addEventListener("pause", () => {
      playPauseIcon.classList.remove("fa-pause");
      playPauseIcon.classList.add("fa-play");
      isPlaying = false;
    });
  }

  // Make functions available globally so playlist can use them
  window.loadSong = loadSong;
  window.currentAudio = currentAudio;
});
