// Function to jump to specific time in video
function jumpToTime(timeStr, iframeId) {
    const iframe = document.querySelector(`#${iframeId}`);
    if (!iframe) return;

    // Convert time string to seconds
    const [minutes, seconds] = timeStr.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;

    // Create the URL with the timestamp
    const currentSrc = iframe.src;
    const baseUrl = currentSrc.split('&t=')[0];
    const newSrc = `${baseUrl}&t=${totalSeconds}`;

    // Update the iframe source
    iframe.src = newSrc;
}

function injectBilibiliAPI(iframeId) {
    const iframe = document.querySelector(`#${iframeId}`);
    if (!iframe) return;

    // Update iframe src to enable player API
    let src = iframe.src;
    if (!src.includes('&api=1')) {
        src += '&api=1';
    }
    if (!src.includes('&player_type=1')) {
        src += '&player_type=1';
    }
    if (!src.includes('&enableapi=1')) {
        src += '&enableapi=1';
    }
    iframe.src = src;

    // Add event listener for Bilibili player messages
    window.addEventListener('message', function(e) {
        console.log('Bilibili player message:', e.data);
    });
}

// Populate timestamps table with the given data
function populateTimestamps(data, eleId) {
    const timestampBody = document.getElementById(eleId);
    if (!timestampBody) {
        console.error(`Timestamp table body not found: ${eleId}`);
        return;
    }

    console.log(`Populating timestamps for ${eleId} with data:`, data);
    timestampBody.innerHTML = '';

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.setAttribute('data-type', row.type);
        tr.innerHTML = `
            <td><a href="#" class="time-link" onclick="jumpToTime('${row.time}', '${eleId.replace('timestampBody', 'video')}'); return false;">${row.time}</a></td>
            <td>${row.event}</td>
            <td>${row.type}</td>
        `;
        timestampBody.appendChild(tr);
    });
}

// Setup event type filter
function setupEventTypeFilter(data, filterId) {
    const types = [...new Set(data.map(row => row.type))];
    const filter = document.getElementById(filterId);
    if (!filter) {
        console.error(`Event type filter not found: ${filterId}`);
        return;
    }

    // Clear existing options except the first one
    while (filter.options.length > 1) {
        filter.remove(1);
    }

    types.forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        filter.appendChild(option);
    });
}

// Filter timestamps by type
function filterTimestamps(sectionId) {
    const selectedType = document.getElementById(`eventTypeFilter${sectionId}`).value;
    const rows = document.querySelectorAll(`#timestampBody${sectionId} tr`);

    console.log(`Filtering timestamps for section ${sectionId} by type:`, selectedType);
    rows.forEach(row => {
        if (selectedType === 'all' || row.getAttribute('data-type') === selectedType) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
}

// Initialize a single video section
async function initializeVideoSection(sectionId, csvPath) {
    try {
        // Load and parse CSV data
        const response = await fetch(csvPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const csvText = await response.text();
        console.log(`CSV text loaded for section ${sectionId}:`, csvText.substring(0, 200) + '...');

        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true
        });

        if (results.errors.length > 0) {
            console.warn(`Parsing errors for section ${sectionId}:`, results.errors);
        }

        // Initialize timestamp table and filter
        populateTimestamps(results.data, `timestampBody${sectionId}`);
        setupEventTypeFilter(results.data, `eventTypeFilter${sectionId}`);

        // Inject Bilibili API
        injectBilibiliAPI(`video${sectionId}`);

        // Initialize timeline
        const timelineContainer = document.getElementById(`timeline-container${sectionId}`);
        if (!timelineContainer) {
            console.error(`Timeline container not found for section ${sectionId}!`);
            return;
        }

        console.log(`Initializing timeline for section ${sectionId}...`);
        const timeline = new Timeline(
            timelineContainer,
            results.data,
            0,
            `video${sectionId}`  // Pass the iframe ID
        );

        // Add to window for debugging
        window[`timeline${sectionId}`] = timeline;

    } catch (error) {
        console.error(`Error initializing section ${sectionId}:`, error);
    }
}

// Initialize everything when document is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Starting initialization');

    // Initialize each video section
    await initializeVideoSection('1-1', 'preliminary/csv/perform1.csv');
    await initializeVideoSection('1-2', 'preliminary/csv/perform1.csv');
    // Add more sections as needed
});

// Add this to your preliminary.js file, after the DOMContentLoaded event
function adjustTimestampHeight() {
    const videoWrappers = document.querySelectorAll('.video-wrapper');
    const timestampSections = document.querySelectorAll('.timestamp-section');

    videoWrappers.forEach((wrapper, index) => {
        if (timestampSections[index]) {
            const videoHeight = wrapper.offsetHeight;
            timestampSections[index].style.height = `${videoHeight}px`;
        }
    });
}

// Add these event listeners to your DOMContentLoaded event
window.addEventListener('load', adjustTimestampHeight);
window.addEventListener('resize', adjustTimestampHeight);