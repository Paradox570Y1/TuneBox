// Function to remove a song from the current playlist
function removeSongFromPlaylist(songId) {
  // Get current playlist data
  const playlistData = sessionStorage.getItem('currentPlaylist');
  if (!playlistData) return; // Not in a playlist view
  
  const playlistInfo = JSON.parse(playlistData);
  
  // Get the song title
  const song = songs.find(s => s.id === songId);
  const songTitle = song ? song.title : 'this song';
  
  // Show confirmation dialog with SweetAlert2
  if (window.Swal) {
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
      removeFromPlaylist();
    });
  } else {
    // Fallback to regular confirm if SweetAlert2 is not available
    const confirmRemove = confirm(`Remove "${songTitle}" from "${playlistInfo.name}" playlist?`);
    if (confirmRemove) {
      removeFromPlaylist();
    }
  }
  
  function removeFromPlaylist() {
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
          loadSong(Math.min(currentSongIndex, songs.length - 1));
        }
      }
    }
  }
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