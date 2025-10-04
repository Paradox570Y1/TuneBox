
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
  
  let isPlaying = false;

  // When "Add Song" button is clicked, open file picker
  document.getElementById("addSongBtn").addEventListener("click", () => {
    document.getElementById("audioUpload").click();
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

// Load all saved songs from database and display in playlist
function loadSongs() {
  let transaction = db.transaction("songs", "readonly");
  let store = transaction.objectStore("songs");
  let request = store.getAll();

  request.onsuccess = () => {
    // Convert stored songs back to playable format
    songs = request.result.map(song => ({
      ...song,
      audioURL: URL.createObjectURL(new Blob([song.audioBlob], { type: 'audio/*' }))
    }));
    
    let list = document.getElementById("playlist-songs");
    list.innerHTML = "";
    
    // Create playlist items for each song
    songs.forEach((song, index) => {
      let li = document.createElement("li");
      li.className = "playlist-item";
      
      // Show duration if available
      const duration = (song.duration && !isNaN(song.duration)) ? ` (${formatTime(song.duration)})` : "";
      
      li.innerHTML = `
        <span class="song-title">${song.title}</span>
        <span class="song-info">${duration}</span>
      `;
      
      // Make songs clickable to play them
      li.addEventListener("click", () => {
        window.loadSong(index);
        // Auto-play when user clicks on a song
        if (window.currentAudio) {
          window.currentAudio.play();
        }
      });
      
      list.appendChild(li);
    });
    
    // Load first song when app starts (but don't auto-play)
    if (songs.length > 0 && !window.currentAudio) {
      window.loadSong(0);
    }
  };
}
