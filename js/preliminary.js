// Timestamps data
const timestamps = [
    { time: "00:00", description: "比赛开始" },
    { time: "01:30", description: "第一回合" },
    { time: "05:45", description: "精彩操作" },
    // Add more timestamps as needed
];

// Function to jump to specific time in video
function jumpToTime(timeStr) {
    const iframe = document.querySelector('iframe');
    const player = iframe.contentWindow;

    // Convert time string to seconds
    const [minutes, seconds] = timeStr.split(':').map(Number);
    const totalSeconds = minutes * 60 + seconds;

    // Create the URL with the timestamp
    const currentSrc = iframe.src;
    const baseUrl = currentSrc.split('&t=')[0]; // Remove any existing timestamp
    const newSrc = `${baseUrl}&t=${totalSeconds}`;

    // Update the iframe source
    iframe.src = newSrc;
}

// Populate timestamp table
const timestampBody = document.getElementById('timestampBody');
timestamps.forEach(({ time, description }) => {
    const row = document.createElement('tr');
    row.innerHTML = `
                <td><a href="#" class="time-link" onclick="jumpToTime('${time}'); return false;">${time}</a></td>
                <td>${description}</td>
            `;
    timestampBody.appendChild(row);
});
