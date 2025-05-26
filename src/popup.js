// Constants for elements and API base URL
// Groq API Configuration - Add at the top with other constants
const GEMINI_API_KEY = 'AIzaSyBe9V06w-ipBVArrkKmr-8OGXuLdAQnZaY'; // 
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';
const messageBox = document.getElementById('message');
const transcriptOutput = document.getElementById('transcript-output');
const transcriptLanguages = document.getElementById('transcript-languages');
const extractButton = document.getElementById('extract-transcript');
const copyButton = document.getElementById('copy-transcript');
const apiBaseUrl = 'https://transcript.andreszenteno.com';

// Global variables for transcript and video data
let transcript = '';
let videoTitle = '';
let videoUrl = '';

// Disable buttons by default
messageBox.style.display = 'none';
extractButton.disabled = true;
copyButton.disabled = true;

// Check if we are on a valid YouTube page or embedded video
chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    videoUrl = await getVideoUrl(tab);  // Pass tab.id to get the video URL
    if (videoUrl) {
        extractButton.disabled = false;
    } else {
        messageBox.style.display = 'block';
        messageBox.innerText = 'No YouTube video found on this page.';
    }
});

// Function to extract video URL (either direct or embedded)
// Function to extract video URL (either direct or embedded)
async function getVideoUrl(tab) {
    const url = tab.url || '';  // Ensure `url` is a string
    if (typeof url !== 'string') {
        return null;  // Return null if url is not a string
    }

    if (url.includes('youtube.com/watch?v=') || url.includes('youtube.com/shorts') || url.includes('youtu.be/')) {
        return url;  // Direct YouTube video URL
    } else {
        // Check for embedded video
        const iframeSrc = await getEmbeddedVideoUrl(tab.id);
        if (iframeSrc) {
            const videoId = iframeSrc.split('embed/')[1]?.split('?')[0];
            return videoId ? `https://www.youtube.com/watch?v=${videoId}` : null;
        }
    }
    return null;
}


// Function to get the embedded video URL (runs within the page)
async function getEmbeddedVideoUrl(tabId) {
    return new Promise((resolve) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },  // Corrected this line to use tab.id, not the URL
            func: extractEmbeddedVideoUrl
        }, (results) => resolve(results[0]?.result || null));
    });
}

// Function to extract embedded YouTube video URL (runs in the page)
function extractEmbeddedVideoUrl() {
    const iframe = Array.from(document.querySelectorAll('iframe')).find(iframe => iframe.src.includes('youtube.com/embed/'));
    return iframe ? iframe.src : null;
}

// Handle extract transcript click event
extractButton.addEventListener("click", async () => {
    transcriptOutput.innerHTML = '<div class="spinner-container"><div class="spinner"></div><div class="spinner-text">Fetching transcript... This may take a few seconds.</div></div>';
    const data = await fetchTranscript(videoUrl);

    if (data) {
        copyButton.disabled = false;
        transcript = data.transcript;
        videoTitle = data.title;
        const languages = data.languages;
        displayTranscript(languages, data.transcriptLanguageCode);
    } else {
        transcriptOutput.innerHTML = 'Error fetching transcript';
    }
});

// Fetch transcript and languages from API
async function fetchTranscript(url, lang = '') {
    try {
        const response = await fetch(`${apiBaseUrl}/simple-transcript-v3`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, lang })
        });

        if (!response.ok) throw new Error('Failed to fetch transcript');

        return await response.json();
    } catch (error) {
        messageBox.innerText = `Error: ${error.message}`;
        messageBox.style.display = 'block';
        return null;
    }
}

// Display transcript and language dropdown
function displayTranscript(languages, currentLangCode = '') {
    transcriptOutput.innerHTML = `<strong>${videoTitle}</strong><br><br>${transcript}`;
    handleLanguageSelection(languages, currentLangCode);
}


// Handle language selection for transcripts
function handleLanguageSelection(languages, currentLangCode = '') {
    transcriptLanguages.innerHTML = '';  // Clear previous languages
    if (languages && languages.length > 0) {
        const select = document.createElement('select');
        select.innerHTML = '<option value="">Available languages</option>';

        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang.code;
            option.textContent = lang.name;

            // Select the option if it matches the current transcript language
            if (lang.code === currentLangCode) {
                option.selected = true;
            }

            select.appendChild(option);
        });

        transcriptLanguages.appendChild(select);

        select.addEventListener('change', async (event) => {
            const selectedLanguage = event.target.value;
            if (selectedLanguage) {
                transcriptOutput.innerHTML = '<div class="spinner-container"><div class="spinner"></div></div>';
                const data = await fetchTranscript(videoUrl, selectedLanguage);
                if (data) {
                    transcript = data.transcript;  // Update the transcript variable
                    displayTranscript(data.languages, data.transcriptLanguageCode);  // Pass the current language code
                }
            }
        });
    }
}

// Handle copy transcript button click
copyButton.addEventListener('click', async () => {
    if (transcript) {
        await navigator.clipboard.writeText(`${videoTitle}\n\n${transcript}`);
        copyButton.innerText = 'Copied!';
        setTimeout(() => {
            copyButton.innerText = 'Copy';
        }, 2000);
    }
});
// ========== REPLACE GROQ WITH GEMINI ========== //
async function summarizeTranscript(text) {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_GEMINI_KEY`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: `Summarize in bullet points:\n\n${text}` }]
          }]
        })
      }
    );
    const data = await response.json();
    return data.candidates[0]?.content?.parts[0]?.text || "No summary available";
  } catch (error) {
    return `Error: ${error.message}`;
  }
}
// ========== END OF REPLACEMENT ========== //
document.addEventListener('DOMContentLoaded', function() {
  const btn = document.getElementById('summary-btn');
  const resultDiv = document.getElementById('summary-result');

  // Track transcript state
  let transcriptState = {
    attemptedOpen: false,
    retryCount: 0
  };

  btn.addEventListener('click', async function() {
    btn.disabled = true;
    resultDiv.style.display = 'block';
    resultDiv.innerHTML = '<div class="spinner"></div><div>Initializing...</div>';

    try {
      // Get active YouTube tab
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab?.url?.includes('youtube.com/watch')) {
        throw new Error('Please open a YouTube video first');
      }

      // Execute in YouTube tab
      resultDiv.innerHTML = '<div class="spinner"></div><div>Accessing YouTube...</div>';
      const injectionResult = await chrome.scripting.executeScript({
        target: {tabId: tab.id},
        func: (state) => {
          // Function to actually check for transcript content
          const checkForContent = () => {
            try {
              // 1. Check modern transcript panel
              const panel = document.querySelector('ytd-transcript-body-renderer');
              if (panel?.textContent?.trim().length > 100) {
                return {
                  status: 'SUCCESS',
                  content: panel.textContent
                };
              }

              // 2. Check legacy transcript
              const segments = document.querySelectorAll('ytd-transcript-segment-renderer');
              if (segments.length > 3) {
                return {
                  status: 'SUCCESS',
                  content: Array.from(segments).map(s => s.textContent).join('\n')
                };
              }

              // 3. Check captions
              const captions = document.querySelectorAll('.caption-visual-line');
              if (captions.length > 3) {
                return {
                  status: 'SUCCESS',
                  content: Array.from(captions).map(c => c.textContent).join('\n')
                };
              }

              return { status: 'NOT_FOUND' };
            } catch (e) {
              return { status: 'ERROR', message: e.message };
            }
          };

          // First check if content exists
          const contentCheck = checkForContent();
          if (contentCheck.status === 'SUCCESS') return contentCheck;

          // If we've already tried opening, return status
          if (state.attemptedOpen) return contentCheck;

          // Try to open transcript panel
          const transcriptBtn = document.querySelector('button[aria-label*="Transcript" i]');
          if (transcriptBtn) {
            transcriptBtn.click();
            return { status: 'OPENED' };
          }

          return contentCheck;
        },
        args: [transcriptState]
      });

      const result = injectionResult[0]?.result;

      // Handle different states
      switch (result?.status) {
        case 'SUCCESS':
          transcriptState = { attemptedOpen: false, retryCount: 0 };
          showSummary(result.content);
          break;

        case 'OPENED':
          transcriptState.attemptedOpen = true;
          showTranscriptOpened();
          break;

        case 'NOT_FOUND':
          if (transcriptState.retryCount++ < 2) {
            setTimeout(() => btn.click(), 1000);
          } else {
            throw new Error(`
              Transcript not loading. Please:
              1. <strong>Manually</strong> click YouTube's Transcript button
              2. Wait until text appears
              3. Click this button again
            `);
          }
          break;

        case 'ERROR':
          throw new Error(result.message || 'Failed to access transcript');

        default:
          throw new Error('Unexpected response from YouTube');
      }

    } catch (error) {
      showError(error.message);
      transcriptState = { attemptedOpen: false, retryCount: 0 };
    } finally {
      btn.disabled = false;
    }
  });

  function showSummary(content) {
    const lines = content.split('\n')
      .filter(line => line.trim().length > 30)
      .filter(line => !/subscribe|http|@|#|\.com|advertisement|sponsor/i.test(line))
      .slice(0, 5);
    
    resultDiv.innerHTML = `
      <div style="font-weight:bold; color:#4285f4;">Summary:</div>
      <div style="margin-top:8px; line-height:1.5;">
        ${lines.map(line => `• ${line.trim()}`).join('<br>')}
      </div>
    `;
  }

  function showTranscriptOpened() {
    resultDiv.innerHTML = `
      <div style="color:#0f9d58; font-weight:bold;">✓ Transcript panel opened!</div>
      <div style="margin-top:12px;">
        <strong>Next steps:</strong>
        <ol style="padding-left:20px; margin-top:6px;">
          <li>Wait for transcript to <strong>fully load</strong> (look for text)</li>
          <li>Click this button <strong>one more time</strong></li>
        </ol>
      </div>
    `;
  }

  function showError(message) {
    resultDiv.innerHTML = `
      <div style="color:#d32f2f; font-weight:bold;">⚠️ ${message}</div>
      <div style="margin-top:12px; padding:10px; background:#feefef; border-radius:4px;">
        <strong>Troubleshooting:</strong>
        <ol style="padding-left:20px; margin-top:6px;">
          <li>Refresh YouTube (Ctrl+F5)</li>
          <li>Reload extension (chrome://extensions)</li>
          <li>Try a video with official transcripts</li>
        </ol>
      </div>
    `;
  }
});