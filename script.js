// Initial Setup
document.addEventListener("DOMContentLoaded", () => {
  const playPauseBtn = document.getElementById("play-pause-btn");
  const playPauseIcon = playPauseBtn.querySelector("i");
  let isPlaying = false;
  // Play & pause toggle
  playPauseBtn.addEventListener("click", () => {
    if (isPlaying) {
      playPauseIcon.classList.remove("fa-pause");
      playPauseIcon.classList.add("fa-play");
      isPlaying = false;
    } else {
      playPauseIcon.classList.remove("fa-play");
      playPauseIcon.classList.add("fa-pause");
      isPlaying = true;
    }
  });
  // Select active song
  const playlistItems = document.querySelectorAll(".playlist-item");
  playlistItems.forEach((item) => {
    item.addEventListener("click", () => {
      document.querySelector(".playlist-item.active")
        .classList.remove("active");
      item.classList.add("active");
    });
  });
});
