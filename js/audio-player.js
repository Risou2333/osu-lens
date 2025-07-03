/*
 * js/audio-player.js
 *
 * 包含音乐播放器的所有逻辑，用于播放谱面预览音频。
 */

import { dom } from './dom.js';
import { formatDuration } from './utils.js';

function playAudio(beatmapsetId, title, artist) {
    const p = dom.player;
    const url = `https://b.ppy.sh/preview/${beatmapsetId}.mp3`;
    if (p.audio.src !== url) p.audio.src = url;
    
    p.infoText.innerHTML = `<strong>${title}</strong> - ${artist}`;
    p.info.title = `${title} - ${artist}`;
    
    setTimeout(() => {
        const isOverflow = p.infoText.scrollWidth > p.info.clientWidth;
        p.info.classList.toggle('is-overflowing', isOverflow);
        if(isOverflow) p.info.style.setProperty('--marquee-parent-width', `${p.info.clientWidth}px`);
    }, 0);

    p.container.style.setProperty('--player-bg-image-url', `url('https://assets.ppy.sh/beatmaps/${beatmapsetId}/covers/card.jpg')`);
    p.audio.play();
    p.container.classList.add('visible');
}

function togglePlay() {
    if (dom.player.audio.src) {
        dom.player.audio.paused ? dom.player.audio.play() : dom.player.audio.pause();
    }
}

function updatePlayPauseIcon(isPlaying) {
    dom.player.playIcon.classList.toggle('hidden', isPlaying);
    dom.player.pauseIcon.classList.toggle('hidden', !isPlaying);
}

function updateProgress() {
    if (dom.player.audio.duration) {
        dom.player.progressBar.value = (dom.player.audio.currentTime / dom.player.audio.duration) * 100;
        dom.player.currentTime.textContent = formatDuration(dom.player.audio.currentTime);
    }
}

function updateDuration() {
    if (dom.player.audio.duration) {
        dom.player.duration.textContent = formatDuration(dom.player.audio.duration);
    }
}

function closePlayer() {
    const p = dom.player;
    p.audio.pause();
    p.audio.src = "";
    p.container.classList.remove('visible');
    updatePlayPauseIcon(false);
}

export function setupAudioPlayerListeners() {
    const p = dom.player;
    document.body.addEventListener('click', e => {
        const audioTrigger = e.target.closest('.beatmap-cover-container, .beatmap-listen-btn');
        if (audioTrigger?.dataset.beatmapsetId && audioTrigger.dataset.title && audioTrigger.dataset.artist) {
            playAudio(audioTrigger.dataset.beatmapsetId, audioTrigger.dataset.title, audioTrigger.dataset.artist);
        }
    });

    p.playPauseBtn.addEventListener('click', togglePlay);
    p.audio.addEventListener('play', () => updatePlayPauseIcon(true));
    p.audio.addEventListener('pause', () => updatePlayPauseIcon(false));
    p.audio.addEventListener('ended', closePlayer);
    p.audio.addEventListener('timeupdate', updateProgress);
    p.audio.addEventListener('loadedmetadata', updateDuration);
    p.progressBar.addEventListener('input', e => { 
        if(p.audio.duration) p.audio.currentTime = (e.target.value/100) * p.audio.duration; 
    });
    p.volumeSlider.addEventListener('input', e => p.audio.volume = e.target.value);
    p.closeBtn.addEventListener('click', closePlayer);
}
