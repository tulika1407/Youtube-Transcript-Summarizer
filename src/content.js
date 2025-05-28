// Example: Detect the YouTube video page load and interact with it

if (window.location.host === 'www.youtube.com' && window.location.pathname.includes('watch')) {
  chrome.runtime.onMessage.addListener((request) => {
    if (request.action === "openGemini") {
        window.open(
            `https://gemini.google.com/app?text=${
                encodeURIComponent("Summarize this:\n\n" + request.text.substring(0, 1500))
            }`,
            '_blank'
        );
    }
});
    console.log('YouTube Video Page Loaded');
    // You can trigger transcript extraction logic here.
}    
